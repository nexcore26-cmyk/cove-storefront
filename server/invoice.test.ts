/**
 * Invoice PDF Generator — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { generateInvoicePdf, type InvoiceData } from './invoice';

const sampleData: InvoiceData = {
  orderNumber: 'COV-2024-001',
  orderDate: new Date('2024-01-15T10:00:00Z'),
  status: 'pending',
  customerName: 'Ahmed Al-Rashid',
  customerEmail: 'ahmed@example.com',
  customerPhone: '+965 9999 1234',
  address: {
    country: 'KW',
    area: 'Salmiya',
    block: '12',
    street: '45',
    avenue: '3',
    house: '7A',
  },
  items: [
    {
      name: 'Luxury Sofa Set',
      variantName: 'Beige / 3-Seater',
      qty: 1,
      unitPrice: 450.0,
      lineTotal: 450.0,
    },
    {
      name: 'Coffee Table',
      qty: 2,
      unitPrice: 85.5,
      lineTotal: 171.0,
    },
  ],
  subtotal: 621.0,
  shippingCost: 5.0,
  discount: 0,
  total: 626.0,
  currency: 'KWD',
  paymentMethod: 'Cash on Delivery',
};

describe('generateInvoicePdf', () => {
  it('returns a non-empty Buffer', async () => {
    const buf = await generateInvoicePdf(sampleData);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('produces a valid PDF (starts with %PDF header)', async () => {
    const buf = await generateInvoicePdf(sampleData);
    const header = buf.slice(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });

  it('generates PDF for order with discount', async () => {
    const withDiscount = { ...sampleData, discount: 20.0, total: 606.0 };
    const buf = await generateInvoicePdf(withDiscount);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('generates PDF for order with free shipping', async () => {
    const freeShipping = { ...sampleData, shippingCost: 0, total: 621.0 };
    const buf = await generateInvoicePdf(freeShipping);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('generates PDF for order with measurement-based items', async () => {
    const withMeasurement: InvoiceData = {
      ...sampleData,
      items: [
        {
          name: 'Carpet',
          qty: 1,
          qtyValue: 3.5,
          measurementType: 'meter',
          unitPrice: 25.0,
          lineTotal: 87.5,
        },
      ],
      subtotal: 87.5,
      total: 92.5,
    };
    const buf = await generateInvoicePdf(withMeasurement);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('generates PDF for order with many items (overflow guard)', async () => {
    const manyItems = Array.from({ length: 30 }, (_, i) => ({
      name: `Product ${i + 1}`,
      qty: 1,
      unitPrice: 10.0,
      lineTotal: 10.0,
    }));
    const buf = await generateInvoicePdf({ ...sampleData, items: manyItems, subtotal: 300, total: 305 });
    expect(buf.length).toBeGreaterThan(1000);
  });
});
