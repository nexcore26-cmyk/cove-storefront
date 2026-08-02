/**
 * POS Router — procedures for the Point of Sale interface
 *
 * Procedures:
 *  pos.categories      — list POS categories
 *  pos.products        — list products for a category (with stock)
 *  pos.variants        — get variants for a variable product
 *  pos.searchCustomers — search customers
 *  pos.createOrder     — create a POS order (channel=pos, deducts from POS warehouse)
 *  pos.myStats         — cashier's today/month/total stats (B1 Board)
 *  pos.hourlySales     — hourly sales chart data for today (B1 Board)
 *  pos.myOrders        — cashier's own orders list (B3)
 *  pos.allOrders       — all POS orders at this terminal (B3)
 *  pos.orderDetail     — single order with items (B3)
 *  pos.transactions    — payment ledger for B4 Transactions screen
 *  pos.report          — sales report by payment method / seller (B5)
 *  pos.savedCarts      — list saved carts (B2)
 *  pos.saveCart        — save / update a cart (B2)
 *  pos.deleteCart      — delete a saved cart (B2)
 *  pos.getSettings     — get POS terminal settings (B6)
 *  pos.updateSettings  — update POS terminal settings (B6)
 */
import { z } from "zod";
import { router } from "../_core/trpc";
import { posProcedure } from "./procedures";
import { TRPCError } from "@trpc/server";
import { getDb, resolveWarehouseIdForChannel } from "../db";
import {
  categories, products, productVariants,
  warehouses, warehouseStock, orders, orderItems,
  customers, storeSettings, users,
} from "../../drizzle/schema";
import { eq, and, or, like, inArray, isNull, sql, desc, gte, lte, between } from "drizzle-orm";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getPosWarehouseId(): Promise<number | null> {
  return resolveWarehouseIdForChannel('pos');
}

// ─── router ──────────────────────────────────────────────────────────────────

export const posRouter = router({
  /** List all POS categories (brass + main with channel pos/both) */
  categories: posProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const posCats = await db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      image: categories.image,
      wcSource: categories.wcSource,
    })
      .from(categories)
      .where(inArray(categories.channel, ["pos", "both"]))
      .orderBy(categories.name);
    return posCats;
  }),

  /** List products for a given category, with POS stock level */
  products: posProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const posWarehouseId = await getPosWarehouseId();
      const conditions: any[] = [eq(products.status, "active")];

      if (input.categoryId) {
        const [cat] = await db.select({ name: categories.name })
          .from(categories).where(eq(categories.id, input.categoryId)).limit(1);
        if (cat) {
          const sameName = await db.select({ id: categories.id })
            .from(categories)
            .where(and(
              like(categories.name, cat.name),
              inArray(categories.channel, ["pos", "both"])
            ));
          const catIds = sameName.map(c => c.id);
          if (catIds.length > 0) {
            conditions.push(inArray(products.categoryId, catIds));
          } else {
            conditions.push(eq(products.categoryId, input.categoryId));
          }
        } else {
          conditions.push(eq(products.categoryId, input.categoryId));
        }
      } else {
        const posCats = await db.select({ id: categories.id })
          .from(categories)
          .where(inArray(categories.channel, ["pos", "both"]));
        if (posCats.length > 0) {
          conditions.push(inArray(products.categoryId, posCats.map(c => c.id)));
        }
      }

      if (input.search) {
        conditions.push(
          or(
            like(products.name, `%${input.search}%`),
            like(products.sku, `%${input.search}%`)
          ) as any
        );
      }

      const items = await db.select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        sku: products.sku,
        type: products.type,
        price: products.price,
        salePrice: products.salePrice,
        images: products.images,
        wcSource: products.wcSource,
        categoryId: products.categoryId,
      })
        .from(products)
        .where(and(...conditions))
        .orderBy(products.name)
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(products)
        .where(and(...conditions));

      const productIds = items.map(p => p.id);
      let stockMap = new Map<number, number>();
      if (posWarehouseId && productIds.length > 0) {
        const stockRows = await db.select({
          productId: warehouseStock.productId,
          quantity: warehouseStock.quantity,
        })
          .from(warehouseStock)
          .where(
            and(
              eq(warehouseStock.warehouseId, posWarehouseId),
              inArray(warehouseStock.productId, productIds),
              isNull(warehouseStock.variantId)
            )
          );
        stockRows.forEach(s => stockMap.set(s.productId, (stockMap.get(s.productId) || 0) + s.quantity));
      }

      return {
        items: items.map(p => ({ ...p, posStock: stockMap.get(p.id) ?? null })),
        total: countResult?.count || 0,
      };
    }),

  /** Get variants for a variable product */
  variants: posProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const posWarehouseId = await getPosWarehouseId();

      const variants = await db.select().from(productVariants)
        .where(
          and(
            eq(productVariants.productId, input.productId),
            eq(productVariants.isActive, true)
          )
        );

      if (!posWarehouseId || variants.length === 0) return variants.map(v => ({ ...v, posStock: null }));

      const variantIds = variants.map(v => v.id);
      const stockRows = await db.select({
        variantId: warehouseStock.variantId,
        quantity: warehouseStock.quantity,
      })
        .from(warehouseStock)
        .where(
          and(
            eq(warehouseStock.warehouseId, posWarehouseId),
            inArray(warehouseStock.variantId, variantIds as number[])
          )
        );
      const stockMap = new Map(stockRows.map(s => [s.variantId, s.quantity]));
      return variants.map(v => ({ ...v, posStock: stockMap.get(v.id) ?? null }));
    }),

  /** Search customers by name, email, or phone */
  searchCustomers: posProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phone: customers.phone,
      })
        .from(customers)
        .where(
          or(
            like(customers.firstName, `%${input.query}%`),
            like(customers.lastName, `%${input.query}%`),
            like(customers.email, `%${input.query}%`),
            like(customers.phone, `%${input.query}%`)
          ) as any
        )
        .limit(20);
    }),

  /** Create a POS order — deducts from POS warehouse */
  createOrder: posProcedure
    .input(z.object({
      customerId: z.number().optional(),
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      note: z.string().optional(),
      shippingCost: z.number().default(0),
      discountAmount: z.number().default(0),
      discountReason: z.string().optional(),
      paymentMethod: z.enum(["knet", "visa", "cash", "other"]).default("knet"),
      paymentReference: z.string().optional(),
      items: z.array(z.object({
        productId: z.number(),
        variantId: z.number().optional(),
        name: z.string(),
        sku: z.string().optional(),
        quantity: z.number().min(1),
        unitPrice: z.number(),
        discountAmount: z.number().optional(),
        variantAttributes: z.record(z.string(), z.string()).optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const posWarehouseId = await getPosWarehouseId();
      if (!posWarehouseId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "POS warehouse not found" });

      const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const total = Math.max(0, subtotal + input.shippingCost - input.discountAmount);

      // Pre-flight stock check
      const insufficientItems: string[] = [];
      for (const item of input.items) {
        const stockConditions: any[] = [
          eq(warehouseStock.warehouseId, posWarehouseId),
          eq(warehouseStock.productId, item.productId),
        ];
        if (item.variantId) {
          stockConditions.push(eq(warehouseStock.variantId, item.variantId));
        } else {
          stockConditions.push(isNull(warehouseStock.variantId));
        }
        const [stockRow] = await db.select().from(warehouseStock).where(and(...stockConditions)).limit(1);
        const available = stockRow?.quantity ?? 0;
        if (available < item.quantity) {
          insufficientItems.push(`${item.name}: requested ${item.quantity}, available ${available}`);
        }
      }
      if (insufficientItems.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient stock:\n${insufficientItems.join("\n")}`,
        });
      }

      const orderNumber = `POS-${Date.now().toString(36).toUpperCase()}`;
      const [inserted] = await db.insert(orders).values({
        orderNumber,
        customerId: input.customerId ?? null,
        customerName: input.customerName ?? null,
        customerPhone: input.customerPhone ?? null,
        channel: "pos",
        status: "completed",
        paymentStatus: "paid",
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference ?? null,
        currency: "KWD",
        subtotal: String(subtotal.toFixed(3)),
        shippingCost: String(input.shippingCost.toFixed(3)),
        discountAmount: String(input.discountAmount.toFixed(3)),
        total: String(total.toFixed(3)),
        shippingNotes: input.note ?? null,
        createdByUserId: ctx.user.id,
        paidAt: new Date(),
      });

      const orderId = (inserted as any).insertId;

      if (input.items.length > 0) {
        await db.insert(orderItems).values(
          input.items.map(item => ({
            orderId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            name: item.name,
            sku: item.sku ?? null,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice.toFixed(3)),
            totalPrice: String((item.unitPrice * item.quantity).toFixed(3)),
            variantAttributes: (item.variantAttributes ?? null) as Record<string, string> | null,
          }))
        );
      }

      // Deduct from POS warehouse stock
      for (const item of input.items) {
        const conditions: any[] = [
          eq(warehouseStock.warehouseId, posWarehouseId),
          eq(warehouseStock.productId, item.productId),
        ];
        if (item.variantId) {
          conditions.push(eq(warehouseStock.variantId, item.variantId));
        } else {
          conditions.push(isNull(warehouseStock.variantId));
        }
        const [stockRow] = await db.select().from(warehouseStock).where(and(...conditions)).limit(1);
        if (stockRow) {
          const newQty = Math.max(0, stockRow.quantity - item.quantity);
          await db.update(warehouseStock).set({ quantity: newQty }).where(eq(warehouseStock.id, stockRow.id));
        }
      }

      return { orderId, orderNumber, total };
    }),

  /** POS staff: get their own sales stats (today + this month + all time) — B1 Board */
  myStats: posProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { todaySales: 0, todayOrders: 0, monthSales: 0, monthOrders: 0, totalSales: 0, totalOrders: 0 };
    const userId = ctx.user.id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayRow] = await db.select({
      sales: sql<string>`COALESCE(SUM(total), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(orders).where(and(
      eq(orders.createdByUserId, userId),
      eq(orders.channel, 'pos'),
      gte(orders.createdAt, todayStart),
    ));

    const [monthRow] = await db.select({
      sales: sql<string>`COALESCE(SUM(total), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(orders).where(and(
      eq(orders.createdByUserId, userId),
      eq(orders.channel, 'pos'),
      gte(orders.createdAt, monthStart),
    ));

    const [totalRow] = await db.select({
      sales: sql<string>`COALESCE(SUM(total), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(orders).where(and(
      eq(orders.createdByUserId, userId),
      eq(orders.channel, 'pos'),
    ));

    return {
      todaySales: parseFloat(String(todayRow?.sales ?? '0')),
      todayOrders: Number(todayRow?.count ?? 0),
      monthSales: parseFloat(String(monthRow?.sales ?? '0')),
      monthOrders: Number(monthRow?.count ?? 0),
      totalSales: parseFloat(String(totalRow?.sales ?? '0')),
      totalOrders: Number(totalRow?.count ?? 0),
    };
  }),

  /** Hourly sales chart data for today scoped to opening hours — B1 Board */
  hourlySales: posProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const userId = ctx.user.id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Get POS settings for opening/closing hours
    const [settings] = await db.select({
      posOpeningHour: storeSettings.posOpeningHour,
      posClosingHour: storeSettings.posClosingHour,
    }).from(storeSettings).limit(1);

    const openHour = settings?.posOpeningHour ?? 9;
    const closeHour = settings?.posClosingHour ?? 21;

    const rows = await db.select({
      hour: sql<number>`HOUR(createdAt)`,
      sales: sql<string>`COALESCE(SUM(total), 0)`,
      count: sql<number>`COUNT(*)`,
    })
      .from(orders)
      .where(and(
        eq(orders.createdByUserId, userId),
        eq(orders.channel, 'pos'),
        gte(orders.createdAt, todayStart),
        lte(orders.createdAt, todayEnd),
      ))
      .groupBy(sql`HOUR(createdAt)`);

    const salesByHour = new Map(rows.map(r => [r.hour, { sales: parseFloat(String(r.sales)), count: Number(r.count) }]));

    // Build array for each hour in opening range
    const result = [];
    for (let h = openHour; h <= closeHour; h++) {
      result.push({
        hour: h,
        label: h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
        sales: salesByHour.get(h)?.sales ?? 0,
        count: salesByHour.get(h)?.count ?? 0,
      });
    }
    return result;
  }),

  /** POS staff: get their own orders list — B3 */
  myOrders: posProcedure.input(z.object({
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().default(0),
  })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { orders: [], total: 0 };
    const userId = ctx.user.id;

    const [countRow] = await db.select({ total: sql<number>`COUNT(*)` })
      .from(orders)
      .where(and(eq(orders.createdByUserId, userId), eq(orders.channel, 'pos')));

    const rows = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      total: orders.total,
      discountAmount: orders.discountAmount,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
      .from(orders)
      .where(and(eq(orders.createdByUserId, userId), eq(orders.channel, 'pos')))
      .orderBy(desc(orders.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    return { orders: rows, total: Number(countRow?.total ?? 0) };
  }),

  /** All POS orders at this terminal (all cashiers) — B3 */
  allOrders: posProcedure.input(z.object({
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().default(0),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { orders: [], total: 0 };

    const conditions: any[] = [eq(orders.channel, 'pos')];
    if (input.dateFrom) conditions.push(gte(orders.createdAt, new Date(input.dateFrom)));
    if (input.dateTo) conditions.push(lte(orders.createdAt, new Date(input.dateTo)));

    const [countRow] = await db.select({ total: sql<number>`COUNT(*)` })
      .from(orders).where(and(...conditions));

    const rows = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      total: orders.total,
      discountAmount: orders.discountAmount,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      createdByUserId: orders.createdByUserId,
      createdAt: orders.createdAt,
    })
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    // Attach cashier names
    const userIds = Array.from(new Set(rows.map(r => r.createdByUserId).filter(Boolean))) as number[];
    let userMap = new Map<number, string>();
    if (userIds.length > 0) {
      const userRows = await db.select({ id: users.id, name: users.name })
        .from(users).where(inArray(users.id, userIds));
      userRows.forEach(u => userMap.set(u.id, u.name ?? 'Unknown'));
    }

    return {
      orders: rows.map(r => ({
        ...r,
        cashierName: r.createdByUserId ? (userMap.get(r.createdByUserId) ?? 'Unknown') : 'Unknown',
      })),
      total: Number(countRow?.total ?? 0),
    };
  }),

  /** Get a single POS order with items — B3 */
  orderDetail: posProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      const [order] = await db.select().from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.channel, 'pos')))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));

      let cashierName = 'Unknown';
      if (order.createdByUserId) {
        const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, order.createdByUserId)).limit(1);
        cashierName = u?.name ?? 'Unknown';
      }

      return { ...order, items, cashierName };
    }),

  /** Payment ledger for B4 Transactions screen */
  transactions: posProcedure.input(z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    limit: z.number().min(1).max(200).default(100),
    offset: z.number().default(0),
  })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { rows: [], total: 0, todayTotal: 0 };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const conditions: any[] = [eq(orders.channel, 'pos'), eq(orders.paymentStatus, 'paid')];
    if (input.dateFrom) conditions.push(gte(orders.createdAt, new Date(input.dateFrom)));
    if (input.dateTo) conditions.push(lte(orders.createdAt, new Date(input.dateTo)));

    const [countRow] = await db.select({ total: sql<number>`COUNT(*)` })
      .from(orders).where(and(...conditions));

    const rows = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      total: orders.total,
      discountAmount: orders.discountAmount,
      paymentMethod: orders.paymentMethod,
      paymentReference: orders.paymentReference,
      createdAt: orders.createdAt,
      refundAmount: orders.refundAmount,
      refundedAt: orders.refundedAt,
    })
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    // Today's total
    const [todayRow] = await db.select({
      total: sql<string>`COALESCE(SUM(total), 0)`,
    }).from(orders).where(and(
      eq(orders.channel, 'pos'),
      eq(orders.paymentStatus, 'paid'),
      gte(orders.createdAt, todayStart),
    ));

    return {
      rows,
      total: Number(countRow?.total ?? 0),
      todayTotal: parseFloat(String(todayRow?.total ?? '0')),
    };
  }),

  /** Sales report by payment method and seller — B5 Report */
  report: posProcedure.input(z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { byPaymentMethod: [], bySeller: [], totalDiscount: 0, totalRefund: 0 };

    const conditions: any[] = [eq(orders.channel, 'pos'), eq(orders.paymentStatus, 'paid')];
    if (input.dateFrom) conditions.push(gte(orders.createdAt, new Date(input.dateFrom)));
    if (input.dateTo) conditions.push(lte(orders.createdAt, new Date(input.dateTo)));

    // By payment method
    const byMethod = await db.select({
      method: orders.paymentMethod,
      sales: sql<string>`COALESCE(SUM(total), 0)`,
      count: sql<number>`COUNT(*)`,
      refund: sql<string>`COALESCE(SUM(refundAmount), 0)`,
    })
      .from(orders)
      .where(and(...conditions))
      .groupBy(orders.paymentMethod);

    // By seller
    const bySeller = await db.select({
      userId: orders.createdByUserId,
      sales: sql<string>`COALESCE(SUM(total), 0)`,
      count: sql<number>`COUNT(*)`,
    })
      .from(orders)
      .where(and(...conditions))
      .groupBy(orders.createdByUserId);

    const userIds = Array.from(new Set(bySeller.map(r => r.userId).filter(Boolean))) as number[];
    let userMap = new Map<number, string>();
    if (userIds.length > 0) {
      const userRows = await db.select({ id: users.id, name: users.name })
        .from(users).where(inArray(users.id, userIds));
      userRows.forEach(u => userMap.set(u.id, u.name ?? 'Unknown'));
    }

    // Total discounts
    const [discountRow] = await db.select({
      total: sql<string>`COALESCE(SUM(discountAmount), 0)`,
    }).from(orders).where(and(...conditions));

    // Total refunds
    const [refundRow] = await db.select({
      total: sql<string>`COALESCE(SUM(refundAmount), 0)`,
    }).from(orders).where(and(...conditions));

    return {
      byPaymentMethod: byMethod.map(r => ({
        method: r.method ?? 'unknown',
        sales: parseFloat(String(r.sales)),
        count: Number(r.count),
        refund: parseFloat(String(r.refund)),
        net: parseFloat(String(r.sales)) - parseFloat(String(r.refund)),
      })),
      bySeller: bySeller.map(r => ({
        userId: r.userId,
        name: r.userId ? (userMap.get(r.userId) ?? 'Unknown') : 'Unknown',
        sales: parseFloat(String(r.sales)),
        count: Number(r.count),
      })),
      totalDiscount: parseFloat(String(discountRow?.total ?? '0')),
      totalRefund: parseFloat(String(refundRow?.total ?? '0')),
    };
  }),

  /** List saved carts (pending POS orders) — B2 */
  savedCarts: posProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const drafts = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      total: orders.total,
      createdAt: orders.createdAt,
    })
      .from(orders)
      .where(
        and(
          eq(orders.channel, "pos"),
          eq(orders.status, "pending"),
          eq(orders.paymentStatus, "pending"),
          eq(orders.createdByUserId, ctx.user.id),
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(20);

    // Attach items to each draft
    const result = [];
    for (const draft of drafts) {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, draft.id));
      result.push({ ...draft, items });
    }
    return result;
  }),

  /** Save current cart as a pending order — B2 */
  saveCart: posProcedure
    .input(z.object({
      cartId: z.number().optional(), // if provided, update existing
      label: z.string().optional(),
      customerName: z.string().optional(),
      discountAmount: z.number().default(0),
      items: z.array(z.object({
        productId: z.number(),
        variantId: z.number().optional(),
        name: z.string(),
        sku: z.string().optional(),
        quantity: z.number().min(1),
        unitPrice: z.number(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const total = Math.max(0, subtotal - input.discountAmount);

      if (input.cartId) {
        // Update existing draft
        await db.update(orders).set({
          customerName: input.customerName ?? null,
          subtotal: String(subtotal.toFixed(3)),
          total: String(total.toFixed(3)),
          discountAmount: String(input.discountAmount.toFixed(3)),
        }).where(eq(orders.id, input.cartId));
        // Replace items
        await db.delete(orderItems).where(eq(orderItems.orderId, input.cartId));
        if (input.items.length > 0) {
          await db.insert(orderItems).values(input.items.map(item => ({
            orderId: input.cartId!,
            productId: item.productId,
            variantId: item.variantId ?? null,
            name: item.name,
            sku: item.sku ?? null,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice.toFixed(3)),
            totalPrice: String((item.unitPrice * item.quantity).toFixed(3)),
          })));
        }
        return { cartId: input.cartId };
      } else {
        // Create new draft
        const orderNumber = `DRAFT-${Date.now().toString(36).toUpperCase()}`;
        const [inserted] = await db.insert(orders).values({
          orderNumber,
          customerName: input.customerName ?? null,
          channel: "pos",
          status: "pending",
          paymentStatus: "pending",
          currency: "KWD",
          subtotal: String(subtotal.toFixed(3)),
          total: String(total.toFixed(3)),
          discountAmount: String(input.discountAmount.toFixed(3)),
          createdByUserId: ctx.user.id,
        });
        const cartId = (inserted as any).insertId;
        if (input.items.length > 0) {
          await db.insert(orderItems).values(input.items.map(item => ({
            orderId: cartId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            name: item.name,
            sku: item.sku ?? null,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice.toFixed(3)),
            totalPrice: String((item.unitPrice * item.quantity).toFixed(3)),
          })));
        }
        return { cartId };
      }
    }),

  /** Delete a saved cart — B2 */
  deleteCart: posProcedure
    .input(z.object({ cartId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(orders).where(
        and(
          eq(orders.id, input.cartId),
          eq(orders.channel, "pos"),
          eq(orders.status, "pending"),
          eq(orders.createdByUserId, ctx.user.id),
        )
      );
      return { ok: true };
    }),

  /** Get POS terminal settings — B6 */
  getSettings: posProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [s] = await db.select({
      posTerminalName: storeSettings.posTerminalName,
      posOpeningHour: storeSettings.posOpeningHour,
      posClosingHour: storeSettings.posClosingHour,
      posReceiptHeader: storeSettings.posReceiptHeader,
      posReceiptFooter: storeSettings.posReceiptFooter,
      storeName: storeSettings.storeName,
      storeCurrency: storeSettings.storeCurrency,
    }).from(storeSettings).limit(1);
    return s ?? null;
  }),

  /** Update POS terminal settings — B6 */
  updateSettings: posProcedure
    .input(z.object({
      posTerminalName: z.string().max(128).optional(),
      posOpeningHour: z.number().min(0).max(23).optional(),
      posClosingHour: z.number().min(0).max(23).optional(),
      posReceiptHeader: z.string().max(512).optional(),
      posReceiptFooter: z.string().max(512).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const update: Record<string, any> = {};
      if (input.posTerminalName !== undefined) update.posTerminalName = input.posTerminalName;
      if (input.posOpeningHour !== undefined) update.posOpeningHour = input.posOpeningHour;
      if (input.posClosingHour !== undefined) update.posClosingHour = input.posClosingHour;
      if (input.posReceiptHeader !== undefined) update.posReceiptHeader = input.posReceiptHeader;
      if (input.posReceiptFooter !== undefined) update.posReceiptFooter = input.posReceiptFooter;
      await db.update(storeSettings).set(update);
      return { ok: true };
    }),
});
