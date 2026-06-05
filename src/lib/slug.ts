// src/lib/slug.ts
//
// Slug generation for tenant registration.
// "Acme Salon" → "acme-salon"
// If "acme-salon" is taken → "acme-salon-x4k2" (random 4-char suffix)
//
// Slugs are used as:
//   - Dev subdomain:  acme-salon.localhost:3000
//   - URL path:       /shop/acme-salon
//   - Future domain:  acmesalon.com (customDomain field, separate)

import prisma from '@/lib/prisma';

/**
 * Convert a business name into a URL-safe slug.
 *
 * Rules:
 *   - Lowercase
 *   - Spaces and special chars → hyphens
 *   - Multiple hyphens collapsed
 *   - Leading/trailing hyphens removed
 *   - Max 50 chars
 *
 * Examples:
 *   "Acme Salon & Spa"  → "acme-salon-spa"
 *   "Dr. John's Clinic" → "dr-johns-clinic"
 *   "  My   Gym  "      → "my-gym"
 */
export function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // remove non-alphanumeric (keep spaces and hyphens)
    .replace(/[\s-]+/g, '-')         // collapse spaces/hyphens into single hyphen
    .replace(/^-+|-+$/g, '')         // strip leading/trailing hyphens
    .slice(0, 50);                   // max length
}

/**
 * Generate a random 4-character alphanumeric suffix.
 * Used when the base slug is already taken.
 * Example: "x4k2"
 */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

/**
 * Generate a unique slug for a new tenant.
 * Checks the DB and appends a random suffix if the base slug is taken.
 *
 * Algorithm:
 *   1. Generate base slug from name
 *   2. Check DB — if free, return it
 *   3. If taken, try base-slug + random suffix up to 5 times
 *   4. If all 5 attempts fail (extremely unlikely), throw
 */
export async function generateUniqueSlug(businessName: string): Promise<string> {
  const base = generateSlugFromName(businessName);

  if (!base) {
    throw new Error('Business name produced an empty slug. Please use alphanumeric characters.');
  }

  // Try base slug first
  const existing = await prisma.tenant.findUnique({
    where:  { slug: base },
    select: { id: true },
  });

  if (!existing) return base;

  // Base is taken — try with random suffixes
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomSuffix()}`;
    const conflict = await prisma.tenant.findUnique({
      where:  { slug: candidate },
      select: { id: true },
    });
    if (!conflict) return candidate;
  }

  // Extremely unlikely — throw so the caller can surface a proper error
  throw new Error('Could not generate a unique slug. Please try a different business name.');
}
