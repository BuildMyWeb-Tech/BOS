// src/app/api/services/route.ts
// GET  /api/services — list services for tenant (filters: categoryId, isActive, search)
// POST /api/services — create a service
//
// Permission: booking.view (GET), booking.create (POST)

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, conflict, serverError,
  parsePagination, paginationSkip,
} from '@/lib/api-helpers';
import { serviceSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ─── GET /api/services ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { searchParams } = request.nextUrl;
    const pagination      = parsePagination(searchParams);
    const categoryId      = searchParams.get('categoryId') ?? undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Prisma.ServiceWhereInput = {
      tenantId: auth.tenantId,
      ...(!includeInactive && { isActive: true }),
      ...(categoryId && { categoryId }),
    };

    if (pagination.search) {
      where.OR = [
        { name:        { contains: pagination.search, mode: 'insensitive' } },
        { description: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip:    paginationSkip(pagination),
        take:    pagination.limit,
        orderBy: { name: 'asc' },
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.service.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.limit);

    return ok({
      items: services.map(s => ({
        id:          s.id,
        tenantId:    s.tenantId,
        categoryId:  s.categoryId,
        category:    s.category,
        name:        s.name,
        description: s.description,
        duration:    s.duration,
        price:       s.price,
        isActive:    s.isActive,
        image:       s.image,
        createdAt:   s.createdAt,
        updatedAt:   s.updatedAt,
      })),
      pagination: {
        total, page: pagination.page, limit: pagination.limit,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── POST /api/services ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canCreate =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('booking.create');
    if (!canCreate) return forbidden('Missing permission: booking.create');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(serviceSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Unique name within tenant
    const existing = await prisma.service.findFirst({
      where: { name: data.name, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (existing) return conflict(`Service "${data.name}" already exists`);

    // Validate category belongs to this tenant (if provided)
    if (data.categoryId) {
      const cat = await prisma.serviceCategory.findFirst({
        where:  { id: data.categoryId, tenantId: auth.tenantId, isActive: true },
        select: { id: true },
      });
      if (!cat) return badRequest('Category not found or inactive');
    }

    const service = await prisma.service.create({
      data: {
        tenantId:    auth.tenantId,
        name:        data.name,
        description: data.description ?? '',
        duration:    data.duration,
        price:       data.price,
        categoryId:  data.categoryId ?? null,
        image:       data.image ?? '',
        isActive:    true,
      },
      include: { category: { select: { id: true, name: true } } },
    });

    return created(
      {
        service: {
          id:          service.id,
          tenantId:    service.tenantId,
          categoryId:  service.categoryId,
          category:    service.category,
          name:        service.name,
          description: service.description,
          duration:    service.duration,
          price:       service.price,
          isActive:    service.isActive,
          image:       service.image,
          createdAt:   service.createdAt,
          updatedAt:   service.updatedAt,
        },
      },
      `Service "${service.name}" created`
    );
  } catch (error) {
    return serverError(error);
  }
}
