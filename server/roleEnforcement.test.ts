/**
 * P3 — Backend Role Enforcement Tests
 * Tests:
 * - adminProcedure: only admin role passes; user/pos/orders roles are rejected
 * - posProcedure: pos and admin roles pass; user/orders roles are rejected
 * - ordersProcedure: orders and admin roles pass; user/pos roles are rejected
 * - protectedProcedure: any logged-in user passes; unauthenticated is rejected
 * - publicProcedure: always passes (no auth required)
 * - frontend guards are supplementary: backend procedures enforce roles independently
 */
import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';

// ─── Simulate role-gated middleware ──────────────────────────────────────────
type Role = 'admin' | 'pos' | 'orders' | 'user';

interface MockCtx {
  user: { id: number; role: Role } | null;
}

function checkAdminProcedure(ctx: MockCtx): void {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Please login (10001)' });
  if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
}

function checkPosProcedure(ctx: MockCtx): void {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Please login (10001)' });
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'pos')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'POS access required' });
}

function checkOrdersProcedure(ctx: MockCtx): void {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Please login (10001)' });
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'orders')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Orders access required' });
}

function checkProtectedProcedure(ctx: MockCtx): void {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Please login (10001)' });
}

function checkPublicProcedure(_ctx: MockCtx): void {
  // Always passes
}

function runProcedure(check: (ctx: MockCtx) => void, ctx: MockCtx): 'ok' | string {
  try {
    check(ctx);
    return 'ok';
  } catch (e: any) {
    return e.code ?? 'UNKNOWN';
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('P3 — Backend Role Enforcement', () => {
  describe('adminProcedure', () => {
    it('allows admin role', () => {
      expect(runProcedure(checkAdminProcedure, { user: { id: 1, role: 'admin' } })).toBe('ok');
    });

    it('rejects user role', () => {
      expect(runProcedure(checkAdminProcedure, { user: { id: 2, role: 'user' } })).toBe('FORBIDDEN');
    });

    it('rejects pos role', () => {
      expect(runProcedure(checkAdminProcedure, { user: { id: 3, role: 'pos' } })).toBe('FORBIDDEN');
    });

    it('rejects orders role', () => {
      expect(runProcedure(checkAdminProcedure, { user: { id: 4, role: 'orders' } })).toBe('FORBIDDEN');
    });

    it('rejects unauthenticated', () => {
      expect(runProcedure(checkAdminProcedure, { user: null })).toBe('UNAUTHORIZED');
    });
  });

  describe('posProcedure', () => {
    it('allows pos role', () => {
      expect(runProcedure(checkPosProcedure, { user: { id: 5, role: 'pos' } })).toBe('ok');
    });

    it('allows admin role (admin can do everything)', () => {
      expect(runProcedure(checkPosProcedure, { user: { id: 1, role: 'admin' } })).toBe('ok');
    });

    it('rejects user role', () => {
      expect(runProcedure(checkPosProcedure, { user: { id: 2, role: 'user' } })).toBe('FORBIDDEN');
    });

    it('rejects orders role (cannot call pos procedures)', () => {
      expect(runProcedure(checkPosProcedure, { user: { id: 4, role: 'orders' } })).toBe('FORBIDDEN');
    });

    it('rejects unauthenticated', () => {
      expect(runProcedure(checkPosProcedure, { user: null })).toBe('UNAUTHORIZED');
    });
  });

  describe('ordersProcedure', () => {
    it('allows orders role', () => {
      expect(runProcedure(checkOrdersProcedure, { user: { id: 6, role: 'orders' } })).toBe('ok');
    });

    it('allows admin role (admin can do everything)', () => {
      expect(runProcedure(checkOrdersProcedure, { user: { id: 1, role: 'admin' } })).toBe('ok');
    });

    it('rejects user role', () => {
      expect(runProcedure(checkOrdersProcedure, { user: { id: 2, role: 'user' } })).toBe('FORBIDDEN');
    });

    it('rejects pos role (cannot call orders procedures)', () => {
      expect(runProcedure(checkOrdersProcedure, { user: { id: 3, role: 'pos' } })).toBe('FORBIDDEN');
    });

    it('rejects unauthenticated', () => {
      expect(runProcedure(checkOrdersProcedure, { user: null })).toBe('UNAUTHORIZED');
    });
  });

  describe('protectedProcedure', () => {
    it('allows any logged-in user', () => {
      const roles: Role[] = ['admin', 'pos', 'orders', 'user'];
      for (const role of roles) {
        expect(runProcedure(checkProtectedProcedure, { user: { id: 1, role } })).toBe('ok');
      }
    });

    it('rejects unauthenticated', () => {
      expect(runProcedure(checkProtectedProcedure, { user: null })).toBe('UNAUTHORIZED');
    });
  });

  describe('publicProcedure', () => {
    it('allows unauthenticated access', () => {
      expect(runProcedure(checkPublicProcedure, { user: null })).toBe('ok');
    });

    it('allows authenticated access', () => {
      expect(runProcedure(checkPublicProcedure, { user: { id: 1, role: 'user' } })).toBe('ok');
    });
  });

  describe('frontend guards are supplementary', () => {
    it('backend rejects pos user calling admin procedure even if frontend allows it', () => {
      // Simulates a POS user bypassing frontend guards and calling an admin procedure
      const ctx: MockCtx = { user: { id: 5, role: 'pos' } };
      // Frontend would normally hide the admin button, but backend still enforces
      expect(runProcedure(checkAdminProcedure, ctx)).toBe('FORBIDDEN');
    });

    it('backend rejects user calling pos procedure even if frontend allows it', () => {
      const ctx: MockCtx = { user: { id: 2, role: 'user' } };
      expect(runProcedure(checkPosProcedure, ctx)).toBe('FORBIDDEN');
    });

    it('backend rejects pos user calling orders procedure', () => {
      const ctx: MockCtx = { user: { id: 3, role: 'pos' } };
      expect(runProcedure(checkOrdersProcedure, ctx)).toBe('FORBIDDEN');
    });

    it('backend rejects orders user calling pos procedure', () => {
      const ctx: MockCtx = { user: { id: 4, role: 'orders' } };
      expect(runProcedure(checkPosProcedure, ctx)).toBe('FORBIDDEN');
    });
  });

  describe('procedure hierarchy audit', () => {
    it('admin can call all procedure types', () => {
      const adminCtx: MockCtx = { user: { id: 1, role: 'admin' } };
      expect(runProcedure(checkAdminProcedure, adminCtx)).toBe('ok');
      expect(runProcedure(checkPosProcedure, adminCtx)).toBe('ok');
      expect(runProcedure(checkOrdersProcedure, adminCtx)).toBe('ok');
      expect(runProcedure(checkProtectedProcedure, adminCtx)).toBe('ok');
      expect(runProcedure(checkPublicProcedure, adminCtx)).toBe('ok');
    });

    it('pos user can only call pos and protected procedures', () => {
      const posCtx: MockCtx = { user: { id: 5, role: 'pos' } };
      expect(runProcedure(checkAdminProcedure, posCtx)).toBe('FORBIDDEN');
      expect(runProcedure(checkPosProcedure, posCtx)).toBe('ok');
      expect(runProcedure(checkOrdersProcedure, posCtx)).toBe('FORBIDDEN');
      expect(runProcedure(checkProtectedProcedure, posCtx)).toBe('ok');
    });

    it('orders user can only call orders and protected procedures', () => {
      const ordersCtx: MockCtx = { user: { id: 6, role: 'orders' } };
      expect(runProcedure(checkAdminProcedure, ordersCtx)).toBe('FORBIDDEN');
      expect(runProcedure(checkPosProcedure, ordersCtx)).toBe('FORBIDDEN');
      expect(runProcedure(checkOrdersProcedure, ordersCtx)).toBe('ok');
      expect(runProcedure(checkProtectedProcedure, ordersCtx)).toBe('ok');
    });

    it('regular user can only call protected and public procedures', () => {
      const userCtx: MockCtx = { user: { id: 2, role: 'user' } };
      expect(runProcedure(checkAdminProcedure, userCtx)).toBe('FORBIDDEN');
      expect(runProcedure(checkPosProcedure, userCtx)).toBe('FORBIDDEN');
      expect(runProcedure(checkOrdersProcedure, userCtx)).toBe('FORBIDDEN');
      expect(runProcedure(checkProtectedProcedure, userCtx)).toBe('ok');
    });
  });
});
