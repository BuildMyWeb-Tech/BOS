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

// Date string: "YYYY-MM-DD"
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

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

export const vendorRegisterSchema = z.object({
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
  ownerName:     nameSchema,
  ownerEmail:    emailSchema,
  ownerPassword: passwordSchema,
  ownerPhone:    phoneSchema,
});

export const rejectVendorSchema = z.object({
  reason: z
    .string({ required_error: 'Rejection reason is required' })
    .min(10, 'Please provide a reason (min 10 characters)')
    .max(500, 'Reason is too long')
    .trim(),
});

// ─── Staff schemas ────────────────────────────────────────────────

// POST /api/staff — create a new staff member
export const createStaffSchema = z.object({
  name:     nameSchema,
  email:    emailSchema,
  password: passwordSchema,
  phone:    phoneSchema,
  bio: z
    .string()
    .max(300, 'Bio must be under 300 characters')
    .trim()
    .optional(),
  // Subset of permission codes to grant — defaults to STAFF system role if omitted
  permissions: z
    .array(z.string().min(1))
    .optional(),
});

// PATCH /api/staff/[id] — update staff profile fields
export const updateStaffSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long')
    .trim()
    .optional(),
  phone: phoneSchema,
  bio: z
    .string()
    .max(300, 'Bio must be under 300 characters')
    .trim()
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

// PATCH /api/staff/[id]/permissions — replace staff permission set
export const updatePermissionsSchema = z.object({
  permissions: z
    .array(z.string().min(1), { required_error: 'Permissions array is required' })
    .min(1, 'At least one permission must be assigned'),
});

// PATCH /api/staff/[id]/leave-dates — manage leave dates
export const updateLeaveDatesSchema = z.object({
  leaveDates: z
    .array(dateStringSchema, { required_error: 'leaveDates array is required' })
    .max(365, 'Cannot have more than 365 leave dates'),
});

// ─── Type inference from schemas ──────────────────────────────────

export type LoginInput            = z.infer<typeof loginSchema>;
export type RegisterInput         = z.infer<typeof registerSchema>;
export type RefreshInput          = z.infer<typeof refreshSchema>;
export type VendorRegisterInput   = z.infer<typeof vendorRegisterSchema>;
export type RejectVendorInput     = z.infer<typeof rejectVendorSchema>;
export type CreateStaffInput      = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput      = z.infer<typeof updateStaffSchema>;
export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;
export type UpdateLeaveDatesInput = z.infer<typeof updateLeaveDatesSchema>;

// ─── Validation helper ────────────────────────────────────────────

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

// ─── Service Category schemas ─────────────────────────────────────

export const serviceCategorySchema = z.object({
  name: z
    .string({ required_error: 'Category name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be under 80 characters')
    .trim(),
  description: z
    .string()
    .max(300, 'Description must be under 300 characters')
    .trim()
    .optional(),
});

export const updateServiceCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be under 80 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(300, 'Description must be under 300 characters')
    .trim()
    .optional(),
  isActive: z.boolean().optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── Service schemas ──────────────────────────────────────────────

export const serviceSchema = z.object({
  name: z
    .string({ required_error: 'Service name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be under 500 characters')
    .trim()
    .optional(),
  duration: z
    .number({ required_error: 'Duration is required' })
    .int('Duration must be a whole number of minutes')
    .min(5,    'Minimum duration is 5 minutes')
    .max(480,  'Maximum duration is 480 minutes (8 hours)'),
  price: z
    .number({ required_error: 'Price is required' })
    .min(0, 'Price cannot be negative')
    .max(1_000_000, 'Price is too large'),
  categoryId: z
    .string()
    .cuid('Invalid category ID')
    .optional()
    .nullable(),
  image: z
    .string()
    .url('Invalid image URL')
    .optional()
    .or(z.literal('')),
});

export const updateServiceSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be under 500 characters')
    .trim()
    .optional(),
  duration: z
    .number()
    .int('Duration must be a whole number')
    .min(5,   'Minimum duration is 5 minutes')
    .max(480, 'Maximum duration is 480 minutes')
    .optional(),
  price: z
    .number()
    .min(0, 'Price cannot be negative')
    .max(1_000_000, 'Price is too large')
    .optional(),
  categoryId: z
    .string()
    .cuid('Invalid category ID')
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
  image: z
    .string()
    .url('Invalid image URL')
    .optional()
    .or(z.literal('')),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── Resource schemas ─────────────────────────────────────────────

const RESOURCE_TYPES = ['court', 'room', 'table', 'equipment', 'other'] as const;

export const resourceSchema = z.object({
  name: z
    .string({ required_error: 'Resource name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be under 80 characters')
    .trim(),
  type: z.enum(RESOURCE_TYPES, {
    errorMap: () => ({ message: `Type must be one of: ${RESOURCE_TYPES.join(', ')}` }),
  }),
  description: z
    .string()
    .max(300, 'Description must be under 300 characters')
    .trim()
    .optional(),
});

export const updateResourceSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be under 80 characters')
    .trim()
    .optional(),
  type: z.enum(RESOURCE_TYPES).optional(),
  description: z
    .string()
    .max(300, 'Description must be under 300 characters')
    .trim()
    .optional(),
  isActive: z.boolean().optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── Slot Config schema ───────────────────────────────────────────

// Time string "HH:MM" — 24-hour format
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format (24-hour)');

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export const slotConfigSchema = z.object({
  slotStartTime: timeSchema.default('09:00'),
  slotEndTime:   timeSchema.default('17:00'),
  slotDuration: z
    .number()
    .int()
    .refine(v => [15, 30, 45, 60, 90, 120].includes(v), {
      message: 'Slot duration must be 15, 30, 45, 60, 90, or 120 minutes',
    })
    .default(30),

  breakEnabled:   z.boolean().default(false),
  breakStartTime: timeSchema.optional().nullable(),
  breakEndTime:   timeSchema.optional().nullable(),

  daysOpen: z
    .array(z.enum(DAYS_OF_WEEK))
    .min(1, 'At least one working day must be selected')
    .default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),

  maxAdvanceBookingDays: z
    .number().int().min(1).max(365)
    .default(30),
  minBookingHoursBefore: z
    .number().int().min(0).max(72)
    .default(2),

  allowRescheduling:     z.boolean().default(true),
  rescheduleHoursBefore: z
    .number().int().min(0).max(168)
    .default(24),

  advancePaymentRequired: z.boolean().default(true),
  advancePaymentPercent: z
    .number()
    .int()
    .refine(v => [10, 20, 25, 50, 75, 100].includes(v), {
      message: 'Advance payment percent must be 10, 20, 25, 50, 75, or 100',
    })
    .default(100),
}).refine(
  d => {
    // End time must be after start time
    if (d.slotStartTime && d.slotEndTime) {
      return d.slotEndTime > d.slotStartTime;
    }
    return true;
  },
  { message: 'Slot end time must be after start time', path: ['slotEndTime'] }
).refine(
  d => {
    // If break enabled, both times must be present
    if (d.breakEnabled) {
      return !!d.breakStartTime && !!d.breakEndTime;
    }
    return true;
  },
  { message: 'Break start and end times are required when break is enabled', path: ['breakStartTime'] }
).refine(
  d => {
    // Break times must be within working hours
    if (d.breakEnabled && d.breakStartTime && d.breakEndTime) {
      return d.breakStartTime > d.slotStartTime &&
             d.breakEndTime   < d.slotEndTime   &&
             d.breakEndTime   > d.breakStartTime;
    }
    return true;
  },
  { message: 'Break times must be within working hours and break end must be after break start', path: ['breakEndTime'] }
);

// ─── Type exports ─────────────────────────────────────────────────

export type ServiceCategoryInput       = z.infer<typeof serviceCategorySchema>;
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>;
export type ServiceInput               = z.infer<typeof serviceSchema>;
export type UpdateServiceInput         = z.infer<typeof updateServiceSchema>;
export type ResourceInput              = z.infer<typeof resourceSchema>;
export type UpdateResourceInput        = z.infer<typeof updateResourceSchema>;
export type SlotConfigInput            = z.infer<typeof slotConfigSchema>;

// ─── Holiday Management schemas ───────────────────────────────────

// POST /api/holidays/blocked-dates
export const blockedDateSchema = z.object({
  date: dateStringSchema,
  reason: z
    .string()
    .max(200, 'Reason must be under 200 characters')
    .trim()
    .optional(),
});

// POST /api/holidays/recurring
const RECURRING_TYPES = ['weekly', 'monthly'] as const;

export const recurringHolidaySchema = z.object({
  name: z
    .string({ required_error: 'Holiday name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters')
    .trim(),
  type: z.enum(RECURRING_TYPES, {
    errorMap: () => ({ message: 'Type must be "weekly" or "monthly"' }),
  }),
  value: z.string({ required_error: 'Value is required' }),
}).superRefine((d, ctx) => {
  if (d.type === 'weekly') {
    const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (!validDays.includes(d.value)) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        message: `For weekly holidays, value must be one of: ${validDays.join(', ')}`,
        path:    ['value'],
      });
    }
  }
  if (d.type === 'monthly') {
    const dayNum = Number(d.value);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        message: 'For monthly holidays, value must be a day of month between 1 and 31',
        path:    ['value'],
      });
    }
  }
});

export const updateRecurringHolidaySchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters')
    .trim()
    .optional(),
  type:  z.enum(RECURRING_TYPES).optional(),
  value: z.string().optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field must be provided' })
  .superRefine((d, ctx) => {
    if (d.type === 'weekly' && d.value) {
      const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (!validDays.includes(d.value)) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          message: `For weekly holidays, value must be one of: ${validDays.join(', ')}`,
          path:    ['value'],
        });
      }
    }
    if (d.type === 'monthly' && d.value) {
      const dayNum = Number(d.value);
      if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          message: 'For monthly holidays, value must be a day of month between 1 and 31',
          path:    ['value'],
        });
      }
    }
  });

// POST /api/holidays/special-working-days
export const specialWorkingDaySchema = z.object({
  date: dateStringSchema,
});

// GET /api/holidays/calendar — query param validation
export const calendarQuerySchema = z.object({
  year:  z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12), // 1-indexed
});

// ─── Additional type exports ──────────────────────────────────────

export type BlockedDateInput             = z.infer<typeof blockedDateSchema>;
export type RecurringHolidayInput        = z.infer<typeof recurringHolidaySchema>;
export type UpdateRecurringHolidayInput  = z.infer<typeof updateRecurringHolidaySchema>;
export type SpecialWorkingDayInput       = z.infer<typeof specialWorkingDaySchema>;
export type CalendarQueryInput           = z.infer<typeof calendarQuerySchema>;
