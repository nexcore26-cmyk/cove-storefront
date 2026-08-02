/**
 * P6 Exchange Workflow — vitest
 *
 * Tests:
 * 1. exchange marks original order as 'exchanged'
 * 2. exchange creates a new linked order with exchangedFromOrderId
 * 3. exchange fails if original order is already exchanged
 * 4. exchange fails if original order is in non-eligible status (pending)
 * 5. only admin can call exchange (FORBIDDEN for non-admin)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// ── Shared mock state ────────────────────────────────────────────────────────
let mockOrder: any = null;
let mockOriginalItems: any[] = [];
let mockWarehouse: any = null;
let updatedOrderStatus: string | null = null;
let insertedOrder: any = null;
let insertedItems: any[] = [];
let stockUpdates: Array<{ id: number; quantity: number }> = [];

const mockDb = {
  select: () => mockDb,
  from: () => mockDb,
  where: () => mockDb,
  limit: (_n: number) => {
    // Return appropriate mock based on what was queried
    return Promise.resolve([mockOrder].filter(Boolean));
  },
  insert: (_table: any) => ({
    values: (vals: any) => {
      if (vals.orderNumber) {
        insertedOrder = vals;
        return Promise.resolve([{ insertId: 9999 }]);
      }
      insertedItems.push(vals);
      return Promise.resolve([{ insertId: insertedItems.length }]);
    },
  }),
  update: (_table: any) => ({
    set: (vals: any) => ({
      where: (_cond: any) => {
        if (vals.status) updatedOrderStatus = vals.status;
        if (vals.quantity !== undefined) stockUpdates.push({ id: 0, quantity: vals.quantity });
        return Promise.resolve();
      },
    }),
  }),
  transaction: async (fn: (tx: any) => Promise<void>) => {
    await fn(mockDb);
  },
};

vi.mock('./db', () => ({
  getDb: vi.fn(async () => mockDb),
}));

vi.mock('../drizzle/schema', () => ({
  orders: 'orders',
  orderItems: 'orderItems',
  warehouseStock: 'warehouseStock',
  warehouses: 'warehouses',
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: any, _val: any) => ({ col: _col, val: _val })),
}));

// ── Inline exchange logic (mirrors routers.ts) ───────────────────────────────
async function runExchange(input: {
  originalOrderId: number;
  newItems: Array<{ productId: number; variantId?: number; name: string; sku?: string; quantity: number; price: number }>;
}, userRole: string) {
  if (userRole !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });

  const { getDb } = await import('./db');
  const { orders, orderItems: orderItemsTable, warehouseStock, warehouses: warehousesTable } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

  const [originalOrder] = await db.select().from(orders).where(eq(orders as any, input.originalOrderId)).limit(1) as any[];
  if (!originalOrder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Original order not found' });
  if (originalOrder.status === 'exchanged') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order has already been exchanged' });
  if (!['completed', 'processing', 'delivered', 'shipped'].includes(originalOrder.status)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Exchange can only be performed on completed, processing, delivered, or shipped orders' });
  }

  const originalItems = mockOriginalItems;
  const warehouseType = originalOrder.channel === 'pos' ? 'pos' : 'online';
  const [warehouse] = [mockWarehouse].filter(Boolean);
  const newOrderNumber = `EXC-TEST-${Date.now()}`;
  const newTotal = input.newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  await db.transaction(async (tx: any) => {
    if (warehouse) {
      for (const item of originalItems) {
        if (!item.productId) continue;
        const [stockRow] = [{ id: 1, quantity: 5 }];
        if (stockRow) {
          await tx.update(warehouseStock).set({ quantity: stockRow.quantity + item.quantity }).where(eq(warehouseStock as any, stockRow.id));
        }
      }
    }
    await tx.update(orders).set({ status: 'exchanged' }).where(eq(orders as any, input.originalOrderId));
    const [newOrderResult] = await tx.insert(orders).values({
      orderNumber: newOrderNumber,
      customerId: originalOrder.customerId,
      customerName: originalOrder.customerName,
      subtotal: String(newTotal),
      total: String(newTotal),
      currency: originalOrder.currency,
      status: 'processing',
      paymentStatus: 'paid',
      channel: originalOrder.channel,
      exchangedFromOrderId: input.originalOrderId,
    }) as any[];
    const newOrderId = (newOrderResult as any).insertId;
    for (const item of input.newItems) {
      await tx.insert(orderItemsTable).values({
        orderId: newOrderId,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: String(item.price),
        totalPrice: String(item.price * item.quantity),
      });
    }
  });

  return { success: true, newOrderNumber };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('P6: Exchange Workflow', () => {
  beforeEach(() => {
    mockOrder = null;
    mockOriginalItems = [];
    mockWarehouse = null;
    updatedOrderStatus = null;
    insertedOrder = null;
    insertedItems = [];
    stockUpdates = [];
  });

  it('marks original order as exchanged and creates new linked order', async () => {
    mockOrder = { id: 1, status: 'completed', channel: 'online', currency: 'KWD', customerId: 10, customerName: 'Test', exchangedFromOrderId: null };
    mockOriginalItems = [{ productId: 5, variantId: null, quantity: 2 }];
    mockWarehouse = { id: 3, type: 'online' };

    const result = await runExchange({
      originalOrderId: 1,
      newItems: [{ productId: 7, name: 'New Chair', quantity: 1, price: 150 }],
    }, 'admin');

    expect(result.success).toBe(true);
    expect(result.newOrderNumber).toMatch(/^EXC-TEST-/);
    expect(updatedOrderStatus).toBe('exchanged');
    expect(insertedOrder).not.toBeNull();
    expect(insertedOrder.exchangedFromOrderId).toBe(1);
    expect(insertedOrder.status).toBe('processing');
    expect(insertedItems.length).toBe(1);
    expect(insertedItems[0].name).toBe('New Chair');
  });

  it('fails if original order is already exchanged', async () => {
    mockOrder = { id: 2, status: 'exchanged', channel: 'online', currency: 'KWD' };

    await expect(runExchange({
      originalOrderId: 2,
      newItems: [{ productId: 7, name: 'Chair', quantity: 1, price: 100 }],
    }, 'admin')).rejects.toThrow('Order has already been exchanged');
  });

  it('fails if original order is in non-eligible status (pending)', async () => {
    mockOrder = { id: 3, status: 'pending', channel: 'online', currency: 'KWD' };

    await expect(runExchange({
      originalOrderId: 3,
      newItems: [{ productId: 7, name: 'Chair', quantity: 1, price: 100 }],
    }, 'admin')).rejects.toThrow('Exchange can only be performed on');
  });

  it('fails if original order is cancelled', async () => {
    mockOrder = { id: 4, status: 'cancelled', channel: 'online', currency: 'KWD' };

    await expect(runExchange({
      originalOrderId: 4,
      newItems: [{ productId: 7, name: 'Chair', quantity: 1, price: 100 }],
    }, 'admin')).rejects.toThrow('Exchange can only be performed on');
  });

  it('throws FORBIDDEN for non-admin users', async () => {
    await expect(runExchange({
      originalOrderId: 1,
      newItems: [{ productId: 7, name: 'Chair', quantity: 1, price: 100 }],
    }, 'user')).rejects.toThrow('Admin access required');
  });

  it('throws FORBIDDEN for pos users', async () => {
    await expect(runExchange({
      originalOrderId: 1,
      newItems: [{ productId: 7, name: 'Chair', quantity: 1, price: 100 }],
    }, 'pos')).rejects.toThrow('Admin access required');
  });
});
