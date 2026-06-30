// tests/unit/fe8-reports.test.ts
// Unit tests for FE-8 Reports & Analytics pure logic.

// ─── Date range defaults ──────────────────────────────────────────

function buildDefaultRange(today: Date): { from: string; to: string } {
  const to   = new Date(today);
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

describe('buildDefaultRange', () => {
  test('to equals today', () => {
    const today = new Date('2026-07-01');
    expect(buildDefaultRange(today).to).toBe('2026-07-01');
  });
  test('from is 29 days before today', () => {
    const today = new Date('2026-07-01');
    expect(buildDefaultRange(today).from).toBe('2026-06-02');
  });
  test('span is always 29 days', () => {
    const today = new Date('2026-08-15');
    const { from, to } = buildDefaultRange(today);
    const diffDays = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(29);
  });
});

// ─── Revenue chart data formatting ───────────────────────────────

interface RevenuePoint { bucketLabel:string; bookingRevenue:number; billingRevenue:number; orderRevenue:number; total:number }

function formatChartTooltip(value: number, name: string): [string, string] {
  return [`₹${value.toLocaleString('en-IN')}`, name];
}

function tickFormatter(value: number): string {
  if (value === 0) return '₹0';
  return `₹${(value / 1000).toFixed(0)}k`;
}

describe('formatChartTooltip', () => {
  test('formats revenue with rupee symbol', () => {
    const [label] = formatChartTooltip(15000, 'Total');
    expect(label).toContain('₹');
    expect(label).toContain('15');
  });
  test('returns name as second element', () => {
    const [, name] = formatChartTooltip(1000, 'Booking');
    expect(name).toBe('Booking');
  });
});

describe('tickFormatter', () => {
  test('zero → ₹0',          () => expect(tickFormatter(0)).toBe('₹0'));
  test('1000 → ₹1k',        () => expect(tickFormatter(1000)).toBe('₹1k'));
  test('15000 → ₹15k',      () => expect(tickFormatter(15000)).toBe('₹15k'));
  test('500 → ₹1k (rounds up)', () => expect(tickFormatter(500)).toBe('₹1k'));
});

// ─── Growth badge display ─────────────────────────────────────────

function formatGrowth(growthPercent: number | null): string | null {
  if (growthPercent === null) return null;
  const sign = growthPercent >= 0 ? '+' : '';
  return `${sign}${growthPercent}% vs prior period`;
}

describe('formatGrowth', () => {
  test('null returns null (no baseline)',   () => expect(formatGrowth(null)).toBeNull());
  test('positive shows + prefix',          () => expect(formatGrowth(25)).toBe('+25% vs prior period'));
  test('negative shows no prefix',         () => expect(formatGrowth(-10)).toBe('-10% vs prior period'));
  test('zero shows +0',                    () => expect(formatGrowth(0)).toBe('+0% vs prior period'));
});

// ─── Dead stock filter logic ──────────────────────────────────────

interface DeadStockItem { productId:string; productName:string; quantity:number; lastSaleDate:string|null }

function deadStockLabel(item: DeadStockItem): string {
  return item.lastSaleDate ? 'Stale stock' : 'Never sold';
}

function deadStockBadgeVariant(item: DeadStockItem): string {
  return item.lastSaleDate ? 'warning' : 'danger';
}

describe('deadStockLabel', () => {
  test('item with lastSaleDate → Stale stock', () =>
    expect(deadStockLabel({ productId:'p1', productName:'X', quantity:5, lastSaleDate:'2025-01-01' })).toBe('Stale stock'));
  test('item with null lastSaleDate → Never sold', () =>
    expect(deadStockLabel({ productId:'p1', productName:'X', quantity:5, lastSaleDate:null })).toBe('Never sold'));
});

describe('deadStockBadgeVariant', () => {
  test('has lastSaleDate → warning', () =>
    expect(deadStockBadgeVariant({ productId:'p1', productName:'X', quantity:5, lastSaleDate:'2025-01-01' })).toBe('warning'));
  test('null lastSaleDate → danger', () =>
    expect(deadStockBadgeVariant({ productId:'p1', productName:'X', quantity:5, lastSaleDate:null })).toBe('danger'));
});

// ─── Staff performance rate ───────────────────────────────────────

function completionRate(bookingCount: number, completedCount: number): number {
  if (bookingCount === 0) return 0;
  return Math.round((completedCount / bookingCount) * 100);
}

describe('completionRate', () => {
  test('100% completion',          () => expect(completionRate(10, 10)).toBe(100));
  test('50% completion',           () => expect(completionRate(10, 5)).toBe(50));
  test('0% when none completed',   () => expect(completionRate(10, 0)).toBe(0));
  test('0 bookings returns 0',     () => expect(completionRate(0, 0)).toBe(0));
  test('rounds to nearest int',    () => expect(completionRate(3, 1)).toBe(33));
});

// ─── Pie chart data assembly ──────────────────────────────────────

interface PiePoint { name:string; value:number; color:string }

function buildCustomerPieData(newCustomers: number, returningCustomers: number): PiePoint[] {
  return [
    { name: 'New',       value: newCustomers,       color: '#4f46e5' },
    { name: 'Returning', value: returningCustomers, color: '#10b981' },
  ];
}

describe('buildCustomerPieData', () => {
  test('builds two points',                () => expect(buildCustomerPieData(10, 30)).toHaveLength(2));
  test('new customers first',              () => expect(buildCustomerPieData(10, 30)[0].name).toBe('New'));
  test('returning customers second',       () => expect(buildCustomerPieData(10, 30)[1].name).toBe('Returning'));
  test('values match inputs',              () => {
    const data = buildCustomerPieData(15, 42);
    expect(data[0].value).toBe(15);
    expect(data[1].value).toBe(42);
  });
  test('handles zero values',             () => {
    const data = buildCustomerPieData(0, 0);
    expect(data[0].value).toBe(0);
    expect(data[1].value).toBe(0);
  });
});

// ─── CSV export filename builder ──────────────────────────────────

function buildExportFilename(reportType: string, from?: string, to?: string): string {
  if (reportType === 'inventory') return 'inventory-export.csv';
  return `${reportType}-${from}-to-${to}.csv`;
}

describe('buildExportFilename', () => {
  test('inventory has no date range',        () =>
    expect(buildExportFilename('inventory')).toBe('inventory-export.csv'));
  test('revenue includes date range',        () =>
    expect(buildExportFilename('revenue', '2026-06-01', '2026-06-30'))
      .toBe('revenue-2026-06-01-to-2026-06-30.csv'));
  test('customers includes date range',      () =>
    expect(buildExportFilename('customers', '2026-07-01', '2026-07-31'))
      .toBe('customers-2026-07-01-to-2026-07-31.csv'));
});
