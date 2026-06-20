// src/app/api/bills/[id]/route.ts
// GET /api/bills/[id] — full bill detail with line items
//
// Permission: billing.view

import { NextRequest } from 'next/server';
import { authenticate, ok, forbidden, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canView =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('billing.view');
    if (!canView) return forbidden('Missing permission: billing.view');

    const { id } = await params;

    const bill = await prisma.bill.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        employee: { select: { name: true } },
        items:    { orderBy: { id: 'asc' } },
      },
    });

    if (!bill) return notFound('Bill');

    return ok({
      bill: {
        id:           bill.id,
        tenantId:     bill.tenantId,
        billNumber:   bill.billNumber,
        subtotal:     bill.subtotal,
        discount:     bill.discount,
        taxAmount:    bill.taxAmount,
        total:        bill.total,
        paymentMode:  bill.paymentMode,
        note:         bill.note,
        paidAmount:   bill.paidAmount,
        changeAmount: bill.changeAmount,
        employeeId:   bill.employeeId,
        employeeName: bill.employee?.name ?? null,
        items: bill.items.map(i => ({
          id:        i.id,
          productId: i.productId,
          variantId: i.variantId,
          batchId:   i.batchId,
          name:      i.name,
          size:      i.size,
          price:     i.price,
          quantity:  i.quantity,
          discount:  i.discount,
          total:     i.total,
        })),
        createdAt: bill.createdAt,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
