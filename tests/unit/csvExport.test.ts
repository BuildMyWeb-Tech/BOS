// tests/unit/csvExport.test.ts
// Unit tests for src/lib/reports/csvExport.ts

import { toCsv } from '@/lib/reports/csvExport';

describe('toCsv — basic serialization', () => {
  test('produces a header row and data rows', () => {
    const csv = toCsv([{ name: 'Jane', age: 30 }, { name: 'Bob', age: 25 }]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('name,age');
    expect(lines[1]).toBe('Jane,30');
    expect(lines[2]).toBe('Bob,25');
  });

  test('returns empty string for empty input', () => {
    expect(toCsv([])).toBe('');
  });

  test('uses keys of the first row as headers', () => {
    const csv = toCsv([{ a: 1, b: 2 }]);
    expect(csv.split('\r\n')[0]).toBe('a,b');
  });
});

describe('toCsv — RFC 4180 escaping', () => {
  test('quotes a field containing a comma', () => {
    const csv = toCsv([{ name: 'Doe, Jane' }]);
    expect(csv).toContain('"Doe, Jane"');
  });

  test('quotes and escapes a field containing a double quote', () => {
    const csv = toCsv([{ note: 'She said "hello"' }]);
    expect(csv).toContain('"She said ""hello"""');
  });

  test('quotes a field containing a newline', () => {
    const csv = toCsv([{ note: 'line1\nline2' }]);
    expect(csv).toContain('"line1\nline2"');
  });

  test('does not quote a plain field', () => {
    const csv = toCsv([{ name: 'Simple' }]);
    expect(csv.split('\r\n')[1]).toBe('Simple');
  });

  test('handles null and undefined as empty fields', () => {
    const csv = toCsv([{ a: null, b: undefined, c: 'value' }]);
    expect(csv.split('\r\n')[1]).toBe(',,value');
  });

  test('handles numeric and boolean values', () => {
    const csv = toCsv([{ count: 5, active: true }]);
    expect(csv.split('\r\n')[1]).toBe('5,true');
  });
});

describe('toCsv — realistic report row shapes', () => {
  test('serializes a typical revenue export row set', () => {
    const csv = toCsv([
      { date: '2026-06-01', source: 'BILLING', amount: 1500.50 },
      { date: '2026-06-02', source: 'ORDER', amount: 750 },
    ]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('date,source,amount');
  });
});
