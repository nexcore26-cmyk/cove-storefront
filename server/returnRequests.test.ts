/**
 * Tests for the Return Requests router
 * Tests: submit (status guard), approve, reject
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
};

vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock('../drizzle/schema', () => ({
  returnRequests: { id: 'id', orderId: 'orderId', status: 'status' },
  orders: { id: 'id', status: 'status' },
  users: { id: 'id' },
  orderItems: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  desc: vi.fn(a => ({ type: 'desc', a })),
  inArray: vi.fn((a, b) => ({ type: 'inArray', a, b })),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Return Requests Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReturnValue(mockSelectChain);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 42 }]),
    });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    });
  });

  it('should reject submit for non-completed orders', async () => {
    // Order with status 'processing' — not eligible for return
    mockSelectChain.limit.mockResolvedValueOnce([{
      id: 1,
      orderNumber: 'ORD-001',
      status: 'processing',
      channel: 'pos',
    }]);

    const { TRPCError } = await import('@trpc/server');
    const { returnRequestsRouter } = await import('./routers/returnRequests');

    const caller = returnRequestsRouter.createCaller({
      user: { id: 1, role: 'user', openId: 'u1', name: 'Test', email: 'test@test.com', loginMethod: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as any,
      res: {} as any,
    });

    await expect(caller.submit({ orderId: 1, reason: 'Damaged item' }))
      .rejects.toThrow('Returns can only be submitted for completed or delivered orders');
  });

  it('should allow submit for completed orders', async () => {
    mockSelectChain.limit.mockResolvedValueOnce([{
      id: 1,
      orderNumber: 'ORD-001',
      status: 'completed',
      channel: 'pos',
    }]);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 42 }]),
    });

    const { returnRequestsRouter } = await import('./routers/returnRequests');
    const caller = returnRequestsRouter.createCaller({
      user: { id: 1, role: 'user', openId: 'u1', name: 'Test', email: 'test@test.com', loginMethod: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.submit({ orderId: 1, reason: 'Damaged item' });
    expect(result.success).toBe(true);
    expect(result.id).toBe(42);
  });

  it('should reject approve for already-resolved requests', async () => {
    mockSelectChain.limit.mockResolvedValueOnce([{
      id: 5,
      status: 'approved', // already resolved
    }]);

    const { returnRequestsRouter } = await import('./routers/returnRequests');
    const caller = returnRequestsRouter.createCaller({
      user: { id: 99, role: 'admin', openId: 'admin1', name: 'Admin', email: 'admin@test.com', loginMethod: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as any,
      res: {} as any,
    });

    await expect(caller.approve({ id: 5 }))
      .rejects.toThrow('Return request is already resolved');
  });

  it('should approve a pending return request', async () => {
    mockSelectChain.limit.mockResolvedValueOnce([{
      id: 5,
      status: 'pending',
    }]);
    const mockSet = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([]);
    mockDb.update.mockReturnValue({ set: mockSet, where: mockWhere });
    mockSet.mockReturnValue({ where: mockWhere });

    const { returnRequestsRouter } = await import('./routers/returnRequests');
    const caller = returnRequestsRouter.createCaller({
      user: { id: 99, role: 'admin', openId: 'admin1', name: 'Admin', email: 'admin@test.com', loginMethod: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.approve({ id: 5, notes: 'Approved by admin' });
    expect(result.success).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
  });

  it('should reject a pending return request', async () => {
    mockSelectChain.limit.mockResolvedValueOnce([{
      id: 7,
      status: 'pending',
    }]);
    const mockSet = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([]);
    mockDb.update.mockReturnValue({ set: mockSet, where: mockWhere });
    mockSet.mockReturnValue({ where: mockWhere });

    const { returnRequestsRouter } = await import('./routers/returnRequests');
    const caller = returnRequestsRouter.createCaller({
      user: { id: 99, role: 'admin', openId: 'admin1', name: 'Admin', email: 'admin@test.com', loginMethod: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.reject({ id: 7, notes: 'Not eligible' });
    expect(result.success).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected' }));
  });
});
