// tests/unit/booking-validation.test.ts
// Unit tests for Phase 3A schemas in validation.ts

import {
  serviceCategorySchema,
  updateServiceCategorySchema,
  serviceSchema,
  updateServiceSchema,
  resourceSchema,
  updateResourceSchema,
  slotConfigSchema,
  validate,
} from '@/lib/validation';

// ─── serviceCategorySchema ────────────────────────────────────────

describe('serviceCategorySchema', () => {
  test('accepts valid name', () => {
    expect(serviceCategorySchema.safeParse({ name: 'Hair Care' }).success).toBe(true);
  });
  test('accepts name + description', () => {
    expect(serviceCategorySchema.safeParse({ name: 'Skin', description: 'All skin treatments' }).success).toBe(true);
  });
  test('trims name', () => {
    const r = serviceCategorySchema.safeParse({ name: '  Hair Care  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe('Hair Care');
  });
  test('rejects name shorter than 2 chars', () => {
    expect(serviceCategorySchema.safeParse({ name: 'H' }).success).toBe(false);
  });
  test('rejects name longer than 80 chars', () => {
    expect(serviceCategorySchema.safeParse({ name: 'A'.repeat(81) }).success).toBe(false);
  });
  test('rejects description longer than 300 chars', () => {
    expect(serviceCategorySchema.safeParse({ name: 'Hair', description: 'X'.repeat(301) }).success).toBe(false);
  });
  test('rejects missing name', () => {
    expect(serviceCategorySchema.safeParse({}).success).toBe(false);
  });
});

describe('updateServiceCategorySchema', () => {
  test('accepts partial update — name only', () => {
    expect(updateServiceCategorySchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });
  test('accepts isActive toggle', () => {
    expect(updateServiceCategorySchema.safeParse({ isActive: false }).success).toBe(true);
  });
  test('rejects empty object', () => {
    expect(updateServiceCategorySchema.safeParse({}).success).toBe(false);
  });
});

// ─── serviceSchema ────────────────────────────────────────────────

const validService = {
  name:        'Haircut',
  description: 'Classic haircut',
  duration:    30,
  price:       300,
};

describe('serviceSchema — valid inputs', () => {
  test('accepts minimal valid service', () => {
    expect(serviceSchema.safeParse(validService).success).toBe(true);
  });
  test('accepts zero price (free service)', () => {
    expect(serviceSchema.safeParse({ ...validService, price: 0 }).success).toBe(true);
  });
  test('accepts without optional description', () => {
    const { description: _, ...rest } = validService;
    expect(serviceSchema.safeParse(rest).success).toBe(true);
  });
  test('accepts without optional categoryId', () => {
    expect(serviceSchema.safeParse({ ...validService, categoryId: null }).success).toBe(true);
  });
  test('accepts 5 minute minimum duration', () => {
    expect(serviceSchema.safeParse({ ...validService, duration: 5 }).success).toBe(true);
  });
  test('accepts 480 minute maximum duration', () => {
    expect(serviceSchema.safeParse({ ...validService, duration: 480 }).success).toBe(true);
  });
  test('trims name', () => {
    const r = serviceSchema.safeParse({ ...validService, name: '  Haircut  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe('Haircut');
  });
});

describe('serviceSchema — invalid inputs', () => {
  test('rejects missing name', () => {
    const { name: _, ...rest } = validService;
    expect(serviceSchema.safeParse(rest).success).toBe(false);
  });
  test('rejects missing duration', () => {
    const { duration: _, ...rest } = validService;
    expect(serviceSchema.safeParse(rest).success).toBe(false);
  });
  test('rejects missing price', () => {
    const { price: _, ...rest } = validService;
    expect(serviceSchema.safeParse(rest).success).toBe(false);
  });
  test('rejects negative price', () => {
    expect(serviceSchema.safeParse({ ...validService, price: -1 }).success).toBe(false);
  });
  test('rejects duration below 5 minutes', () => {
    expect(serviceSchema.safeParse({ ...validService, duration: 4 }).success).toBe(false);
  });
  test('rejects duration above 480 minutes', () => {
    expect(serviceSchema.safeParse({ ...validService, duration: 481 }).success).toBe(false);
  });
  test('rejects non-integer duration', () => {
    expect(serviceSchema.safeParse({ ...validService, duration: 30.5 }).success).toBe(false);
  });
  test('rejects invalid image URL', () => {
    expect(serviceSchema.safeParse({ ...validService, image: 'not-a-url' }).success).toBe(false);
  });
  test('accepts empty string image (no image)', () => {
    expect(serviceSchema.safeParse({ ...validService, image: '' }).success).toBe(true);
  });
});

describe('updateServiceSchema', () => {
  test('accepts partial — price only', () => {
    expect(updateServiceSchema.safeParse({ price: 500 }).success).toBe(true);
  });
  test('accepts isActive toggle', () => {
    expect(updateServiceSchema.safeParse({ isActive: false }).success).toBe(true);
  });
  test('rejects empty object', () => {
    expect(updateServiceSchema.safeParse({}).success).toBe(false);
  });
  test('accepts duration update', () => {
    expect(updateServiceSchema.safeParse({ duration: 45 }).success).toBe(true);
  });
});

// ─── resourceSchema ───────────────────────────────────────────────

describe('resourceSchema — valid inputs', () => {
  test('accepts court', () => {
    expect(resourceSchema.safeParse({ name: 'Court 1', type: 'court' }).success).toBe(true);
  });
  test('accepts room', () => {
    expect(resourceSchema.safeParse({ name: 'Room A', type: 'room' }).success).toBe(true);
  });
  test('accepts table', () => {
    expect(resourceSchema.safeParse({ name: 'Table 3', type: 'table' }).success).toBe(true);
  });
  test('accepts equipment', () => {
    expect(resourceSchema.safeParse({ name: 'Massage Bed 1', type: 'equipment' }).success).toBe(true);
  });
  test('accepts other', () => {
    expect(resourceSchema.safeParse({ name: 'VIP Area', type: 'other' }).success).toBe(true);
  });
  test('accepts with optional description', () => {
    expect(resourceSchema.safeParse({ name: 'Court 1', type: 'court', description: 'Main court' }).success).toBe(true);
  });
  test('trims name', () => {
    const r = resourceSchema.safeParse({ name: '  Court 1  ', type: 'court' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe('Court 1');
  });
});

describe('resourceSchema — invalid inputs', () => {
  test('rejects invalid type', () => {
    expect(resourceSchema.safeParse({ name: 'Court 1', type: 'pool' }).success).toBe(false);
  });
  test('rejects missing name', () => {
    expect(resourceSchema.safeParse({ type: 'court' }).success).toBe(false);
  });
  test('rejects name shorter than 2 chars', () => {
    expect(resourceSchema.safeParse({ name: 'C', type: 'court' }).success).toBe(false);
  });
  test('rejects missing type', () => {
    expect(resourceSchema.safeParse({ name: 'Court 1' }).success).toBe(false);
  });
});

describe('updateResourceSchema', () => {
  test('accepts type-only update', () => {
    expect(updateResourceSchema.safeParse({ type: 'room' }).success).toBe(true);
  });
  test('accepts isActive toggle', () => {
    expect(updateResourceSchema.safeParse({ isActive: false }).success).toBe(true);
  });
  test('rejects empty object', () => {
    expect(updateResourceSchema.safeParse({}).success).toBe(false);
  });
});

// ─── slotConfigSchema ─────────────────────────────────────────────

const validSlotConfig = {
  slotStartTime:          '09:00',
  slotEndTime:            '17:00',
  slotDuration:           30,
  breakEnabled:           false,
  daysOpen:               ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  maxAdvanceBookingDays:  30,
  minBookingHoursBefore:  2,
  allowRescheduling:      true,
  rescheduleHoursBefore:  24,
  advancePaymentRequired: true,
  advancePaymentPercent:  100,
};

describe('slotConfigSchema — valid inputs', () => {
  test('accepts full valid config', () => {
    expect(slotConfigSchema.safeParse(validSlotConfig).success).toBe(true);
  });
  test('accepts all valid slot durations', () => {
    for (const d of [15, 30, 45, 60, 90, 120]) {
      expect(slotConfigSchema.safeParse({ ...validSlotConfig, slotDuration: d }).success).toBe(true);
    }
  });
  test('accepts all valid advance payment percents', () => {
    for (const p of [10, 20, 25, 50, 75, 100]) {
      expect(slotConfigSchema.safeParse({ ...validSlotConfig, advancePaymentPercent: p }).success).toBe(true);
    }
  });
  test('accepts break time when breakEnabled', () => {
    expect(slotConfigSchema.safeParse({
      ...validSlotConfig,
      breakEnabled:   true,
      breakStartTime: '13:00',
      breakEndTime:   '14:00',
    }).success).toBe(true);
  });
  test('accepts Saturday and Sunday in daysOpen', () => {
    expect(slotConfigSchema.safeParse({
      ...validSlotConfig,
      daysOpen: ['Saturday', 'Sunday'],
    }).success).toBe(true);
  });
  test('defaults applied when fields omitted', () => {
    const r = slotConfigSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.slotDuration).toBe(30);
      expect(r.data.advancePaymentPercent).toBe(100);
    }
  });
});

describe('slotConfigSchema — invalid inputs', () => {
  test('rejects end time before start time', () => {
    const r = slotConfigSchema.safeParse({ ...validSlotConfig, slotStartTime: '17:00', slotEndTime: '09:00' });
    expect(r.success).toBe(false);
  });
  test('rejects invalid slot duration', () => {
    expect(slotConfigSchema.safeParse({ ...validSlotConfig, slotDuration: 25 }).success).toBe(false);
  });
  test('rejects invalid advance payment percent', () => {
    expect(slotConfigSchema.safeParse({ ...validSlotConfig, advancePaymentPercent: 33 }).success).toBe(false);
  });
  test('rejects empty daysOpen array', () => {
    expect(slotConfigSchema.safeParse({ ...validSlotConfig, daysOpen: [] }).success).toBe(false);
  });
  test('rejects invalid day name', () => {
    expect(slotConfigSchema.safeParse({ ...validSlotConfig, daysOpen: ['Mon'] }).success).toBe(false);
  });
  test('rejects invalid time format', () => {
    expect(slotConfigSchema.safeParse({ ...validSlotConfig, slotStartTime: '9:00' }).success).toBe(false);
    expect(slotConfigSchema.safeParse({ ...validSlotConfig, slotStartTime: '25:00' }).success).toBe(false);
  });
  test('rejects breakEnabled=true without break times', () => {
    const r = slotConfigSchema.safeParse({ ...validSlotConfig, breakEnabled: true });
    expect(r.success).toBe(false);
  });
  test('rejects break time outside working hours', () => {
    const r = slotConfigSchema.safeParse({
      ...validSlotConfig,
      breakEnabled:   true,
      breakStartTime: '08:00', // before slotStartTime
      breakEndTime:   '09:30',
    });
    expect(r.success).toBe(false);
  });
});

// ─── validate() helper with booking schemas ───────────────────────

describe('validate() with booking schemas', () => {
  test('returns structured errors for invalid service', () => {
    const result = validate(serviceSchema, { name: 'X', duration: -5, price: -100 });
    expect(result.data).toBeNull();
    expect(result.errors).toHaveProperty('name');
    expect(result.errors).toHaveProperty('duration');
    expect(result.errors).toHaveProperty('price');
  });
  test('returns success for valid service', () => {
    const result = validate(serviceSchema, { name: 'Haircut', duration: 30, price: 300 });
    expect(result.errors).toBeNull();
    expect(result.data?.name).toBe('Haircut');
  });
});
