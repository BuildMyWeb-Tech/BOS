// src/lib/tenant.ts
//
// Tenant resolution logic.
//
// Development:  acmesalon.localhost:3000  →  slug = "acmesalon"
// Production:   salonabc.com             →  customDomain lookup
//
// The middleware calls resolveTenantFromHost() on every request.
// API routes can call getTenantBySlug() or getTenantById() directly.

import prisma from '@/lib/prisma';
import type { Tenant } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────

export interface ResolvedTenant {
  id:          string;
  slug:        string;
  name:        string;
  isActive:    boolean;
  status:      string;
  modules:     Record<string, boolean>;
  customDomain: string | null;
}

// ─── Host parsing ─────────────────────────────────────────────────

/**
 * Parse the host header into { subdomain, hostname }.
 *
 * Examples:
 *   "acmesalon.localhost:3000"  →  { subdomain: "acmesalon", hostname: "localhost" }
 *   "salonabc.com"              →  { subdomain: null,         hostname: "salonabc.com" }
 *   "localhost:3000"            →  { subdomain: null,         hostname: "localhost" }
 *   "www.salonabc.com"          →  { subdomain: "www",        hostname: "salonabc.com" }
 */
export function parseHost(host: string): { subdomain: string | null; hostname: string } {
  // Strip port
  const hostWithoutPort = host.split(':')[0];
  const parts = hostWithoutPort.split('.');

  if (parts.length < 2) {
    // Just "localhost" — no subdomain
    return { subdomain: null, hostname: hostWithoutPort };
  }

  if (parts[parts.length - 1] === 'localhost') {
    // Pattern: subdomain.localhost
    const subdomain = parts.slice(0, -1).join('.');
    return { subdomain, hostname: 'localhost' };
  }

  // Pattern: subdomain.domain.tld OR domain.tld
  if (parts.length >= 3) {
    const subdomain = parts.slice(0, parts.length - 2).join('.');
    const hostname  = parts.slice(parts.length - 2).join('.');
    return { subdomain, hostname };
  }

  // Pattern: domain.tld  (no subdomain)
  return { subdomain: null, hostname: hostWithoutPort };
}

// ─── DB lookups ───────────────────────────────────────────────────

/**
 * Resolve a tenant from the HTTP host header.
 * Returns null if no tenant matches (e.g. bare localhost).
 */
export async function resolveTenantFromHost(host: string): Promise<ResolvedTenant | null> {
  const { subdomain, hostname } = parseHost(host);

  let tenant: Tenant | null = null;

  if (subdomain && subdomain !== 'www') {
    // Development: match by slug
    // Production subdomain: also match by slug first
    tenant = await prisma.tenant.findUnique({
      where: { slug: subdomain },
    });
  }

  if (!tenant && hostname !== 'localhost') {
    // Production: match by custom domain
    tenant = await prisma.tenant.findUnique({
      where: { customDomain: hostname },
    });
  }

  if (!tenant) return null;

  return toResolvedTenant(tenant);
}

export async function getTenantBySlug(slug: string): Promise<ResolvedTenant | null> {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  return tenant ? toResolvedTenant(tenant) : null;
}

export async function getTenantById(id: string): Promise<ResolvedTenant | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  return tenant ? toResolvedTenant(tenant) : null;
}

// ─── Module helpers ───────────────────────────────────────────────

/**
 * Check if a tenant has a specific module enabled.
 *
 * Example:
 *   isModuleEnabled(tenant.modules, 'booking')  →  true | false
 */
export function isModuleEnabled(
  modules: Record<string, boolean>,
  moduleName: string
): boolean {
  return modules[moduleName] === true;
}

// ─── Internal helpers ─────────────────────────────────────────────

function toResolvedTenant(tenant: Tenant): ResolvedTenant {
  return {
    id:          tenant.id,
    slug:        tenant.slug,
    name:        tenant.name,
    isActive:    tenant.isActive,
    status:      tenant.status,
    modules:     (tenant.modules as Record<string, boolean>) ?? {},
    customDomain: tenant.customDomain,
  };
}
