// tests/unit/fe-gaps.test.ts
// Unit tests for the 6 gap screens.

// ─── GAP 1: Service form validation ──────────────────────────────

interface ServiceFormErrors { name?: string; price?: string; image?: string }

function validateServiceForm(d: { name: string; price: string; image?: string }): ServiceFormErrors {
  const e: ServiceFormErrors = {};
  if (!d.name.trim() || d.name.trim().length < 2) e.name  = 'Name must be at least 2 characters';
  if (!d.price || parseFloat(d.price) < 0)        e.price = 'Enter a valid price (0 or more)';
  if (d.image && !/^https?:\/\//.test(d.image))   e.image = 'Image must be a valid URL';
  return e;
}

describe('validateServiceForm', () => {
  const valid = { name: 'Hair Cut', price: '599' };
  test('passes valid input',             () => expect(Object.keys(validateServiceForm(valid))).toHaveLength(0));
  test('rejects short name',             () => expect(validateServiceForm({ ...valid, name: 'H' })).toHaveProperty('name'));
  test('rejects empty name',             () => expect(validateServiceForm({ ...valid, name: '' })).toHaveProperty('name'));
  test('rejects negative price',         () => expect(validateServiceForm({ ...valid, price: '-1' })).toHaveProperty('price'));
  test('accepts zero price (free svc)',  () => expect(validateServiceForm({ ...valid, price: '0' })).not.toHaveProperty('price'));
  test('rejects non-URL image',          () => expect(validateServiceForm({ ...valid, image: 'notaurl' })).toHaveProperty('image'));
  test('accepts valid URL image',        () => expect(validateServiceForm({ ...valid, image: 'https://example.com/img.jpg' })).not.toHaveProperty('image'));
  test('accepts missing image',          () => expect(validateServiceForm(valid)).not.toHaveProperty('image'));
});

// ─── GAP 1: Service active toggle ────────────────────────────────

function toggleServiceActive(isActive: boolean): boolean { return !isActive; }

describe('toggleServiceActive', () => {
  test('active → inactive',  () => expect(toggleServiceActive(true)).toBe(false));
  test('inactive → active',  () => expect(toggleServiceActive(false)).toBe(true));
});

// ─── GAP 2: Resource form validation ─────────────────────────────

function validateResourceForm(d: { name: string; type: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.name.trim() || d.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
  if (!['court','room','table','equipment','other'].includes(d.type)) e.type = 'Invalid type';
  return e;
}

describe('validateResourceForm', () => {
  test('passes valid input',       () => expect(Object.keys(validateResourceForm({ name: 'Court 1', type: 'court' }))).toHaveLength(0));
  test('rejects short name',       () => expect(validateResourceForm({ name: 'X', type: 'room' })).toHaveProperty('name'));
  test('rejects empty name',       () => expect(validateResourceForm({ name: '', type: 'room' })).toHaveProperty('name'));
  test('rejects invalid type',     () => expect(validateResourceForm({ name: 'Room A', type: 'warehouse' })).toHaveProperty('type'));
  test('accepts each valid type',  () => {
    ['court','room','table','equipment','other'].forEach(t => {
      expect(Object.keys(validateResourceForm({ name: 'Test', type: t }))).toHaveLength(0);
    });
  });
});

// ─── GAP 3: Product list filter logic ────────────────────────────

type GapStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
interface Product { id: string; name: string; sku?: string; categoryId?: string; stockStatus: GapStockStatus }

function filterProducts(
  products: Product[],
  search: string,
  stockFilter: GapStockStatus | 'all',
  catFilter: string
): Product[] {
  return products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStock  = stockFilter === 'all' || p.stockStatus === stockFilter;
    const matchCat    = !catFilter || p.categoryId === catFilter;
    return matchSearch && matchStock && matchCat;
  });
}

describe('filterProducts', () => {
  const products: Product[] = [
    { id: '1', name: 'Shampoo',     sku: 'SHM-001', categoryId: 'cat1', stockStatus: 'in_stock' as GapStockStatus     },
    { id: '2', name: 'Conditioner', sku: 'CON-001', categoryId: 'cat1', stockStatus: 'low_stock'    },
    { id: '3', name: 'Serum',       sku: 'SER-001', categoryId: 'cat2', stockStatus: 'out_of_stock' },
  ];

  test('returns all with no filters',       () => expect(filterProducts(products, '', 'all', '')).toHaveLength(3));
  test('filters by name search',            () => expect(filterProducts(products, 'shampoo', 'all', '')).toHaveLength(1));
  test('filters by SKU search',             () => expect(filterProducts(products, 'SER', 'all', '')).toHaveLength(1));
  test('filters by stock status',           () => expect(filterProducts(products, '', 'low_stock', '')).toHaveLength(1));
  test('filters by category',               () => expect(filterProducts(products, '', 'all', 'cat2')).toHaveLength(1));
  test('combines search and stock filter',  () => expect(filterProducts(products, 'shampoo', 'low_stock', '')).toHaveLength(0));
  test('returns empty for no match',        () => expect(filterProducts(products, 'xyz', 'all', '')).toHaveLength(0));
});

// ─── GAP 4: Order tracking journey bar ───────────────────────────

type GapOrderStatus = 'ORDER_PLACED'|'PROCESSING'|'SHIPPED'|'DELIVERED'|'CONFIRMED'|'CANCELLED'|'RETURN_REQUESTED'|'RETURNED'|'REFUNDED';

const JOURNEY_STEPS: GapOrderStatus[] = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

function getJourneyProgress(status: GapOrderStatus): { isCancelled: boolean; currentIdx: number } {
  const isCancelled = ['CANCELLED','RETURN_REQUESTED','RETURNED','REFUNDED'].includes(status);
  const currentIdx  = JOURNEY_STEPS.indexOf(status);
  return { isCancelled, currentIdx };
}

describe('getJourneyProgress', () => {
  test('ORDER_PLACED → index 0',           () => expect(getJourneyProgress('ORDER_PLACED').currentIdx).toBe(0));
  test('PROCESSING → index 1',             () => expect(getJourneyProgress('PROCESSING').currentIdx).toBe(1));
  test('SHIPPED → index 2',               () => expect(getJourneyProgress('SHIPPED').currentIdx).toBe(2));
  test('DELIVERED → index 3',             () => expect(getJourneyProgress('DELIVERED').currentIdx).toBe(3));
  test('CANCELLED → isCancelled=true',     () => expect(getJourneyProgress('CANCELLED').isCancelled).toBe(true));
  test('REFUNDED → isCancelled=true',      () => expect(getJourneyProgress('REFUNDED').isCancelled).toBe(true));
  test('RETURN_REQUESTED → isCancelled=true', () => expect(getJourneyProgress('RETURN_REQUESTED').isCancelled).toBe(true));
  test('CANCELLED → index -1 (not in journey)', () => expect(getJourneyProgress('CANCELLED').currentIdx).toBe(-1));
});

// ─── GAP 5: Vendor registration form validation ───────────────────

interface VendorRegErrors { bizName?:string; bizType?:string; address?:string; phone?:string; modules?:string; ownerName?:string; ownerEmail?:string; ownerPwd?:string }

function validateVendorReg(d: {
  bizName:string; bizType:string; address:string; phone:string;
  modules:Record<string,boolean>; ownerName:string; ownerEmail:string; ownerPwd:string;
}): VendorRegErrors {
  const e: VendorRegErrors = {};
  if (!d.bizName.trim() || d.bizName.trim().length < 2)       e.bizName   = 'Business name required';
  if (!d.bizType.trim())                                        e.bizType   = 'Business type required';
  if (!d.address.trim() || d.address.trim().length < 5)        e.address   = 'Valid address required';
  if (!/^[0-9+\-\s()]{7,20}$/.test(d.phone))                  e.phone     = 'Invalid phone';
  if (!Object.values(d.modules).some(Boolean))                  e.modules   = 'Select at least one module';
  if (!d.ownerName.trim() || d.ownerName.trim().length < 2)   e.ownerName  = 'Owner name required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.ownerEmail))       e.ownerEmail = 'Valid email required';
  if (d.ownerPwd.length < 8)                                    e.ownerPwd  = 'Password min 8 chars';
  return e;
}

describe('validateVendorReg', () => {
  const valid = {
    bizName:'Acme Salon', bizType:'salon', address:'12 Anna Salai, Chennai', phone:'+91 9876543210',
    modules:{ booking:true, inventory:false, billing:false, ecommerce:false },
    ownerName:'Priya Kumar', ownerEmail:'priya@acme.in', ownerPwd:'Salon@123',
  };
  test('passes valid input',             () => expect(Object.keys(validateVendorReg(valid))).toHaveLength(0));
  test('rejects short business name',    () => expect(validateVendorReg({ ...valid, bizName: 'A' })).toHaveProperty('bizName'));
  test('rejects empty business type',    () => expect(validateVendorReg({ ...valid, bizType: '' })).toHaveProperty('bizType'));
  test('rejects short address',          () => expect(validateVendorReg({ ...valid, address: 'A' })).toHaveProperty('address'));
  test('rejects invalid phone',          () => expect(validateVendorReg({ ...valid, phone: 'abc' })).toHaveProperty('phone'));
  test('rejects no modules selected',    () => expect(validateVendorReg({ ...valid, modules: { booking:false, inventory:false, billing:false, ecommerce:false } })).toHaveProperty('modules'));
  test('accepts single module selected', () => expect(validateVendorReg(valid)).not.toHaveProperty('modules'));
  test('rejects invalid owner email',    () => expect(validateVendorReg({ ...valid, ownerEmail: 'bad' })).toHaveProperty('ownerEmail'));
  test('rejects short password',         () => expect(validateVendorReg({ ...valid, ownerPwd: 'short' })).toHaveProperty('ownerPwd'));
});

// ─── GAP 6: Customer list builder ────────────────────────────────

interface OrderSummary { customerName:string; total:number; createdAt:string }
interface BookingSummary { customerName:string; createdAt:string }

function buildCustomerList(orders: OrderSummary[], bookings: BookingSummary[]) {
  const map = new Map<string, { name:string; orderCount:number; totalSpend:number; bookingCount:number; lastActivity:string }>();
  for (const o of orders) {
    const ex = map.get(o.customerName) ?? { name:o.customerName, orderCount:0, totalSpend:0, bookingCount:0, lastActivity:o.createdAt };
    ex.orderCount += 1;
    ex.totalSpend  = Math.round((ex.totalSpend + o.total) * 100) / 100;
    if (o.createdAt > ex.lastActivity) ex.lastActivity = o.createdAt;
    map.set(o.customerName, ex);
  }
  for (const b of bookings) {
    const ex = map.get(b.customerName) ?? { name:b.customerName, orderCount:0, totalSpend:0, bookingCount:0, lastActivity:b.createdAt };
    ex.bookingCount += 1;
    if (b.createdAt > ex.lastActivity) ex.lastActivity = b.createdAt;
    map.set(b.customerName, ex);
  }
  return Array.from(map.values()).sort((a,b) => b.lastActivity.localeCompare(a.lastActivity));
}

describe('buildCustomerList', () => {
  const orders   = [{ customerName:'Alice', total:500, createdAt:'2026-06-01' }, { customerName:'Alice', total:200, createdAt:'2026-06-10' }];
  const bookings = [{ customerName:'Bob', createdAt:'2026-06-05' }];

  test('deduplicates customers across orders', () => expect(buildCustomerList(orders, [])).toHaveLength(1));
  test('aggregates order count correctly',     () => expect(buildCustomerList(orders, [])[0].orderCount).toBe(2));
  test('aggregates total spend correctly',     () => expect(buildCustomerList(orders, [])[0].totalSpend).toBe(700));
  test('includes booking-only customers',      () => expect(buildCustomerList([], bookings)).toHaveLength(1));
  test('merges order and booking customers',   () => expect(buildCustomerList(orders, bookings)).toHaveLength(2));
  test('sorts by lastActivity desc',           () => {
    const result = buildCustomerList(orders, bookings);
    expect(result[0].lastActivity >= result[1].lastActivity).toBe(true);
  });
  test('booking count accumulated',            () => {
    const b2 = [{ customerName:'Alice', createdAt:'2026-07-01' }, { customerName:'Alice', createdAt:'2026-07-02' }];
    const r  = buildCustomerList([], b2);
    expect(r[0].bookingCount).toBe(2);
  });
  test('empty inputs return empty array',      () => expect(buildCustomerList([], [])).toHaveLength(0));
});
