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

// ─── Availability / Slot Engine schemas ───────────────────────────

// GET /api/booking/availability — query params
export const availabilityQuerySchema = z.object({
  serviceId: z.string({ required_error: 'serviceId is required' }).cuid('Invalid serviceId'),
  staffId:   z.string().cuid('Invalid staffId').optional(),
  date:      dateStringSchema,
});

// GET /api/booking/availability/range — query params
export const availabilityRangeQuerySchema = z.object({
  serviceId: z.string({ required_error: 'serviceId is required' }).cuid('Invalid serviceId'),
  staffId:   z.string().cuid('Invalid staffId').optional(),
  from:      dateStringSchema,
  to:        dateStringSchema,
}).refine(
  d => d.to >= d.from,
  { message: '"to" date must not be before "from" date', path: ['to'] }
).refine(
  d => {
    // Cap range span to 90 days to bound the work done per request
    const fromDate = new Date(d.from);
    const toDate   = new Date(d.to);
    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 90;
  },
  { message: 'Date range cannot exceed 90 days', path: ['to'] }
);

export type AvailabilityQueryInput      = z.infer<typeof availabilityQuerySchema>;
export type AvailabilityRangeQueryInput = z.infer<typeof availabilityRangeQuerySchema>;

// ─── Booking Creation / Lifecycle schemas ─────────────────────────

const timeSchemaBooking = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format (24-hour)');

// POST /api/bookings
export const createBookingSchema = z.object({
  serviceIds: z
    .array(z.string().cuid('Invalid service ID'), { required_error: 'serviceIds is required' })
    .min(1, 'At least one service must be selected'),
  staffId:    z.string().cuid('Invalid staffId').optional().nullable(),
  resourceId: z.string().cuid('Invalid resourceId').optional().nullable(),
  date:       dateStringSchema,
  startTime:  timeSchemaBooking,
  notes: z
    .string()
    .max(500, 'Notes must be under 500 characters')
    .trim()
    .optional(),
});

// PATCH /api/bookings/[id]/cancel
export const cancelBookingSchema = z.object({
  reason: z
    .string()
    .max(300, 'Reason must be under 300 characters')
    .trim()
    .optional(),
});

// PATCH /api/bookings/[id]/reschedule
export const rescheduleBookingSchema = z.object({
  date:      dateStringSchema,
  startTime: timeSchemaBooking,
});

// POST /api/bookings/[id]/payment
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'razorpay'] as const;

export const recordPaymentSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be greater than 0'),
  method: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: `Method must be one of: ${PAYMENT_METHODS.join(', ')}` }),
  }),
  razorpayOrderId:   z.string().optional(),
  razorpayPaymentId: z.string().optional(),
}).refine(
  d => d.method !== 'razorpay' || (!!d.razorpayOrderId && !!d.razorpayPaymentId),
  { message: 'razorpayOrderId and razorpayPaymentId are required for razorpay payments', path: ['razorpayPaymentId'] }
);

// PATCH /api/bookings/[id]/status
const BOOKING_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'] as const;

export const updateBookingStatusSchema = z.object({
  status: z.enum(BOOKING_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${BOOKING_STATUSES.join(', ')}` }),
  }),
});

// GET /api/bookings — query filters
export const bookingListQuerySchema = z.object({
  status:   z.enum(BOOKING_STATUSES).optional(),
  staffId:  z.string().cuid('Invalid staffId').optional(),
  from:     dateStringSchema.optional(),
  to:       dateStringSchema.optional(),
});

// ─── Type exports ─────────────────────────────────────────────────

export type CreateBookingInput        = z.infer<typeof createBookingSchema>;
export type CancelBookingInput        = z.infer<typeof cancelBookingSchema>;
export type RescheduleBookingInput    = z.infer<typeof rescheduleBookingSchema>;
export type RecordPaymentInput        = z.infer<typeof recordPaymentSchema>;
export type UpdateBookingStatusInput  = z.infer<typeof updateBookingStatusSchema>;
export type BookingListQueryInput     = z.infer<typeof bookingListQuerySchema>;

// ─── Product Category schemas ─────────────────────────────────────

export const productCategorySchema = z.object({
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
  image: z
    .string()
    .url('Invalid image URL')
    .optional()
    .or(z.literal('')),
});

export const updateProductCategorySchema = z.object({
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
  image: z
    .string()
    .url('Invalid image URL')
    .optional()
    .or(z.literal('')),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── Product Variant sub-schema (used inline in createProductSchema) ──

const variantInputSchema = z.object({
  size: z
    .string({ required_error: 'Variant size is required' })
    .min(1, 'Size cannot be empty')
    .max(50, 'Size must be under 50 characters')
    .trim(),
  price: z
    .number({ required_error: 'Variant price is required' })
    .min(0, 'Price cannot be negative')
    .max(1_000_000, 'Price is too large'),
  barcode: z
    .string()
    .max(100, 'Barcode must be under 100 characters')
    .trim()
    .optional(),
});

// ─── Product schemas ──────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z
    .string({ required_error: 'Product name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(150, 'Name must be under 150 characters')
    .trim(),
  description: z
    .string()
    .max(2000, 'Description must be under 2000 characters')
    .trim()
    .optional(),
  // mrp is the base/no-variant price. Required only when no variants are supplied.
  mrp: z
    .number()
    .min(0, 'MRP cannot be negative')
    .max(10_000_000, 'MRP is too large')
    .optional(),
  images: z
    .array(z.string().url('Each image must be a valid URL'))
    .max(10, 'Maximum 10 images allowed')
    .optional()
    .default([]),
  categoryId: z
    .string()
    .cuid('Invalid category ID')
    .optional()
    .nullable(),
  sku: z
    .string()
    .max(100, 'SKU must be under 100 characters')
    .trim()
    .optional(),
  keyFeatures: z
    .array(z.string().max(200))
    .max(20, 'Maximum 20 key features allowed')
    .optional()
    .default([]),
  // Optional variants — if provided, mrp becomes informational only;
  // actual sellable prices come from each variant.
  variants: z
    .array(variantInputSchema)
    .max(50, 'Maximum 50 variants allowed')
    .optional(),
  // Optional initial stock receipt — creates the first ProductBatch.
  initialQuantity: z
    .number()
    .int('Initial quantity must be a whole number')
    .min(0, 'Initial quantity cannot be negative')
    .optional(),
  lowStockThreshold: z
    .number()
    .int('Low stock threshold must be a whole number')
    .min(0, 'Low stock threshold cannot be negative')
    .optional()
    .default(10),
}).refine(
  d => d.mrp !== undefined || (d.variants && d.variants.length > 0),
  { message: 'Either mrp or at least one variant must be provided', path: ['mrp'] }
).refine(
  d => {
    // initialQuantity only makes sense for a product with NO variants
    // (variant-level stock is added separately via the batches endpoint per variant)
    if (d.initialQuantity !== undefined && d.variants && d.variants.length > 0) return false;
    return true;
  },
  { message: 'initialQuantity cannot be set when variants are provided — add stock per-variant via the batches endpoint', path: ['initialQuantity'] }
);

export const updateProductSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(150, 'Name must be under 150 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must be under 2000 characters')
    .trim()
    .optional(),
  mrp: z
    .number()
    .min(0, 'MRP cannot be negative')
    .max(10_000_000, 'MRP is too large')
    .optional(),
  images: z
    .array(z.string().url('Each image must be a valid URL'))
    .max(10, 'Maximum 10 images allowed')
    .optional(),
  categoryId: z
    .string()
    .cuid('Invalid category ID')
    .optional()
    .nullable(),
  sku: z
    .string()
    .max(100, 'SKU must be under 100 characters')
    .trim()
    .optional(),
  keyFeatures: z
    .array(z.string().max(200))
    .max(20, 'Maximum 20 key features allowed')
    .optional(),
  inStock: z.boolean().optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// GET /api/products — query filters
const STOCK_FILTERS = ['in_stock', 'low_stock', 'out_of_stock'] as const;

export const productListQuerySchema = z.object({
  categoryId: z.string().cuid('Invalid categoryId').optional(),
  stockStatus: z.enum(STOCK_FILTERS).optional(),
});

// ─── Product Variant management (add/update on existing product) ──

export const addVariantSchema = variantInputSchema;

export const updateVariantSchema = z.object({
  size: z
    .string()
    .min(1, 'Size cannot be empty')
    .max(50, 'Size must be under 50 characters')
    .trim()
    .optional(),
  price: z
    .number()
    .min(0, 'Price cannot be negative')
    .max(1_000_000, 'Price is too large')
    .optional(),
  barcode: z
    .string()
    .max(100, 'Barcode must be under 100 characters')
    .trim()
    .optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── Product Batch (stock receipt) schemas ────────────────────────

export const createBatchSchema = z.object({
  variantId: z.string().cuid('Invalid variantId').optional().nullable(),
  batchNumber: z
    .string()
    .max(100, 'Batch number must be under 100 characters')
    .trim()
    .optional(),
  expiryDate: dateStringSchema.optional(),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0'),
});

// ─── Inventory adjustment schema ──────────────────────────────────

const ADJUSTMENT_REASONS = ['damaged', 'lost', 'correction', 'returned', 'other'] as const;

export const adjustInventorySchema = z.object({
  // Positive to add stock, negative to remove. Cannot be zero.
  delta: z
    .number({ required_error: 'delta is required' })
    .int('delta must be a whole number')
    .refine(v => v !== 0, { message: 'delta cannot be zero' }),
  reason: z.enum(ADJUSTMENT_REASONS, {
    errorMap: () => ({ message: `Reason must be one of: ${ADJUSTMENT_REASONS.join(', ')}` }),
  }),
  note: z
    .string()
    .max(300, 'Note must be under 300 characters')
    .trim()
    .optional(),
});

// ─── Type exports ─────────────────────────────────────────────────

export type ProductCategoryInput       = z.infer<typeof productCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;
export type CreateProductInput         = z.infer<typeof createProductSchema>;
export type UpdateProductInput         = z.infer<typeof updateProductSchema>;
export type ProductListQueryInput      = z.infer<typeof productListQuerySchema>;
export type AddVariantInput            = z.infer<typeof addVariantSchema>;
export type UpdateVariantInput         = z.infer<typeof updateVariantSchema>;
export type CreateBatchInput           = z.infer<typeof createBatchSchema>;
export type AdjustInventoryInput       = z.infer<typeof adjustInventorySchema>;

// ─── Billing / POS schemas ─────────────────────────────────────────

const billLineItemSchema = z.object({
  productId: z.string({ required_error: 'productId is required' }).cuid('Invalid productId'),
  variantId: z.string().cuid('Invalid variantId').optional().nullable(),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0'),
  // Per-line discount, flat amount (not percent) — applied before tax
  discount: z
    .number()
    .min(0, 'Discount cannot be negative')
    .optional()
    .default(0),
});

const BILL_PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'SPLIT'] as const;

// POST /api/bills
export const createBillSchema = z.object({
  items: z
    .array(billLineItemSchema, { required_error: 'items is required' })
    .min(1, 'At least one item is required'),
  // Bill-level discount, flat amount, applied to the subtotal AFTER line-item discounts
  billDiscount: z
    .number()
    .min(0, 'Discount cannot be negative')
    .optional()
    .default(0),
  paymentMode: z.enum(BILL_PAYMENT_MODES, {
    errorMap: () => ({ message: `Payment mode must be one of: ${BILL_PAYMENT_MODES.join(', ')}` }),
  }),
  paidAmount: z
    .number()
    .min(0, 'Paid amount cannot be negative')
    .optional(),
  note: z
    .string()
    .max(500, 'Note must be under 500 characters')
    .trim()
    .optional(),
});

// GET /api/bills — query filters
export const billListQuerySchema = z.object({
  from:   dateStringSchema.optional(),
  to:     dateStringSchema.optional(),
}).refine(
  d => !(d.from && d.to) || d.to >= d.from,
  { message: '"to" date must not be before "from" date', path: ['to'] }
);

// ─── Tenant Settings schemas ───────────────────────────────────────

const TAX_TYPES = ['SINGLE', 'SPLIT'] as const;

export const updateTenantSettingsSchema = z.object({
  gstNumber: z
    .string()
    .max(50, 'GST number must be under 50 characters')
    .trim()
    .optional()
    .nullable(),
  taxType: z.enum(TAX_TYPES, {
    errorMap: () => ({ message: 'taxType must be "SINGLE" or "SPLIT"' }),
  }).optional(),
  taxPercent: z
    .number()
    .min(0, 'Tax percent cannot be negative')
    .max(100, 'Tax percent cannot exceed 100')
    .optional(),
  cgst: z
    .number()
    .min(0, 'CGST cannot be negative')
    .max(100, 'CGST cannot exceed 100')
    .optional(),
  sgst: z
    .number()
    .min(0, 'SGST cannot be negative')
    .max(100, 'SGST cannot exceed 100')
    .optional(),
  currency: z
    .string()
    .min(1, 'Currency cannot be empty')
    .max(10, 'Currency code must be under 10 characters')
    .optional(),
  showStoreName: z.boolean().optional(),
  showGST: z.boolean().optional(),
  footerMessage: z
    .string()
    .max(200, 'Footer message must be under 200 characters')
    .trim()
    .optional()
    .nullable(),
  defaultLowStock: z
    .number()
    .int('defaultLowStock must be a whole number')
    .min(0, 'defaultLowStock cannot be negative')
    .optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── Type exports ─────────────────────────────────────────────────

export type CreateBillInput            = z.infer<typeof createBillSchema>;
export type BillListQueryInput         = z.infer<typeof billListQuerySchema>;
export type UpdateTenantSettingsInput  = z.infer<typeof updateTenantSettingsSchema>;

// ─── Cart schemas ───────────────────────────────────────────────────

export const addCartItemSchema = z.object({
  productId: z.string({ required_error: 'productId is required' }).cuid('Invalid productId'),
  variantId: z.string().cuid('Invalid variantId').optional().nullable(),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0')
    .max(999, 'Quantity is too large')
    .default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0')
    .max(999, 'Quantity is too large'),
});

// ─── Address schemas ────────────────────────────────────────────────

export const createAddressSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  street: z
    .string({ required_error: 'Street address is required' })
    .min(5, 'Street address must be at least 5 characters')
    .max(300, 'Street address is too long')
    .trim(),
  city: z
    .string({ required_error: 'City is required' })
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City is too long')
    .trim(),
  state: z
    .string({ required_error: 'State is required' })
    .min(2, 'State must be at least 2 characters')
    .max(100, 'State is too long')
    .trim(),
  zip: z
    .string({ required_error: 'ZIP/postal code is required' })
    .min(3, 'ZIP/postal code is too short')
    .max(20, 'ZIP/postal code is too long')
    .trim(),
  country: z
    .string({ required_error: 'Country is required' })
    .min(2, 'Country must be at least 2 characters')
    .max(100, 'Country is too long')
    .trim(),
  phone: z
    .string({ required_error: 'Phone is required' })
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number'),
});

// ─── Order / Checkout schemas ───────────────────────────────────────

export const checkoutSchema = z.object({
  addressId: z.string({ required_error: 'addressId is required' }).cuid('Invalid addressId'),
  paymentMethod: z.enum(['COD', 'RAZORPAY', 'CASH', 'UPI', 'CARD'], {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  couponCode: z
    .string()
    .max(50, 'Coupon code is too long')
    .trim()
    .optional(),
});

const ORDER_STATUSES = [
  'ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED',
  'CONFIRMED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED',
] as const;

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` }),
  }),
  note: z
    .string()
    .max(300, 'Note must be under 300 characters')
    .trim()
    .optional(),
});

export const orderListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  from:   dateStringSchema.optional(),
  to:     dateStringSchema.optional(),
}).refine(
  d => !(d.from && d.to) || d.to >= d.from,
  { message: '"to" date must not be before "from" date', path: ['to'] }
);

// ─── Coupon validation schema ────────────────────────────────────────

export const validateCouponSchema = z.object({
  code: z
    .string({ required_error: 'Coupon code is required' })
    .min(1, 'Coupon code cannot be empty')
    .max(50, 'Coupon code is too long')
    .trim(),
  cartTotal: z
    .number({ required_error: 'cartTotal is required' })
    .min(0, 'cartTotal cannot be negative'),
});

// ─── Type exports ─────────────────────────────────────────────────

export type AddCartItemInput        = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput     = z.infer<typeof updateCartItemSchema>;
export type CreateAddressInput      = z.infer<typeof createAddressSchema>;
export type CheckoutInput           = z.infer<typeof checkoutSchema>;
export type UpdateOrderStatusInput  = z.infer<typeof updateOrderStatusSchema>;
export type OrderListQueryInput     = z.infer<typeof orderListQuerySchema>;
export type ValidateCouponInput     = z.infer<typeof validateCouponSchema>;

// ─── Reporting schemas ──────────────────────────────────────────────

const REPORT_BUCKETS = ['day', 'week', 'month'] as const;

export const revenueReportQuerySchema = z.object({
  from:   dateStringSchema,
  to:     dateStringSchema,
  bucket: z.enum(REPORT_BUCKETS).optional().default('day'),
}).refine(
  d => d.to >= d.from,
  { message: '"to" date must not be before "from" date', path: ['to'] }
).refine(
  d => {
    const diffDays = (new Date(d.to).getTime() - new Date(d.from).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 366;
  },
  { message: 'Date range cannot exceed 366 days', path: ['to'] }
);

export const salesSummaryQuerySchema = z.object({
  from:  dateStringSchema,
  to:    dateStringSchema,
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
}).refine(
  d => d.to >= d.from,
  { message: '"to" date must not be before "from" date', path: ['to'] }
);

export const customerReportQuerySchema = z.object({
  from:  dateStringSchema,
  to:    dateStringSchema,
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
}).refine(
  d => d.to >= d.from,
  { message: '"to" date must not be before "from" date', path: ['to'] }
);

export const staffPerformanceQuerySchema = z.object({
  from: dateStringSchema,
  to:   dateStringSchema,
}).refine(
  d => d.to >= d.from,
  { message: '"to" date must not be before "from" date', path: ['to'] }
);

export const inventoryReportQuerySchema = z.object({
  deadStockDays: z.coerce.number().int().min(1).max(365).optional().default(90),
});

const REPORT_TYPES = ['revenue', 'sales-summary', 'customers', 'staff-performance', 'inventory'] as const;

export const exportReportSchema = z.object({
  reportType: z.enum(REPORT_TYPES, {
    errorMap: () => ({ message: `reportType must be one of: ${REPORT_TYPES.join(', ')}` }),
  }),
  from: dateStringSchema.optional(),
  to:   dateStringSchema.optional(),
}).refine(
  d => !(d.from && d.to) || d.to >= d.from,
  { message: '"to" date must not be before "from" date', path: ['to'] }
).refine(
  d => d.reportType === 'inventory' || (!!d.from && !!d.to),
  { message: 'from and to are required for this report type', path: ['from'] }
);

// ─── Type exports ─────────────────────────────────────────────────

export type RevenueReportQueryInput     = z.infer<typeof revenueReportQuerySchema>;
export type SalesSummaryQueryInput      = z.infer<typeof salesSummaryQuerySchema>;
export type CustomerReportQueryInput    = z.infer<typeof customerReportQuerySchema>;
export type StaffPerformanceQueryInput  = z.infer<typeof staffPerformanceQuerySchema>;
export type InventoryReportQueryInput   = z.infer<typeof inventoryReportQuerySchema>;
export type ExportReportInput           = z.infer<typeof exportReportSchema>;
