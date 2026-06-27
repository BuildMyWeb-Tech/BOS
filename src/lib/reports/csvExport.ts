// src/lib/reports/csvExport.ts
//
// Minimal CSV serializer — no external dependency needed for this scale
// of export. Handles quoting fields that contain commas, quotes, or newlines
// per RFC 4180.

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCsvField).join(',')];

  for (const row of rows) {
    lines.push(headers.map(h => escapeCsvField(row[h])).join(','));
  }

  return lines.join('\r\n');
}

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
