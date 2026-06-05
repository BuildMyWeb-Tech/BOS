// src/lib/validation.ts
//
// Zod validation schemas for BOS API inputs.
// Every API route validates its input using these schemas before touching the DB.
// This is the single source of truth for input shapes and error messages.

import { z } from 'zod';

// ─── Reusable field schemas ───────────────────────────────────────

const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Invalid email address');

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long');

const nameSchema = z
  .string({ required_error: 'Name is required' })
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name is too long')
  .trim();

const phoneSchema = z
  .string()
  .regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number')
  .optional();

// ─── Auth schemas ─────────────────────────────────────────────────

export const loginSchema = z.object({
  email:    emailSchema,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name:     nameSchema,
  email:    emailSchema,
  password: passwordSchema,
  phone:    phoneSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string({ required_error: 'Refresh token is required' }).min(1),
});

// ─── Vendor Registration schema ───────────────────────────────────
// Used by POST /api/tenants/register
// Owner credentials are collected at registration and used to create
// the VENDOR_OWNER user account on approval.

export const vendorRegisterSchema = z.object({
  // Business info
  businessName: z
    .string({ required_error: 'Business name is required' })
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name is too long')
    .trim(),

  businessType: z
    .string({ required_error: 'Business type is required' })
    .min(2, 'Business type is required')
    .max(50, 'Business type is too long')
    .trim(),

  description: z
    .string()
    .max(500, 'Description must be under 500 characters')
    .trim()
    .optional(),

  address: z
    .string({ required_error: 'Address is required' })
    .min(5, 'Please enter a valid address')
    .max(300, 'Address is too long')
    .trim(),

  phone: z
    .string({ required_error: 'Phone is required' })
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number'),

  website: z
    .string()
    .url('Invalid website URL')
    .optional()
    .or(z.literal('')),

  // Module selection — at least one must be enabled
  modules: z
    .object({
      booking:   z.boolean().default(false),
      inventory: z.boolean().default(false),
      billing:   z.boolean().default(false),
      ecommerce: z.boolean().default(false),
    })
    .refine(
      (m) => m.booking || m.inventory || m.billing || m.ecommerce,
      { message: 'At least one module must be selected' }
    ),

  // Owner account — created when vendor is approved
  ownerName:     nameSchema,
  ownerEmail:    emailSchema,
  ownerPassword: passwordSchema,
  ownerPhone:    phoneSchema,
});

// Used by PATCH /api/super-admin/vendors/[id]/reject
export const rejectVendorSchema = z.object({
  reason: z
    .string({ required_error: 'Rejection reason is required' })
    .min(10, 'Please provide a reason (min 10 characters)')
    .max(500, 'Reason is too long')
    .trim(),
});

// ─── Type inference from schemas ──────────────────────────────────

export type LoginInput          = z.infer<typeof loginSchema>;
export type RegisterInput       = z.infer<typeof registerSchema>;
export type RefreshInput        = z.infer<typeof refreshSchema>;
export type VendorRegisterInput = z.infer<typeof vendorRegisterSchema>;
export type RejectVendorInput   = z.infer<typeof rejectVendorSchema>;

// ─── Validation helper ────────────────────────────────────────────

/**
 * Validate unknown input against a Zod schema.
 * Returns { data } on success or { errors } on failure.
 *
 * errors shape: { fieldName: ["error message", ...], ... }
 * This matches ApiError.details in types/index.ts.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { data: T; errors: null } | { data: null; errors: Record<string, string[]> } {
  const result = schema.safeParse(input);

  if (result.success) {
    return { data: result.data, errors: null };
  }

  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || 'root';
    if (!errors[field]) errors[field] = [];
    errors[field].push(issue.message);
  }

  return { data: null, errors };
}
