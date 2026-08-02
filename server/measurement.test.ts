/**
 * Phase 20: Measurement System Tests
 * Tests pricing engine logic and order item measurement type handling
 */
import { describe, it, expect } from 'vitest';

// --- Pricing Engine ---
function calculatePrice(unitPrice: number, qtyValue: number): number {
  return Math.round(unitPrice * qtyValue * 1000) / 1000;
}

describe('calculatePrice', () => {
  it('unit product: price × qty = total', () => {
    expect(calculatePrice(100, 3)).toBe(300);
  });

  it('meter product: price × meters = total', () => {
    expect(calculatePrice(25.5, 2.5)).toBe(63.75);
  });

  it('kg product: price × kg = total', () => {
    expect(calculatePrice(15.0, 0.75)).toBe(11.25);
  });

  it('handles zero qty', () => {
    expect(calculatePrice(100, 0)).toBe(0);
  });

  it('rounds to 3 decimal places', () => {
    expect(calculatePrice(10.001, 3)).toBe(30.003);
  });
});

// --- Measurement Type Validation ---
const VALID_MEASUREMENT_TYPES = ['unit', 'meter', 'kg', 'roll', 'box'] as const;
type MeasurementType = typeof VALID_MEASUREMENT_TYPES[number];

function isValidMeasurementType(val: string): val is MeasurementType {
  return VALID_MEASUREMENT_TYPES.includes(val as MeasurementType);
}

describe('measurementType validation', () => {
  it('accepts all valid types', () => {
    for (const t of VALID_MEASUREMENT_TYPES) {
      expect(isValidMeasurementType(t)).toBe(true);
    }
  });

  it('rejects invalid types', () => {
    expect(isValidMeasurementType('liter')).toBe(false);
    expect(isValidMeasurementType('')).toBe(false);
    expect(isValidMeasurementType('UNIT')).toBe(false);
  });
});

// --- Order Item Total Calculation ---
interface OrderItem {
  price: number;
  qtyValue: number;
  measurementType: MeasurementType;
}

function calcOrderItemTotal(item: OrderItem): number {
  return calculatePrice(item.price, item.qtyValue);
}

function calcOrderTotal(items: OrderItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + calcOrderItemTotal(item), 0) * 1000) / 1000;
}

describe('order total calculation', () => {
  it('calculates total for mixed measurement types', () => {
    const items: OrderItem[] = [
      { price: 100, qtyValue: 2, measurementType: 'unit' },    // 200
      { price: 25, qtyValue: 3.5, measurementType: 'meter' },  // 87.5
      { price: 50, qtyValue: 1, measurementType: 'box' },      // 50
    ];
    expect(calcOrderTotal(items)).toBe(337.5);
  });

  it('empty cart returns 0', () => {
    expect(calcOrderTotal([])).toBe(0);
  });
});

// --- Quantity Display Label ---
function getQtyLabel(measurementType: MeasurementType): string {
  const labels: Record<MeasurementType, string> = {
    unit: 'qty',
    meter: 'm',
    kg: 'kg',
    roll: 'roll',
    box: 'box',
  };
  return labels[measurementType];
}

describe('getQtyLabel', () => {
  it('returns correct label for each type', () => {
    expect(getQtyLabel('unit')).toBe('qty');
    expect(getQtyLabel('meter')).toBe('m');
    expect(getQtyLabel('kg')).toBe('kg');
    expect(getQtyLabel('roll')).toBe('roll');
    expect(getQtyLabel('box')).toBe('box');
  });
});
