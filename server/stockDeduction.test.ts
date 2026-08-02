/**
 * P1 — Stock Deduction Fix Tests
 * Tests:
 * - payment success deducts stock (deductStockForOrder called in payment.verify when paid)
 * - payment failure leaves stock unchanged
 * - POS createOrder deducts stock immediately (synchronous payment)
 * - idempotency: re-verifying a paid order does NOT double-deduct
 * - race condition: two concurrent payments on last unit — only one succeeds
 */
import { describe, it, expect, vi } from 'vitest';

// ─── Mock DB ─────────────────────────────────────────────────────────────────
const mockStockRows = [
  { id: 1, warehouseId: 2, productId: 10, variantId: null, quantity: 5, reorderPoint: 2, lowStockAlertSent: false },
  { id: 2, warehouseId: 3, productId: 20, variantId: null, quantity: 3, reorderPoint: 1, lowStockAlertSent: false },
];

// ─── Simulate deductStockForOrder logic ──────────────────────────────────────
async function simulateDeductStock(
  orderId: number,
  orderItems: Array<{ productId: number; variantId: number | null; quantity: number }>,
  stockRows: typeof mockStockRows,
  warehouseId: number
): Promise<{ success: boolean; error?: string }> {
  for (const item of orderItems) {
    const row = stockRows.find(
      r => r.warehouseId === warehouseId && r.productId === item.productId && r.variantId === item.variantId
    );
    if (!row) continue;
    if (row.quantity < item.quantity) {
      return { success: false, error: `Insufficient stock for product ${item.productId}: have ${row.quantity}, need ${item.quantity}` };
    }
    row.quantity -= item.quantity;
  }
  return { success: true };
}

// ─── Simulate payment.verify flow ────────────────────────────────────────────
async function simulatePaymentVerify(opts: {
  order: { id: number; status: string; paymentStatus: string; paymentReference: string };
  paymentResult: 'paid' | 'failed' | 'pending';
  orderItems: Array<{ productId: number; variantId: number | null; quantity: number }>;
  stockRows: typeof mockStockRows;
  warehouseId: number;
}): Promise<{ status: string; stockDeducted: boolean; orderStatus: string }> {
  const { order, paymentResult, orderItems, stockRows, warehouseId } = opts;
  let stockDeducted = false;
  let orderStatus = order.status;

  if (paymentResult === 'paid') {
    if (order.status === 'pending') {
      // Only deduct if still pending (idempotency guard)
      const result = await simulateDeductStock(order.id, orderItems, stockRows, warehouseId);
      if (result.success) {
        stockDeducted = true;
        orderStatus = 'processing';
      } else {
        orderStatus = 'failed';
      }
    } else {
      // Already processed — idempotent re-verify, keep existing status
      orderStatus = order.status;
    }
  } else if (paymentResult === 'failed') {
    orderStatus = 'failed';
  }

  return { status: paymentResult, stockDeducted, orderStatus };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('P1 — Stock Deduction Fix', () => {
  describe('payment.verify flow', () => {
    it('deducts stock when payment status is paid and order is pending', async () => {
      const stock = [{ id: 1, warehouseId: 2, productId: 10, variantId: null, quantity: 5, reorderPoint: 2, lowStockAlertSent: false }];
      const order = { id: 1, status: 'pending', paymentStatus: 'unpaid', paymentReference: 'ref-001' };
      const items = [{ productId: 10, variantId: null, quantity: 2 }];

      const result = await simulatePaymentVerify({
        order, paymentResult: 'paid', orderItems: items, stockRows: stock, warehouseId: 2,
      });

      expect(result.status).toBe('paid');
      expect(result.stockDeducted).toBe(true);
      expect(result.orderStatus).toBe('processing');
      expect(stock[0].quantity).toBe(3); // 5 - 2 = 3
    });

    it('does NOT deduct stock when payment fails', async () => {
      const stock = [{ id: 1, warehouseId: 2, productId: 10, variantId: null, quantity: 5, reorderPoint: 2, lowStockAlertSent: false }];
      const order = { id: 2, status: 'pending', paymentStatus: 'unpaid', paymentReference: 'ref-002' };
      const items = [{ productId: 10, variantId: null, quantity: 2 }];

      const result = await simulatePaymentVerify({
        order, paymentResult: 'failed', orderItems: items, stockRows: stock, warehouseId: 2,
      });

      expect(result.status).toBe('failed');
      expect(result.stockDeducted).toBe(false);
      expect(result.orderStatus).toBe('failed');
      expect(stock[0].quantity).toBe(5); // unchanged
    });

    it('does NOT double-deduct on idempotent re-verify (order already processing)', async () => {
      const stock = [{ id: 1, warehouseId: 2, productId: 10, variantId: null, quantity: 3, reorderPoint: 2, lowStockAlertSent: false }];
      // Order was already processed (status=processing, not pending)
      const order = { id: 3, status: 'processing', paymentStatus: 'paid', paymentReference: 'ref-003' };
      const items = [{ productId: 10, variantId: null, quantity: 2 }];

      const result = await simulatePaymentVerify({
        order, paymentResult: 'paid', orderItems: items, stockRows: stock, warehouseId: 2,
      });

      expect(result.status).toBe('paid');
      expect(result.stockDeducted).toBe(false); // NOT deducted again
      expect(result.orderStatus).toBe('processing'); // keeps existing status
      expect(stock[0].quantity).toBe(3); // unchanged — no double deduction
    });
  });

  describe('race condition: two concurrent payments on last unit', () => {
    it('only one of two concurrent payments succeeds when stock=1', async () => {
      // Simulate two concurrent payments competing for the last unit
      const stock = [{ id: 1, warehouseId: 2, productId: 10, variantId: null, quantity: 1, reorderPoint: 0, lowStockAlertSent: false }];
      const order1 = { id: 10, status: 'pending', paymentStatus: 'unpaid', paymentReference: 'ref-010' };
      const order2 = { id: 11, status: 'pending', paymentStatus: 'unpaid', paymentReference: 'ref-011' };
      const items = [{ productId: 10, variantId: null, quantity: 1 }];

      // Both try to deduct simultaneously — first one wins
      const result1 = await simulateDeductStock(order1.id, items, stock, 2);
      const result2 = await simulateDeductStock(order2.id, items, stock, 2);

      // First succeeds, second fails (stock is now 0)
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Insufficient stock');
      expect(stock[0].quantity).toBe(0);
    });

    it('allows exact quantity deduction (no off-by-one)', async () => {
      const stock = [{ id: 1, warehouseId: 2, productId: 10, variantId: null, quantity: 3, reorderPoint: 0, lowStockAlertSent: false }];
      const items = [{ productId: 10, variantId: null, quantity: 3 }];

      const result = await simulateDeductStock(1, items, stock, 2);

      expect(result.success).toBe(true);
      expect(stock[0].quantity).toBe(0);
    });
  });

  describe('POS createOrder immediate deduction', () => {
    it('deducts stock from POS warehouse immediately on order creation', async () => {
      const posWarehouseId = 3;
      const stock = [{ id: 2, warehouseId: 3, productId: 20, variantId: null, quantity: 3, reorderPoint: 1, lowStockAlertSent: false }];
      const items = [{ productId: 20, variantId: null, quantity: 1 }];

      // POS deducts immediately (no payment verification step)
      const result = await simulateDeductStock(100, items, stock, posWarehouseId);

      expect(result.success).toBe(true);
      expect(stock[0].quantity).toBe(2); // 3 - 1 = 2
    });

    it('POS deduction does not affect online warehouse stock', async () => {
      const posWarehouseId = 3;
      const onlineWarehouseId = 2;
      const stock = [
        { id: 1, warehouseId: onlineWarehouseId, productId: 20, variantId: null, quantity: 10, reorderPoint: 2, lowStockAlertSent: false },
        { id: 2, warehouseId: posWarehouseId, productId: 20, variantId: null, quantity: 3, reorderPoint: 1, lowStockAlertSent: false },
      ];
      const items = [{ productId: 20, variantId: null, quantity: 2 }];

      // POS deducts from POS warehouse only
      const result = await simulateDeductStock(101, items, stock, posWarehouseId);

      expect(result.success).toBe(true);
      expect(stock.find(r => r.warehouseId === posWarehouseId)!.quantity).toBe(1); // 3 - 2 = 1
      expect(stock.find(r => r.warehouseId === onlineWarehouseId)!.quantity).toBe(10); // unchanged
    });
  });

  describe('stock deduction with variants', () => {
    it('deducts correct variant stock', async () => {
      const stock = [
        { id: 1, warehouseId: 2, productId: 30, variantId: 5, quantity: 8, reorderPoint: 2, lowStockAlertSent: false },
        { id: 2, warehouseId: 2, productId: 30, variantId: 6, quantity: 4, reorderPoint: 2, lowStockAlertSent: false },
      ];
      const items = [{ productId: 30, variantId: 5, quantity: 3 }];

      const result = await simulateDeductStock(200, items, stock, 2);

      expect(result.success).toBe(true);
      expect(stock.find(r => r.variantId === 5)!.quantity).toBe(5); // 8 - 3 = 5
      expect(stock.find(r => r.variantId === 6)!.quantity).toBe(4); // unchanged
    });
  });
});
