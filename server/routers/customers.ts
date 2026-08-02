/**
 * P12 — Customer Management Router
 * Provides admin procedures for:
 * - customers.list: paginated list with search by name/email/phone, filter by country, sort
 * - customers.byId: customer detail with full order history
 * - customers.updateNotes: editable notes field per customer
 * - customers.recalcTotals: recalculate totalOrders/totalSpent from orders table
 * - customers.exportCsv: export all customers as a CSV string (P68)
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router } from '../_core/trpc';
import { adminProcedure } from './procedures';
import { getDb } from '../db';
import { customers, orders } from '../../drizzle/schema';
import { eq, like, or, desc, asc, and, sql, count, sum } from 'drizzle-orm';

export const customersRouter = router({
  /** Paginated list with search + filter + sort */
  list: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      country: z.string().optional(),
      sortBy: z.enum(['totalSpent', 'totalOrders', 'createdAt', 'name']).default('createdAt'),
      sortDir: z.enum(['asc', 'desc']).default('desc'),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const conditions: any[] = [];

      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conditions.push(or(
          like(customers.firstName, q),
          like(customers.lastName, q),
          like(customers.email, q),
          like(customers.phone, q),
        ));
      }

      if (input.country?.trim()) {
        conditions.push(eq(customers.country, input.country.trim().toUpperCase()));
      }

      const orderByCol = {
        totalSpent: customers.totalSpent,
        totalOrders: customers.totalOrders,
        createdAt: customers.createdAt,
        name: customers.firstName,
      }[input.sortBy];

      const orderByFn = input.sortDir === 'asc' ? asc : desc;

      const [rows, [{ total }]] = await Promise.all([
        db.select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
          phone: customers.phone,
          country: customers.country,
          area: customers.area,
          totalOrders: customers.totalOrders,
          totalSpent: customers.totalSpent,
          createdAt: customers.createdAt,
          notes: customers.notes,
        })
          .from(customers)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(orderByFn(orderByCol))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ total: count() })
          .from(customers)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      return { rows, total };
    }),

  /** Customer detail with order history */
  byId: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const [customer] = await db.select().from(customers).where(eq(customers.id, input.id)).limit(1);
      if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });

      const orderHistory = await db.select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        total: orders.total,
        currency: orders.currency,
        channel: orders.channel,
        createdAt: orders.createdAt,
        paymentStatus: orders.paymentStatus,
      })
        .from(orders)
        .where(eq(orders.customerId, input.id))
        .orderBy(desc(orders.createdAt))
        .limit(50);

      return { customer, orders: orderHistory };
    }),

  /** Update customer notes */
  updateNotes: adminProcedure
    .input(z.object({
      id: z.number(),
      notes: z.string().max(4000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.update(customers).set({ notes: input.notes }).where(eq(customers.id, input.id));
      return { success: true };
    }),

  /** Recalculate totalOrders and totalSpent from the orders table for a specific customer */
  recalcTotals: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const [result] = await db.select({
        totalOrders: count(orders.id),
        totalSpent: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
      })
        .from(orders)
        .where(and(
          eq(orders.customerId, input.id),
          // Only count paid/completed orders
          or(
            eq(orders.paymentStatus, 'paid'),
            eq(orders.status, 'completed'),
            eq(orders.status, 'processing'),
            eq(orders.status, 'delivered'),
          )
        ));

      await db.update(customers).set({
        totalOrders: result.totalOrders,
        totalSpent: result.totalSpent,
      }).where(eq(customers.id, input.id));

      return { totalOrders: result.totalOrders, totalSpent: result.totalSpent };
    }),

  /** P68: Export all customers as a CSV string — admin only */
  exportCsv: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const rows = await db.select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phone: customers.phone,
        country: customers.country,
        area: customers.area,
        totalOrders: customers.totalOrders,
        totalSpent: customers.totalSpent,
        createdAt: customers.createdAt,
        notes: customers.notes,
      })
        .from(customers)
        .orderBy(desc(customers.createdAt));

      // Build CSV
      const escapeCsv = (val: any): string => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape double quotes and wrap in quotes if needed
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

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
    }),
});
