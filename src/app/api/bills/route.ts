// src/app/api/bills/route.ts
// GET  /api/bills — list bills (date range filter)
// POST /api/bills — create a bill (POS checkout)
//
// POST flow:
//   1. Validate input, load TenantSettings for tax rules
//   2. For each cart line: load product/variant, resolve unit price,
//      compute line total (calculateLineTotal), gather FEFO batches
//   3. Validate stock sufficiency for ALL lines before writing anything
//      (fail fast — no partial bills)
//   4. Compute bill totals (calculateBillTotals)
//   5. Transaction: generate billNumber, create Bill, explode each line
//      into one BillItem per batch touched (FEFO may span multiple
//      batches), decrement ProductBatch.remainingQty + Inventory.quantity
//      + ProductVariant.stock, create a Sale record
//
// Permission: billing.view (GET), billing.create (POST)

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, serverError,
  parsePagination, paginationSkip,
} from '@/lib/api-helpers';
import { createBillSchema, billListQuerySchema, validate } from '@/lib/validation';
import { allocateFefoDeduction, type FefoBatch } from '@/lib/inventory/stockSync';
import { calculateLineTotal, calculateBillTotals, calculateChange, generateBillNumber } from '@/lib/billing/billMath';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ─── GET /api/bills ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canView =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('billing.view');
    if (!canView) return forbidden('Missing permission: billing.view');

    const { searchParams } = request.nextUrl;
    const pagination = parsePagination(searchParams);

    const { data, errors } = validate(billListQuerySchema, {
      from: searchParams.get('from') ?? undefined,
      to:   searchParams.get('to')   ?? undefined,
    });
    if (errors) return badRequest('Validation failed', errors);

    const where: Prisma.BillWhereInput = {
      tenantId: auth.tenantId,
      ...(data.from && data.to && {
        createdAt: {
          gte: new Date(`${data.from}T00:00:00`),
          lte: new Date(`${data.to}T23:59:59`),
        },
      }),
    };

    if (pagination.search) {
      where.billNumber = { contains: pagination.search, mode: 'insensitive' };
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        skip:    paginationSkip(pagination),
        take:    pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { name: true } },
          items:    { select: { id: true } },
        },
      }),
      prisma.bill.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.limit);

    return ok({
      items: bills.map(b => ({
        id:           b.id,
        billNumber:   b.billNumber,
        total:        b.total,
        paymentMode:  b.paymentMode,
        itemCount:    b.items.length,
        employeeName: b.employee?.name ?? null,
        createdAt:    b.createdAt,
      })),
      pagination: {
        total, page: pagination.page, limit: pagination.limit,
        totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── POST /api/bills ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canCreate =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('billing.create');
    if (!canCreate) return forbidden('Missing permission: billing.create');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(createBillSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const tenantId = auth.tenantId;

    // Load tax settings (fall back to schema defaults if not configured)
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    const taxSettings = {
      taxType:    (settings?.taxType as 'SINGLE' | 'SPLIT') ?? 'SINGLE',
      taxPercent: settings?.taxPercent ?? 18,
      cgst:       settings?.cgst ?? 9,
      sgst:       settings?.sgst ?? 9,
    };

    // Resolve each line: product/variant lookup, unit price, FEFO batch plan
    interface ResolvedLine {
      productId:    string;
      variantId:    string | null;
      name:         string;
      size:         string | null;
      unitPrice:    number;
      quantity:     number;
      lineDiscount: number;
      lineTotal:    number;
      deductions:   { batchId: string; deduct: number }[];
    }

    const resolvedLines: ResolvedLine[] = [];
    const stockErrors: string[] = [];

    for (const item of data.items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, tenantId, isDeleted: false },
      });
      if (!product) {
        stockErrors.push(`Product ${item.productId} not found`);
        continue;
      }

      let unitPrice: number;
      let lineName = product.name;
      let lineSize: string | null = null;

      if (item.variantId) {
        const variant = await prisma.productVariant.findFirst({
          where: { id: item.variantId, productId: item.productId },
        });
        if (!variant) {
          stockErrors.push(`Variant ${item.variantId} not found for product ${product.name}`);
          continue;
        }
        unitPrice = variant.price;
        lineSize  = variant.size;
      } else {
        unitPrice = product.mrp;
      }

      // Fetch FEFO-ordered batches for this product (+ variant scope, if applicable)
      const batches = await prisma.productBatch.findMany({
        where: {
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : { variantId: null }),
          remainingQty: { gt: 0 },
        },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, remainingQty: true },
      });

      const fefoBatches: FefoBatch[] = batches.map(b => ({ id: b.id, remainingQty: b.remainingQty }));
      const { deductions, shortfall } = allocateFefoDeduction(fefoBatches, item.quantity);

      if (shortfall > 0) {
        stockErrors.push(
          `Insufficient stock for "${lineName}${lineSize ? ` (${lineSize})` : ''}" — short by ${shortfall} unit(s)`
        );
        continue;
      }

      const lineTotal = calculateLineTotal(unitPrice, item.quantity, item.discount);

      resolvedLines.push({
        productId:    item.productId,
        variantId:    item.variantId ?? null,
        name:         lineName,
        size:         lineSize,
        unitPrice,
        quantity:     item.quantity,
        lineDiscount: item.discount,
        lineTotal,
        deductions,
      });
    }

    // Fail fast — no partial bills if ANY line has a problem
    if (stockErrors.length > 0) {
      return badRequest('Cannot complete bill', { items: stockErrors });
    }

    const totals = calculateBillTotals(
      resolvedLines.map(l => l.lineTotal),
      data.billDiscount,
      taxSettings
    );

    const changeAmount = data.paidAmount !== undefined
      ? calculateChange(totals.total, data.paidAmount)
      : null;

    // Generate bill number: count today's bills for this tenant + 1
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.bill.count({
      where: { tenantId, createdAt: { gte: todayStart } },
    });
    const billNumber = generateBillNumber(new Date(), todayCount + 1);

    // Transaction: create Bill, explode lines into BillItems per batch,
    // decrement all the stock counters, record the Sale.
    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.create({
        data: {
          tenantId,
          billNumber,
          subtotal:     totals.subtotal,
          discount:     totals.effectiveDiscount,
          taxAmount:    totals.taxAmount,
          total:        totals.total,
          paymentMode:  data.paymentMode,
          note:         data.note ?? null,
          paidAmount:   data.paidAmount ?? null,
          changeAmount,
          employeeId:   auth.userId,
        },
      });

      for (const line of resolvedLines) {
        // Distribute line discount and total proportionally across the
        // batches touched, weighted by quantity deducted from each.
        for (const d of line.deductions) {
          const shareRatio = d.deduct / line.quantity;
          const itemTotal = Math.round(line.lineTotal * shareRatio * 100) / 100;
          const itemDiscount = Math.round(line.lineDiscount * shareRatio * 100) / 100;

          await tx.billItem.create({
            data: {
              billId:    bill.id,
              productId: line.productId,
              variantId: line.variantId,
              batchId:   d.batchId,
              name:      line.name,
              size:      line.size,
              price:     line.unitPrice,
              quantity:  d.deduct,
              discount:  itemDiscount,
              total:     itemTotal,
            },
          });

          // Deduct batch stock
          await tx.productBatch.update({
            where: { id: d.batchId },
            data:  { remainingQty: { decrement: d.deduct } },
          });
        }

        // Sync denormalized counters for the whole line quantity
        await tx.inventory.update({
          where: { productId_tenantId: { productId: line.productId, tenantId } },
          data:  { quantity: { decrement: line.quantity } },
        });

        if (line.variantId) {
          await tx.productVariant.update({
            where: { id: line.variantId },
            data:  { stock: { decrement: line.quantity } },
          });
        }
      }

      // Record the sale
      await tx.sale.create({
        data: {
          tenantId,
          amount:      totals.total,
          source:      'BILLING',
          referenceId: bill.id,
          employeeId:  auth.userId,
        },
      });

      return bill;
    });

    return created(
      {
        bill: {
          id:           result.id,
          billNumber:   result.billNumber,
          subtotal:     totals.subtotal,
          discount:     totals.effectiveDiscount,
          taxAmount:    totals.taxAmount,
          cgstAmount:   totals.cgstAmount,
          sgstAmount:   totals.sgstAmount,
          total:        totals.total,
          paymentMode:  result.paymentMode,
          paidAmount:   result.paidAmount,
          changeAmount: result.changeAmount,
          createdAt:    result.createdAt,
        },
      },
      `Bill ${result.billNumber} created`
    );
  } catch (error) {
    return serverError(error);
  }
}
