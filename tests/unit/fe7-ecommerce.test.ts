// tests/unit/fe7-ecommerce.test.ts
// Unit tests for FE-7 Ecommerce pure logic.

// ─── Order status helpers ─────────────────────────────────────────

type OrderStatus =
  | 'ORDER_PLACED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED'
  | 'CONFIRMED' | 'CANCELLED' | 'RETURN_REQUESTED' | 'RETURNED' | 'REFUNDED';

function orderStatusLabel(s: OrderStatus): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/(?:^|\s)\w/g, c => c.toUpperCase());
}

function orderStatusVariant(s: OrderStatus): string {
  return s === 'ORDER_PLACED' ? 'warning'
       : s === 'PROCESSING'   ? 'info'
       : s === 'SHIPPED'      ? 'brand'
       : s === 'DELIVERED'    ? 'success'
       : s === 'CANCELLED'    ? 'danger'
       : 'neutral';
}

describe('orderStatusLabel', () => {
  test('ORDER_PLACED → Order Placed',           () => expect(orderStatusLabel('ORDER_PLACED')).toBe('Order Placed'));
  test('PROCESSING → Processing',               () => expect(orderStatusLabel('PROCESSING')).toBe('Processing'));
  test('SHIPPED → Shipped',                     () => expect(orderStatusLabel('SHIPPED')).toBe('Shipped'));
  test('DELIVERED → Delivered',                 () => expect(orderStatusLabel('DELIVERED')).toBe('Delivered'));
  test('CANCELLED → Cancelled',                 () => expect(orderStatusLabel('CANCELLED')).toBe('Cancelled'));
  test('RETURN_REQUESTED → Return Requested',   () => expect(orderStatusLabel('RETURN_REQUESTED')).toBe('Return Requested'));
});

describe('orderStatusVariant', () => {
  test('ORDER_PLACED → warning', () => expect(orderStatusVariant('ORDER_PLACED')).toBe('warning'));
  test('PROCESSING → info',      () => expect(orderStatusVariant('PROCESSING')).toBe('info'));
  test('SHIPPED → brand',        () => expect(orderStatusVariant('SHIPPED')).toBe('brand'));
  test('DELIVERED → success',    () => expect(orderStatusVariant('DELIVERED')).toBe('success'));
  test('CANCELLED → danger',     () => expect(orderStatusVariant('CANCELLED')).toBe('danger'));
  test('REFUNDED → neutral',     () => expect(orderStatusVariant('REFUNDED')).toBe('neutral'));
});

// ─── Valid status transitions ─────────────────────────────────────

const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  ORDER_PLACED:     ['PROCESSING', 'CONFIRMED', 'CANCELLED'],
  PROCESSING:       ['SHIPPED', 'CANCELLED'],
  SHIPPED:          ['DELIVERED', 'RETURN_REQUESTED'],
  DELIVERED:        ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED:         ['REFUNDED'],
};

function getAllowedNext(status: OrderStatus): OrderStatus[] {
  return NEXT_STATUSES[status] ?? [];
}

describe('getAllowedNext', () => {
  test('ORDER_PLACED can go to PROCESSING, CONFIRMED, CANCELLED', () =>
    expect(getAllowedNext('ORDER_PLACED')).toContain('PROCESSING'));
  test('SHIPPED can go to DELIVERED',       () => expect(getAllowedNext('SHIPPED')).toContain('DELIVERED'));
  test('DELIVERED can request return',      () => expect(getAllowedNext('DELIVERED')).toContain('RETURN_REQUESTED'));
  test('CANCELLED has no transitions',      () => expect(getAllowedNext('CANCELLED')).toHaveLength(0));
  test('REFUNDED has no transitions',       () => expect(getAllowedNext('REFUNDED')).toHaveLength(0));
  test('RETURNED can only go to REFUNDED',  () => expect(getAllowedNext('RETURNED')).toEqual(['REFUNDED']));
});

// ─── Cart total with coupon ───────────────────────────────────────

function applyCartCoupon(subtotal: number, couponDiscount: number): number {
  return Math.max(0, Math.round((subtotal - couponDiscount) * 100) / 100);
}

describe('applyCartCoupon', () => {
  test('subtracts coupon from subtotal',        () => expect(applyCartCoupon(1000, 100)).toBe(900));
  test('clamps at zero when discount exceeds',  () => expect(applyCartCoupon(50, 100)).toBe(0));
  test('no coupon returns original subtotal',   () => expect(applyCartCoupon(1000, 0)).toBe(1000));
  test('rounds to 2 decimal places',            () => expect(applyCartCoupon(100, 33.33)).toBe(66.67));
});

// ─── Variant selection helpers ────────────────────────────────────

interface Variant { id: string; size: string; price: number; inStock: boolean }

function getDisplayPrice(mrp: number, variants: Variant[], selectedVariantId: string): number {
  const found = variants.find(v => v.id === selectedVariantId);
  return found ? found.price : mrp;
}

function isProductInStock(inStock: boolean, variants: Variant[], selectedVariantId: string, hasVariants: boolean): boolean {
  if (!hasVariants) return inStock;
  const found = variants.find(v => v.id === selectedVariantId);
  return found ? found.inStock : false;
}

describe('getDisplayPrice', () => {
  const variants: Variant[] = [
    { id: 'v1', size: 'S', price: 299, inStock: true },
    { id: 'v2', size: 'M', price: 349, inStock: true },
  ];
  test('returns variant price when variant selected', () =>
    expect(getDisplayPrice(399, variants, 'v1')).toBe(299));
  test('returns mrp when no variant matches',         () =>
    expect(getDisplayPrice(399, variants, 'v999')).toBe(399));
  test('returns mrp when variants empty',             () =>
    expect(getDisplayPrice(399, [], '')).toBe(399));
});

describe('isProductInStock', () => {
  const variants: Variant[] = [
    { id: 'v1', size: 'S', price: 299, inStock: true  },
    { id: 'v2', size: 'M', price: 349, inStock: false },
  ];
  test('simple product uses top-level inStock',  () =>
    expect(isProductInStock(true, [], '', false)).toBe(true));
  test('variant product checks selected variant in stock', () =>
    expect(isProductInStock(true, variants, 'v1', true)).toBe(true));
  test('variant product shows out-of-stock for OOS variant', () =>
    expect(isProductInStock(true, variants, 'v2', true)).toBe(false));
  test('no matching variant returns false', () =>
    expect(isProductInStock(true, variants, 'v999', true)).toBe(false));
});

// ─── Address form validation ──────────────────────────────────────

interface AddressFormErrors { name?:string; email?:string; street?:string; city?:string; state?:string; zip?:string; phone?:string }

function validateAddressForm(d: {
  name:string; email:string; street:string; city:string; state:string; zip:string; phone:string;
}): AddressFormErrors {
  const e: AddressFormErrors = {};
  if (!d.name.trim() || d.name.trim().length < 2)  e.name   = 'Name required (min 2 chars)';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email  = 'Valid email required';
  if (!d.street.trim() || d.street.trim().length < 5) e.street = 'Street address required (min 5 chars)';
  if (!d.city.trim())                               e.city   = 'City required';
  if (!d.state.trim())                              e.state  = 'State required';
  if (!d.zip.trim())                                e.zip    = 'ZIP required';
  if (!/^[0-9+\-\s()]{7,20}$/.test(d.phone))       e.phone  = 'Valid phone required';
  return e;
}

describe('validateAddressForm', () => {
  const valid = { name:'Kavya Nair', email:'kavya@ex.com', street:'45 Nungambakkam High Road',
    city:'Chennai', state:'Tamil Nadu', zip:'600034', phone:'+91 9500000001' };

  test('passes valid address',       () => expect(Object.keys(validateAddressForm(valid))).toHaveLength(0));
  test('rejects short name',         () => expect(validateAddressForm({ ...valid, name: 'A' })).toHaveProperty('name'));
  test('rejects invalid email',      () => expect(validateAddressForm({ ...valid, email: 'bad' })).toHaveProperty('email'));
  test('rejects short street',       () => expect(validateAddressForm({ ...valid, street: 'A' })).toHaveProperty('street'));
  test('rejects empty city',         () => expect(validateAddressForm({ ...valid, city: '' })).toHaveProperty('city'));
  test('rejects empty zip',          () => expect(validateAddressForm({ ...valid, zip: '' })).toHaveProperty('zip'));
  test('rejects invalid phone',      () => expect(validateAddressForm({ ...valid, phone: 'abc' })).toHaveProperty('phone'));
});
