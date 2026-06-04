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

// ─── Type inference from schemas ──────────────────────────────────

export type LoginInput    = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshInput  = z.infer<typeof refreshSchema>;

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
