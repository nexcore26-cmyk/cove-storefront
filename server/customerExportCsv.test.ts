/**
 * Phase 68 — Customer CSV Export Tests
 *
 * Tests for:
 * - exportCsv: returns correct CSV headers
 * - exportCsv: row count matches input data
 * - exportCsv: CSV escaping works correctly for special characters
 * - exportCsv: filename format is correct
 */
import { describe, it, expect } from "vitest";

// ── CSV builder logic (mirrors server/routers/customers.ts) ───────────────────
const escapeCsv = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildCsv = (rows: any[]) => {
  const headers = [
    'ID', 'First Name', 'Last Name', 'Email', 'Phone',
    'Country', 'Area', 'Total Orders', 'Total Spent (KWD)',
    'Created At', 'Notes',
  ];

  const csvLines = [
    headers.join(','),
    ...rows.map(r => [
      r.id,
      escapeCsv(r.firstName),
      escapeCsv(r.lastName),
      escapeCsv(r.email),
      escapeCsv(r.phone),
      escapeCsv(r.country),
      escapeCsv(r.area),
      r.totalOrders ?? 0,
      r.totalSpent ?? '0.000',
      r.createdAt ? new Date(r.createdAt).toISOString() : '',
      escapeCsv(r.notes),
    ].join(',')),
  ];

  return {
    csv: csvLines.join('\n'),
    count: rows.length,
    filename: `customers-export-${new Date().toISOString().slice(0, 10)}.csv`,
  };
};

// ── Sample data ───────────────────────────────────────────────────────────────
const sampleCustomers = [
  {
    id: 1,
    firstName: 'Ahmed',
    lastName: 'Al-Rashid',
    email: 'ahmed@example.com',
    phone: '+96512345678',
    country: 'KW',
    area: 'Salmiya',
    totalOrders: 5,
    totalSpent: '125.500',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    notes: null,
  },
  {
    id: 2,
    firstName: 'Sara',
    lastName: 'Hassan',
    email: 'sara@example.com',
    phone: '+96598765432',
    country: 'KW',
    area: 'Kuwait City',
    totalOrders: 2,
    totalSpent: '45.000',
    createdAt: new Date('2024-03-20T14:30:00Z'),
    notes: 'VIP customer, prefers morning delivery',
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("P68 — customers.exportCsv logic", () => {
  it("should return correct CSV headers as first line", () => {
    const result = buildCsv([]);
    const lines = result.csv.split('\n');
    expect(lines[0]).toBe('ID,First Name,Last Name,Email,Phone,Country,Area,Total Orders,Total Spent (KWD),Created At,Notes');
  });

  it("should return correct row count", () => {
    const result = buildCsv(sampleCustomers);
    expect(result.count).toBe(2);
    const lines = result.csv.split('\n');
    // 1 header + 2 data rows
    expect(lines).toHaveLength(3);
  });

  it("should return count=0 and only header line for empty customer list", () => {
    const result = buildCsv([]);
    expect(result.count).toBe(0);
    const lines = result.csv.split('\n');
    expect(lines).toHaveLength(1); // only header
  });

  it("should correctly serialize customer fields in CSV row", () => {
    const result = buildCsv([sampleCustomers[0]]);
    const lines = result.csv.split('\n');
    const dataRow = lines[1];
    expect(dataRow).toContain('Ahmed');
    expect(dataRow).toContain('Al-Rashid');
    expect(dataRow).toContain('ahmed@example.com');
    expect(dataRow).toContain('+96512345678');
    expect(dataRow).toContain('KW');
    expect(dataRow).toContain('Salmiya');
    expect(dataRow).toContain('5');
    expect(dataRow).toContain('125.500');
  });

  it("should wrap values containing commas in double quotes", () => {
    const customerWithComma = {
      ...sampleCustomers[0],
      notes: 'Prefers morning, afternoon delivery',
    };
    const result = buildCsv([customerWithComma]);
    const lines = result.csv.split('\n');
    expect(lines[1]).toContain('"Prefers morning, afternoon delivery"');
  });

  it("should escape double quotes in CSV values", () => {
    const customerWithQuotes = {
      ...sampleCustomers[0],
      notes: 'He said "hello"',
    };
    const result = buildCsv([customerWithQuotes]);
    const lines = result.csv.split('\n');
    expect(lines[1]).toContain('"He said ""hello"""');
  });

  it("should handle null/undefined fields gracefully", () => {
    const customerWithNulls = {
      id: 3,
      firstName: null,
      lastName: null,
      email: 'test@example.com',
      phone: null,
      country: null,
      area: null,
      totalOrders: null,
      totalSpent: null,
      createdAt: null,
      notes: null,
    };
    const result = buildCsv([customerWithNulls]);
    expect(result.count).toBe(1);
    const lines = result.csv.split('\n');
    // Should not throw, row should exist
    expect(lines).toHaveLength(2);
    // null totalOrders → 0, null totalSpent → '0.000'
    expect(lines[1]).toContain(',0,');
    expect(lines[1]).toContain(',0.000,');
  });

  it("should produce a filename with today's date in YYYY-MM-DD format", () => {
    const result = buildCsv([]);
    const today = new Date().toISOString().slice(0, 10);
    expect(result.filename).toBe(`customers-export-${today}.csv`);
    expect(result.filename).toMatch(/^customers-export-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("should correctly serialize ISO date for createdAt", () => {
    const result = buildCsv([sampleCustomers[0]]);
    const lines = result.csv.split('\n');
    expect(lines[1]).toContain('2024-01-15T10:00:00.000Z');
  });
});
