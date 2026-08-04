import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { orders, orderItems, products, productVendors, tenantModules, vendors } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { TRPCError } from "@trpc/server";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const tokenInput = z.object({ token: z.string().min(32) });

function getTokenSecret(): string {
  return process.env.SESSION_SECRET || process.env.COOKIE_SECRET || process.env.JWT_SECRET || "cove-vendor-portal-dev-secret";
}

function signPayload(payload: string): string {
  return createHmac("sha256", getTokenSecret()).update(payload).digest("base64url");
}

function issueVendorToken(vendor: { id: number; tenantId: number; status: string; isActive: boolean }): string {
  const payload = JSON.stringify({
    vendorId: vendor.id,
    tenantId: vendor.tenantId,
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + TOKEN_TTL_MS,
  });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${signPayload(encoded)}`;
}

function parseVendorToken(token: string): { vendorId: number; tenantId: number } {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Vendor session is invalid" });
  }

  const expected = signPayload(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Vendor session is invalid" });
  }

  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Vendor session is invalid" });
  }

  if (!payload.exp || Date.now() > payload.exp) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Vendor session has expired" });
  }
  if (!Number.isInteger(payload.vendorId) || !Number.isInteger(payload.tenantId)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Vendor session is invalid" });
  }
  return { vendorId: payload.vendorId, tenantId: payload.tenantId };
}

async function requireVendorsModuleForTenant(tenantId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const rows = await db
    .select({ isEnabled: tenantModules.isEnabled })
    .from(tenantModules)
    .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.moduleKey, "vendors")))
    .limit(1);
  if (!rows[0]?.isEnabled) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Vendor module is disabled" });
  }
}

async function authenticateVendor(token: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const session = parseVendorToken(token);
  await requireVendorsModuleForTenant(session.tenantId);
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, session.vendorId), eq(vendors.tenantId, session.tenantId)))
    .limit(1);
  if (!vendor || !vendor.isActive || vendor.status !== "active") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Vendor session is no longer active" });
  }
  return vendor;
}

export const vendorPortalRouter = router({
  login: publicProcedure
    .input(z.object({ username: z.string().trim().min(1), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.portalUsername, input.username))
        .limit(1);

      if (!vendor || !vendor.portalPasswordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }
      await requireVendorsModuleForTenant(vendor.tenantId);
      if (!vendor.isActive || vendor.status !== "active") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Vendor portal access is inactive" });
      }

      const passwordMatch = await bcrypt.compare(input.password, vendor.portalPasswordHash);
      if (!passwordMatch) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }

      await db.update(vendors).set({ lastLoginAt: new Date() }).where(eq(vendors.id, vendor.id));

      return {
        token: issueVendorToken(vendor),
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorEmail: vendor.email,
      };
    }),

  me: publicProcedure.input(tokenInput).query(async ({ input }) => {
    const vendor = await authenticateVendor(input.token);
    return {
      id: vendor.id,
      name: vendor.name,
      contactName: vendor.contactName,
      email: vendor.email,
      phone: vendor.phone,
      commissionPercent: vendor.commissionPercent,
      status: vendor.status,
      lastLoginAt: vendor.lastLoginAt,
    };
  }),

  getProducts: publicProcedure.input(tokenInput).query(async ({ input }) => {
    const vendor = await authenticateVendor(input.token);
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        productId: products.id,
        name: products.name,
        sku: products.sku,
        status: products.status,
        price: products.price,
        ownershipType: productVendors.ownershipType,
        commissionPercent: productVendors.commissionPercent,
      })
      .from(productVendors)
      .innerJoin(products, eq(products.id, productVendors.productId))
      .where(and(eq(productVendors.vendorId, vendor.id), eq(products.tenantId, vendor.tenantId)));
  }),

  getOrders: publicProcedure
    .input(tokenInput.extend({ page: z.number().default(1), limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const vendor = await authenticateVendor(input.token);
      const db = await getDb();
      if (!db) return [];
      const offset = (input.page - 1) * input.limit;
      return db
        .select({
          orderId: orders.id,
          orderNumber: orders.orderNumber,
          orderDate: orders.createdAt,
          total: orders.total,
          status: orders.status,
          itemName: orderItems.name,
          quantity: orderItems.quantity,
          lineTotal: orderItems.totalPrice,
          commissionPercent: productVendors.commissionPercent,
        })
        .from(orders)
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(productVendors, eq(orderItems.productId, productVendors.productId))
        .where(and(eq(productVendors.vendorId, vendor.id), eq(orders.tenantId, vendor.tenantId)))
        .limit(input.limit)
        .offset(offset);
    }),

  getCommissionSummary: publicProcedure.input(tokenInput).query(async ({ input }) => {
    const vendor = await authenticateVendor(input.token);
    const db = await getDb();
    if (!db) return { totalEarned: 0, totalPending: 0, totalPaid: 0 };
    const rows = await db
      .select({
        status: orders.status,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        lineTotal: orderItems.totalPrice,
        commissionPercent: productVendors.commissionPercent,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
      .innerJoin(productVendors, eq(orderItems.productId, productVendors.productId))
      .where(and(eq(productVendors.vendorId, vendor.id), eq(orders.tenantId, vendor.tenantId)));

    let totalEarned = 0;
    let totalPending = 0;
    let totalPaid = 0;
    for (const row of rows) {
      const lineTotal = Number(row.lineTotal ?? 0);
      const commissionPercent = Number(row.commissionPercent ?? vendor.commissionPercent ?? 0);
      const commissionAmount = (lineTotal * commissionPercent) / 100;
      totalEarned += commissionAmount;
      if (["completed", "delivered", "shipped"].includes(String(row.status))) totalPending += commissionAmount;
      else totalPaid += 0;
    }
    return { totalEarned, totalPending, totalPaid };
  }),

  getOrderDetail: publicProcedure
    .input(tokenInput.extend({ orderId: z.number() }))
    .query(async ({ input }) => {
      const vendor = await authenticateVendor(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db
        .select({
          orderId: orders.id,
          orderNumber: orders.orderNumber,
          orderDate: orders.createdAt,
          orderStatus: orders.status,
          itemId: orderItems.id,
          itemName: orderItems.name,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          totalPrice: orderItems.totalPrice,
          commissionPercent: productVendors.commissionPercent,
        })
        .from(orders)
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(productVendors, eq(orderItems.productId, productVendors.productId))
        .where(and(eq(orders.id, input.orderId), eq(productVendors.vendorId, vendor.id), eq(orders.tenantId, vendor.tenantId)));
      if (rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found for this vendor" });
      }
      return { order: rows[0], items: rows };
    }),
});
