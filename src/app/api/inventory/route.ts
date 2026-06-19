// src/app/api/inventory/route.ts
// GET /api/inventory — current stock levels for every product in the tenant
//
// Optional query: ?stockStatus=low_stock|out_of_stock|in_stock
// Permission: inventory.view

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError, parsePagination, paginationSkip } from '@/lib/api-helpers';
import { classifyStockStatus } from '@/lib/inventory/stockSync';
import prisma from '@/lib/prisma';
import type { StockStatus } from '@/types';

const VALID_STATUSES: StockStatus[] = ['in_stock', 'low_stock', 'out_of_stock'];

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canView =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('inventory.view');
    if (!canView) return forbidden('Missing permission: inventory.view');

    const { searchParams } = request.nextUrl;
    const pagination = parsePagination(searchParams);
    const stockStatusFilter = searchParams.get('stockStatus') as StockStatus | null;

    if (stockStatusFilter && !VALID_STATUSES.includes(stockStatusFilter)) {
      return badRequest(`stockStatus must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const inventoryRows = await prisma.inventory.findMany({
      where: { tenantId: auth.tenantId },
      include: {
        product: { select: { id: true, name: true, sku: true, isDeleted: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    let items = inventoryRows
      .filter(row => !row.product.isDeleted)
      .map(row => ({
        productId:   row.productId,
        productName: row.product.name,
        sku:         row.product.sku,
        quantity:    row.quantity,
        lowStock:    row.lowStock,
        stockStatus: classifyStockStatus(row.quantity, row.lowStock),
        updatedAt:   row.updatedAt,
      }));

    if (stockStatusFilter) {
      items = items.filter(i => i.stockStatus === stockStatusFilter);
    }

    const total = items.length;
    const totalPages = Math.ceil(total / pagination.limit);
    const paged = items.slice(paginationSkip(pagination), paginationSkip(pagination) + pagination.limit);

    return ok({
      items: paged,
      summary: {
        total,
        inStock:    items.filter(i => i.stockStatus === 'in_stock').length,
        lowStock:   items.filter(i => i.stockStatus === 'low_stock').length,
        outOfStock: items.filter(i => i.stockStatus === 'out_of_stock').length,
      },
      pagination: {
        total, page: pagination.page, limit: pagination.limit,
        totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
