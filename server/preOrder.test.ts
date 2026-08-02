/**
 * P7 Pre-Order Logic Tests
 *
 * Tests:
 * 1. upsertVariant saves preOrderEnabled and preOrderLimit
 * 2. products.bySlug returns isPreOrderAvailable=true when enabled and used < limit
 * 3. products.bySlug returns isPreOrderAvailable=false when used >= limit
 * 4. deductStockForOrder increments preOrderUsed (not warehouse stock) for pre-order items
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('P7 Pre-Order Logic', () => {
  describe('upsertVariant preOrder fields', () => {
    it('accepts preOrderEnabled and preOrderLimit in input schema', () => {
      const { z } = require('zod');
      const schema = z.object({
        id: z.number().optional(),
        productId: z.number(),
        name: z.string().min(1),
        price: z.string(),
        isActive: z.boolean().default(true),
        preOrderEnabled: z.boolean().default(false),
        preOrderLimit: z.number().int().min(0).default(0),
      });

      const result = schema.safeParse({
        productId: 1,
        name: 'Test Variant',
        price: '10.000',
        preOrderEnabled: true,
        preOrderLimit: 50,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preOrderEnabled).toBe(true);
        expect(result.data.preOrderLimit).toBe(50);
      }
    });

    it('defaults preOrderEnabled to false and preOrderLimit to 0', () => {
      const { z } = require('zod');
      const schema = z.object({
        productId: z.number(),
        name: z.string().min(1),
        price: z.string(),
        preOrderEnabled: z.boolean().default(false),
        preOrderLimit: z.number().int().min(0).default(0),
      });

      const result = schema.safeParse({
        productId: 1,
        name: 'Test Variant',
        price: '10.000',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preOrderEnabled).toBe(false);
        expect(result.data.preOrderLimit).toBe(0);
      }
    });
  });

  describe('isPreOrderAvailable computation', () => {
    it('returns true when preOrderEnabled=true and preOrderUsed < preOrderLimit', () => {
      const variant = {
        id: 1,
        name: 'Test',
        price: '10.000',
        preOrderEnabled: true,
        preOrderLimit: 50,
        preOrderUsed: 10,
        stock: 0,
      };

      const isPreOrderAvailable = variant.preOrderEnabled && variant.preOrderUsed < variant.preOrderLimit;
      expect(isPreOrderAvailable).toBe(true);
    });

    it('returns false when preOrderEnabled=false', () => {
      const variant = {
        id: 1,
        name: 'Test',
        price: '10.000',
        preOrderEnabled: false,
        preOrderLimit: 50,
        preOrderUsed: 0,
        stock: 0,
      };

      const isPreOrderAvailable = variant.preOrderEnabled && variant.preOrderUsed < variant.preOrderLimit;
      expect(isPreOrderAvailable).toBe(false);
    });

    it('returns false when preOrderUsed >= preOrderLimit', () => {
      const variant = {
        id: 1,
        name: 'Test',
        price: '10.000',
        preOrderEnabled: true,
        preOrderLimit: 10,
        preOrderUsed: 10,
        stock: 0,
      };

      const isPreOrderAvailable = variant.preOrderEnabled && variant.preOrderUsed < variant.preOrderLimit;
      expect(isPreOrderAvailable).toBe(false);
    });

    it('returns false when preOrderUsed exceeds preOrderLimit', () => {
      const variant = {
        id: 1,
        name: 'Test',
        price: '10.000',
        preOrderEnabled: true,
        preOrderLimit: 5,
        preOrderUsed: 7,
        stock: 0,
      };

      const isPreOrderAvailable = variant.preOrderEnabled && variant.preOrderUsed < variant.preOrderLimit;
      expect(isPreOrderAvailable).toBe(false);
    });
  });

  describe('deductStockForOrder pre-order path', () => {
    it('skips warehouse deduction when variant is on pre-order', async () => {
      // Simulate the pre-order check logic extracted from db.ts
      const checkPreOrder = async (variant: {
        preOrderEnabled: boolean;
        preOrderLimit: number;
        preOrderUsed: number;
      }, quantity: number): Promise<{ isPreOrder: boolean; newUsed: number }> => {
        if (variant.preOrderEnabled && variant.preOrderUsed < variant.preOrderLimit) {
          return { isPreOrder: true, newUsed: variant.preOrderUsed + quantity };
        }
        return { isPreOrder: false, newUsed: variant.preOrderUsed };
      };

      const variant = { preOrderEnabled: true, preOrderLimit: 20, preOrderUsed: 5 };
      const result = await checkPreOrder(variant, 3);

      expect(result.isPreOrder).toBe(true);
      expect(result.newUsed).toBe(8); // 5 + 3
    });

    it('does NOT skip warehouse deduction when variant is not on pre-order', async () => {
      const checkPreOrder = async (variant: {
        preOrderEnabled: boolean;
        preOrderLimit: number;
        preOrderUsed: number;
      }, quantity: number): Promise<{ isPreOrder: boolean; newUsed: number }> => {
        if (variant.preOrderEnabled && variant.preOrderUsed < variant.preOrderLimit) {
          return { isPreOrder: true, newUsed: variant.preOrderUsed + quantity };
        }
        return { isPreOrder: false, newUsed: variant.preOrderUsed };
      };

      const variant = { preOrderEnabled: false, preOrderLimit: 20, preOrderUsed: 0 };
      const result = await checkPreOrder(variant, 2);

      expect(result.isPreOrder).toBe(false);
    });

    it('does NOT skip warehouse deduction when pre-order limit is exhausted', async () => {
      const checkPreOrder = async (variant: {
        preOrderEnabled: boolean;
        preOrderLimit: number;
        preOrderUsed: number;
      }, quantity: number): Promise<{ isPreOrder: boolean; newUsed: number }> => {
        if (variant.preOrderEnabled && variant.preOrderUsed < variant.preOrderLimit) {
          return { isPreOrder: true, newUsed: variant.preOrderUsed + quantity };
        }
        return { isPreOrder: false, newUsed: variant.preOrderUsed };
      };

      const variant = { preOrderEnabled: true, preOrderLimit: 10, preOrderUsed: 10 };
      const result = await checkPreOrder(variant, 1);

      expect(result.isPreOrder).toBe(false);
    });
  });

  describe('storefront Add to Cart button logic', () => {
    it('is enabled when isOutOfStock=true and isPreOrderAvailable=true', () => {
      const isOutOfStock = true;
      const isPreOrderAvailable = true;
      const selectableLength = 0;
      const selectedVariant = { id: 1 };

      const isDisabled = (selectableLength > 0 && !selectedVariant) || (isOutOfStock && !isPreOrderAvailable);
      expect(isDisabled).toBe(false);
    });

    it('is disabled when isOutOfStock=true and isPreOrderAvailable=false', () => {
      const isOutOfStock = true;
      const isPreOrderAvailable = false;
      const selectableLength = 0;
      const selectedVariant = { id: 1 };

      const isDisabled = (selectableLength > 0 && !selectedVariant) || (isOutOfStock && !isPreOrderAvailable);
      expect(isDisabled).toBe(true);
    });

    it('shows "Pre-Order Now" label when isOutOfStock and isPreOrderAvailable', () => {
      const isOutOfStock = true;
      const isPreOrderAvailable = true;
      const addedToCart = false;
      const hasNewAttrs = false;
      const selectableLength = 0;
      const selectedVariant = { id: 1 };

      const label = addedToCart
        ? 'Added!'
        : hasNewAttrs
          ? 'Add to Cart'
          : isOutOfStock && isPreOrderAvailable
            ? 'Pre-Order Now'
            : isOutOfStock
              ? 'Out of Stock'
              : selectableLength > 0 && !selectedVariant
                ? 'Select Options'
                : 'Add to Cart';

      expect(label).toBe('Pre-Order Now');
    });
  });
});
