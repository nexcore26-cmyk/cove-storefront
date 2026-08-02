/**
 * Return Requests Router
 *
 * submit        — protectedProcedure: any logged-in user can submit
 * list          — ordersProcedure: orders staff or admin can list all
 * approve       — adminProcedure: admin only
 * executeRefund — adminProcedure: admin only (P66)
 * reject        — adminProcedure: admin only
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { protectedProcedure } from "../_core/trpc";
import { adminProcedure, ordersProcedure } from "./procedures";

export const returnRequestsRouter = router({
  /** Submit a return request — any logged-in user (customer or POS staff) */
  submit: protectedProcedure
    .input(z.object({
      orderId: z.number().int().positive(),
      orderItemId: z.number().int().positive().optional(),
      reason: z.string().min(3).max(512),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const { returnRequests, orders } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify the order exists
      const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      // Only allow returns on completed/delivered orders
      if (!["completed", "delivered", "shipped"].includes(order.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Returns can only be submitted for completed or delivered orders",
        });
      }

      const [inserted] = await db.insert(returnRequests).values({
        orderId: input.orderId,
        orderItemId: input.orderItemId ?? null,
        requestedByUserId: ctx.user.id,
        reason: input.reason,
        status: "pending",
      });

      return { success: true, id: (inserted as any).insertId };
    }),

  /** List return requests — orders staff or admin */
  list: ordersProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "rejected", "executed", "all"]).optional(),
      orderId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { returnRequests, orders } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const conditions = [];
      if (input?.status && input.status !== "all") {
        conditions.push(eq(returnRequests.status, input.status as "pending" | "approved" | "rejected" | "executed"));
      }
      if (input?.orderId) {
        conditions.push(eq(returnRequests.orderId, input.orderId));
      }

      const rows = await db
        .select({
          id: returnRequests.id,
          orderId: returnRequests.orderId,
          orderItemId: returnRequests.orderItemId,
          requestedByUserId: returnRequests.requestedByUserId,
          reason: returnRequests.reason,
          status: returnRequests.status,
          resolvedByUserId: returnRequests.resolvedByUserId,
          resolvedAt: returnRequests.resolvedAt,
          notes: returnRequests.notes,
          refundAmount: returnRequests.refundAmount,
          createdAt: returnRequests.createdAt,
          orderNumber: orders.orderNumber,
          customerName: orders.customerName,
          customerEmail: orders.customerEmail,
        })
        .from(returnRequests)
        .leftJoin(orders, eq(returnRequests.orderId, orders.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(returnRequests.createdAt))
        .limit(limit)
        .offset(offset);

      return rows;
    }),

  /** Approve a return request — admin only */
  approve: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      notes: z.string().max(1024).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const { returnRequests } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [rr] = await db.select().from(returnRequests).where(eq(returnRequests.id, input.id)).limit(1);
      if (!rr) throw new TRPCError({ code: "NOT_FOUND", message: "Return request not found" });
      if (rr.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Return request is already resolved" });
      }

      await db.update(returnRequests).set({
        status: "approved",
        resolvedByUserId: ctx.user.id,
        resolvedAt: new Date(),
        notes: input.notes ?? null,
      }).where(eq(returnRequests.id, input.id));

      return { success: true };
    }),

  /** Execute refund for an approved return request — admin only (P66) */
  executeRefund: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      refundAmount: z.number().positive(),
      reason: z.string().max(512).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const { returnRequests, orders } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch the return request
      const [rr] = await db.select().from(returnRequests).where(eq(returnRequests.id, input.id)).limit(1);
      if (!rr) throw new TRPCError({ code: "NOT_FOUND", message: "Return request not found" });
      if (rr.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot execute refund: return request status is '${rr.status}', expected 'approved'`,
        });
      }

      // Fetch the order to get the MyFatoorah invoice ID
      const [order] = await db.select().from(orders).where(eq(orders.id, rr.orderId)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Associated order not found" });

      // Call MyFatoorah refund API
      const myfatoorahApiKey = process.env.MYFATOORAH_API_KEY;
      const isTest = process.env.MYFATOORAH_IS_TEST === "true";
      const baseUrl = isTest
        ? "https://apitest.myfatoorah.com"
        : "https://api.myfatoorah.com";

      if (!myfatoorahApiKey) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "MyFatoorah API key not configured" });
      }

      const invoiceId = (order as any).paymentInvoiceId ?? (order as any).invoiceId;
      if (!invoiceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order has no payment invoice ID for refund" });
      }

      const refundResp = await fetch(`${baseUrl}/v2/MakeRefund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${myfatoorahApiKey}`,
        },
        body: JSON.stringify({
          KeyType: "InvoiceId",
          Key: String(invoiceId),
          RefundChargeOnCustomer: false,
          ServiceChargeonCustomer: false,
          Amount: input.refundAmount,
          Comment: input.reason ?? `Return request #${rr.id} refund`,
        }),
      });

      if (!refundResp.ok) {
        const errBody = await refundResp.text().catch(() => "unknown");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `MyFatoorah refund failed: ${errBody}`,
        });
      }

      // Mark the return request as executed
      await db.update(returnRequests).set({
        status: "executed",
        resolvedByUserId: ctx.user.id,
        resolvedAt: new Date(),
        refundAmount: String(input.refundAmount) as any,
        notes: rr.notes ?? input.reason ?? null,
      }).where(eq(returnRequests.id, input.id));

      return { success: true, refundAmount: input.refundAmount };
    }),

  /** Reject a return request — admin only */
  reject: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      notes: z.string().max(1024).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const { returnRequests } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [rr] = await db.select().from(returnRequests).where(eq(returnRequests.id, input.id)).limit(1);
      if (!rr) throw new TRPCError({ code: "NOT_FOUND", message: "Return request not found" });
      if (rr.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Return request is already resolved" });
      }

      await db.update(returnRequests).set({
        status: "rejected",
        resolvedByUserId: ctx.user.id,
        resolvedAt: new Date(),
        notes: input.notes ?? null,
      }).where(eq(returnRequests.id, input.id));

      return { success: true };
    }),
});
