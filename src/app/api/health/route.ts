// src/app/api/health/route.ts
// GET /api/health
// Returns DB connectivity status and environment sanity check.
// Used in Phase 1A testing to verify the stack is wired up correctly.

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const checks: Record<string, boolean | string> = {
    server:      true,
    database:    false,
    jwt_secret:  !!process.env.JWT_SECRET,
    database_url: !!process.env.DATABASE_URL,
  };

  try {
    // Simple DB ping — count tenants (will be 0 on fresh install, that's fine)
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (err) {
    checks.database       = false;
    checks.database_error = err instanceof Error ? err.message : 'Unknown error';
  }

  const allHealthy = checks.database === true && checks.jwt_secret === true;

  return NextResponse.json(
    {
      status:    allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  );
}
