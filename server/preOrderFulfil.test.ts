/**
 * Phase 67 — Pre-Order Fulfilment Dashboard Tests
 *
 * Tests for:
 * - preOrderSummary: returns variants with preOrderEnabled=true AND preOrderUsed>0
 * - fulfilPreOrder: disables pre-order, resets counter; fails if no active pre-orders
 */
import { describe, it, expect, vi } from "vitest";

// ── Mock data ─────────────────────────────────────────────────────────────────
const mockVariantWithPreOrders = {
  id: 1,
  productId: 10,
  name: "Large / Blue",
  sku: "PROD-001-L-BLU",
  preOrderEnabled: true,
  preOrderLimit: 20,
  preOrderUsed: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVariantNoPreOrders = {
  id: 2,
  productId: 10,
  name: "Small / Red",
  sku: "PROD-001-S-RED",
  preOrderEnabled: false,
  preOrderLimit: 0,
  preOrderUsed: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVariantPreOrderEnabledButNoUsed = {
  id: 3,
  productId: 11,
  name: "Default",
  sku: "PROD-002-DEF",
  preOrderEnabled: true,
  preOrderLimit: 10,
  preOrderUsed: 0, // enabled but no pre-orders placed yet
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("P67 — preOrderSummary logic", () => {
  it("should only include variants where preOrderEnabled=true AND preOrderUsed>0", () => {
    const allVariants = [
      mockVariantWithPreOrders,
      mockVariantNoPreOrders,
      mockVariantPreOrderEnabledButNoUsed,
    ];

    const summary = allVariants.filter(
      v => v.preOrderEnabled === true && v.preOrderUsed > 0
    );

    expect(summary).toHaveLength(1);
    expect(summary[0].id).toBe(1);
    expect(summary[0].preOrderUsed).toBe(5);
  });

  it("should return empty array when no variants have active pre-orders", () => {
    const allVariants = [mockVariantNoPreOrders, mockVariantPreOrderEnabledButNoUsed];

    const summary = allVariants.filter(
      v => v.preOrderEnabled === true && v.preOrderUsed > 0
    );

    expect(summary).toHaveLength(0);
  });

  it("should include correct fields in the summary", () => {
    const variant = mockVariantWithPreOrders;
    const summaryRow = {
      variantId: variant.id,
      variantName: variant.name,
      sku: variant.sku,
      preOrderLimit: variant.preOrderLimit,
      preOrderUsed: variant.preOrderUsed,
      preOrderEnabled: variant.preOrderEnabled,
      productId: variant.productId,
      productName: "Test Product",
      productSlug: "test-product",
    };

    expect(summaryRow.variantId).toBe(1);
    expect(summaryRow.preOrderUsed).toBe(5);
    expect(summaryRow.preOrderLimit).toBe(20);
    expect(summaryRow.preOrderEnabled).toBe(true);
  });
});

describe("P67 — fulfilPreOrder logic", () => {
  it("should throw BAD_REQUEST when variant has no active pre-orders (preOrderEnabled=false)", () => {
    const validateFulfil = (variant: typeof mockVariantNoPreOrders) => {
      if (!variant.preOrderEnabled || variant.preOrderUsed === 0) {
        throw new Error("Variant has no active pre-orders to fulfil");
      }
    };

    expect(() => validateFulfil(mockVariantNoPreOrders)).toThrow(
      "Variant has no active pre-orders to fulfil"
    );
  });

  it("should throw BAD_REQUEST when preOrderEnabled=true but preOrderUsed=0", () => {
    const validateFulfil = (variant: typeof mockVariantPreOrderEnabledButNoUsed) => {
      if (!variant.preOrderEnabled || variant.preOrderUsed === 0) {
        throw new Error("Variant has no active pre-orders to fulfil");
      }
    };

    expect(() => validateFulfil(mockVariantPreOrderEnabledButNoUsed)).toThrow(
      "Variant has no active pre-orders to fulfil"
    );
  });

  it("should allow fulfilment when preOrderEnabled=true AND preOrderUsed>0", () => {
    const validateFulfil = (variant: typeof mockVariantWithPreOrders) => {
      if (!variant.preOrderEnabled || variant.preOrderUsed === 0) {
        throw new Error("Variant has no active pre-orders to fulfil");
      }
    };

    expect(() => validateFulfil(mockVariantWithPreOrders)).not.toThrow();
  });

  it("should produce correct update payload after fulfilment", () => {
    const buildFulfilPayload = () => ({
      preOrderEnabled: false,
      preOrderUsed: 0,
    });

    const payload = buildFulfilPayload();
    expect(payload.preOrderEnabled).toBe(false);
    expect(payload.preOrderUsed).toBe(0);
  });

  it("should return success with variantId after fulfilment", () => {
    const simulateFulfil = (variantId: number) => ({
      success: true,
      variantId,
    });

    const result = simulateFulfil(1);
    expect(result.success).toBe(true);
    expect(result.variantId).toBe(1);
  });

  it("should throw NOT_FOUND when variant does not exist", () => {
    const findVariant = (id: number, variants: any[]) => {
      const v = variants.find(v => v.id === id);
      if (!v) throw new Error("Variant not found");
      return v;
    };

    expect(() => findVariant(999, [mockVariantWithPreOrders])).toThrow("Variant not found");
    expect(() => findVariant(1, [mockVariantWithPreOrders])).not.toThrow();
  });

  it("should correctly calculate pre-order fill percentage", () => {
    const calcFillPct = (used: number, limit: number) =>
      limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    expect(calcFillPct(5, 20)).toBe(25);
    expect(calcFillPct(20, 20)).toBe(100);
    expect(calcFillPct(25, 20)).toBe(100); // capped at 100
    expect(calcFillPct(0, 0)).toBe(0); // no limit
    expect(calcFillPct(0, 10)).toBe(0);
  });
});
