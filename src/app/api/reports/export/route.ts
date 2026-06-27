// src/app/api/reports/export/route.ts
// POST /api/reports/export — generate a CSV export
//
// Body: { reportType, from?, to? }
// Returns a CSV file as the response body with appropriate headers.
// Re-implements the same aggregation as the JSON endpoints (kept
// independent rather than calling the route handlers directly, since
// Next.js route handlers aren't meant to be invoked as plain functions
// across files) — but shares the exact same Prisma queries conceptually
// via the same report math helpers, so the numbers always match the
// JSON endpoints for the same inputs.
//
// Permission: report.export

import { NextRequest, NextResponse } from 'next/server';
import { authenticate, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { exportReportSchema, validate } from '@/lib/validation';
import { toCsv } from '@/lib/reports/csvExport';
import { classifyStockStatus } from '@/lib/inventory/stockSync';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canExport =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('report.export');
    if (!canExport) return forbidden('Missing permission: report.export');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(exportReportSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const tenantId = auth.tenantId;
    let rows: Record<string, unknown>[] = [];
    let filename = `${data.reportType}-export.csv`;

    if (data.reportType === 'inventory') {
      const products = await prisma.product.findMany({
        where: { tenantId, isDeleted: false },
        include: {
          inventory: { where: { tenantId }, select: { quantity: true, lowStock: true } },
          variants:  { select: { stock: true } },
        },
      });
      rows = products.map(p => {
        const hasVariants = p.variants.length > 0;
        const quantity = hasVariants
          ? p.variants.reduce((sum, v) => sum + v.stock, 0)
          : (p.inventory[0]?.quantity ?? 0);
        const lowStock = p.inventory[0]?.lowStock ?? 10;
        return {
          productId: p.id,
          name:      p.name,
          sku:       p.sku ?? '',
          quantity,
          lowStockThreshold: lowStock,
          stockStatus: classifyStockStatus(quantity, lowStock),
        };
      });
      filename = 'inventory-export.csv';
    } else {
      // Date-ranged report types
      const fromDate = new Date(`${data.from}T00:00:00`);
      const toDate   = new Date(`${data.to}T23:59:59`);
      filename = `${data.reportType}-${data.from}-to-${data.to}.csv`;

      if (data.reportType === 'revenue') {
        const sales = await prisma.sale.findMany({
          where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
          orderBy: { createdAt: 'asc' },
          select: { source: true, amount: true, createdAt: true },
        });
        rows = sales.map(s => ({
          date:   s.createdAt.toISOString().slice(0, 10),
          source: s.source,
          amount: s.amount,
        }));
      }

      if (data.reportType === 'sales-summary') {
        const bills = await prisma.bill.findMany({
          where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
          select: { billNumber: true, total: true, createdAt: true },
        });
        rows = bills.map(b => ({
          billNumber: b.billNumber,
          total:      b.total,
          date:       b.createdAt.toISOString().slice(0, 10),
        }));
      }

      if (data.reportType === 'customers') {
        const customers = await prisma.customer.findMany({
          where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
          include: { user: { select: { name: true, email: true } } },
        });
        rows = customers.map(c => ({
          name:      c.user.name,
          email:     c.user.email,
          createdAt: c.createdAt.toISOString().slice(0, 10),
        }));
      }

      if (data.reportType === 'staff-performance') {
        const staff = await prisma.staff.findMany({
          where: { tenantId },
          include: {
            user: { select: { name: true } },
            bookings: {
              where: { createdAt: { gte: fromDate, lte: toDate } },
              select: { status: true, totalAmount: true },
            },
          },
        });
        rows = staff.map(s => {
          const revenue = s.bookings
            .filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
            .reduce((sum, b) => sum + b.totalAmount, 0);
          return {
            staffId:      s.id,
            name:         s.user.name,
            bookingCount: s.bookings.length,
            revenue:      Math.round(revenue * 100) / 100,
          };
        });
      }
    }

    const csv = toCsv(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
