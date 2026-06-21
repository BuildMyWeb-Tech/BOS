// src/app/api/addresses/route.ts
// GET  /api/addresses — list the authenticated customer's saved addresses
// POST /api/addresses — add a new address

import { NextRequest } from 'next/server';
import { authenticate, ok, created, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { createAddressSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const addresses = await prisma.address.findMany({
      where:   { userId: auth.userId, tenantId: auth.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return ok({
      addresses: addresses.map(a => ({
        id: a.id, name: a.name, email: a.email, street: a.street,
        city: a.city, state: a.state, zip: a.zip, country: a.country,
        phone: a.phone, createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(createAddressSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const address = await prisma.address.create({
      data: {
        tenantId: auth.tenantId,
        userId:   auth.userId,
        name:     data.name,
        email:    data.email,
        street:   data.street,
        city:     data.city,
        state:    data.state,
        zip:      data.zip,
        country:  data.country,
        phone:    data.phone,
      },
    });

    return created(
      {
        address: {
          id: address.id, name: address.name, email: address.email, street: address.street,
          city: address.city, state: address.state, zip: address.zip, country: address.country,
          phone: address.phone, createdAt: address.createdAt,
        },
      },
      'Address added'
    );
  } catch (error) {
    return serverError(error);
  }
}
