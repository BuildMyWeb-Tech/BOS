// middleware.ts  (root of project, NOT inside src/)
//
// Runs on every matched request BEFORE the page/route handler.
// Responsibilities:
//   1. Resolve tenant from hostname → inject as request headers
//   2. Block inactive/rejected tenants
//   3. Protect /dashboard and /super-admin routes (auth check)
//
// NOTE: This middleware runs in the Edge Runtime.
// It must NOT import prisma (Node.js only) or heavy server modules.
// Tenant DB lookup is done via a lightweight fetch to an internal API route.

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

// ─── Route matchers ───────────────────────────────────────────────

const PROTECTED_DASHBOARD   = /^\/dashboard(\/.*)?$/;
const PROTECTED_SUPER_ADMIN = /^\/super-admin(\/.*)?$/;
const PUBLIC_PATHS = [
  /^\/$/,
  /^\/login(\/.*)?$/,
  /^\/register(\/.*)?$/,
  /^\/api\/auth\/(login|register|refresh)/,
  /^\/_next\//,
  /^\/favicon/,
  /^\/public\//,
];

// ─── Middleware ───────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') ?? '';

  // ── Step 1: Resolve tenant from hostname ──────────────────────
  const tenantInfo = resolveTenantFromHostEdge(host);

  // Build a response object so we can inject headers
  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  // Inject tenant context as headers so API routes and pages can read them
  // without another DB call (they re-verify from the DB when needed).
  if (tenantInfo) {
    response.headers.set('x-tenant-slug',    tenantInfo.slug);
    response.headers.set('x-tenant-id',      tenantInfo.id ?? '');
    response.headers.set('x-is-tenant-host', 'true');
  } else {
    response.headers.set('x-is-tenant-host', 'false');
  }

  // ── Step 2: Auth protection ───────────────────────────────────
  const isPublic = PUBLIC_PATHS.some(pattern => pattern.test(pathname));

  if (!isPublic) {
    if (PROTECTED_DASHBOARD.test(pathname) || PROTECTED_SUPER_ADMIN.test(pathname)) {
      const token = extractBearerToken(request);

      if (!token) {
        return redirectToLogin(request);
      }

      const payload = verifyAccessToken(token);

      if (!payload) {
        return redirectToLogin(request);
      }

      // Super-admin routes: only SUPER_ADMIN role allowed
      if (PROTECTED_SUPER_ADMIN.test(pathname) && payload.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Super Admin only' },
          { status: 403 }
        );
      }

      // Dashboard routes: SUPER_ADMIN, VENDOR_OWNER, STAFF allowed
      if (
        PROTECTED_DASHBOARD.test(pathname) &&
        payload.role === 'CUSTOMER'
      ) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // Inject user context into headers
      response.headers.set('x-user-id',       payload.userId);
      response.headers.set('x-user-role',      payload.role);
      response.headers.set('x-user-tenant-id', payload.tenantId ?? '');
    }
  }

  return response;
}

// ─── Edge-safe tenant resolution (NO DB call) ────────────────────
// The middleware only parses the host to extract the slug.
// Actual DB validation happens in the API route / server component.

function resolveTenantFromHostEdge(
  host: string
): { slug: string; id: string } | null {
  const hostWithoutPort = host.split(':')[0];
  const parts = hostWithoutPort.split('.');

  // acmesalon.localhost
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    const slug = parts.slice(0, -1).join('.');
    if (slug && slug !== 'www') return { slug, id: '' };
    return null;
  }

  // acmesalon.yourdomain.com  (3+ parts)
  if (parts.length >= 3) {
    const slug = parts.slice(0, parts.length - 2).join('.');
    if (slug && slug !== 'www') return { slug, id: '' };
  }

  // bare domain — no tenant slug (e.g. localhost:3000, yourdomain.com)
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────

function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();

  // Also accept token from cookie (for browser navigation)
  const cookieToken = request.cookies.get('bos_token')?.value;
  return cookieToken ?? null;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// ─── Config: which paths to run middleware on ─────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
