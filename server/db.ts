import { eq, and, desc, like, or, sql, isNull, getTableColumns, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  users, categories, products, productVariants,
  warehouses, warehouseStock, stockTransfers, branches,
  customers, orders, orderItems, coupons, shippingZones,
  wishlists, storeSettings,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Look up a staff user by their username.
 * Staff users have openId = 'staff:<username>' and use password auth.
 */
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const openId = `staff:${username.toLowerCase().trim()}`;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCategories(opts?: { channel?: 'online' | 'pos' | 'both' | 'none'; warehouseId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const channel = opts?.channel;
  const warehouseId = opts?.warehouseId;

  // If warehouseId is provided, only return categories that have at least one
  // active product with stock > threshold in that warehouse.
  if (warehouseId) {
    const wid = warehouseId;
    // Use EXISTS subquery to avoid duplicate category rows from the join
    const rows = await db.select().from(categories)
      .where(and(
        eq(categories.isActive, true),
        channel ? eq(categories.channel, channel) : undefined,
        sql`EXISTS (
          SELECT 1 FROM products p
          INNER JOIN warehouse_stock ws ON ws.productId = p.id
          WHERE p.categoryId = ${categories.id}
            AND p.status = 'active'
            AND ws.warehouseId = ${wid}
            AND ws.variantId IS NULL
            AND (CASE WHEN ws.outOfStockThresholdEnabled = 1
                  THEN ws.quantity > ws.outOfStockThreshold
                  ELSE ws.quantity > 0 END)
        )`
      ))
      .orderBy(categories.displayOrder, categories.name);
    return rows;
  }

  return db.select().from(categories).where(
    channel
      ? and(eq(categories.isActive, true), eq(categories.channel, channel))
      : eq(categories.isActive, true)
  ).orderBy(categories.displayOrder, categories.name);
}

export async function getCategoryBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return result[0] || null;
}

export async function getProducts(opts: {
  categoryId?: number;
  /**
   * warehouseId: when set, only return products that have stock > 0 in this warehouse.
   * For the online storefront pass the ONLINE warehouse id (2).
   * For the POS pass the POS warehouse id (3).
   * When undefined, no warehouse filter is applied (admin views).
   */
  warehouseId?: number;
  vendorId?: number;
  search?: string;
  limit?: number; offset?: number; featured?: boolean; status?: 'active' | 'draft' | 'archived';
} = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [eq(products.status, opts.status || 'active')];
  if (opts.categoryId) {
    const categoryIds = [opts.categoryId];
    let frontier = [opts.categoryId];
    // Storefront category landing pages may point at parent categories whose
    // sellable products live in child categories. Include descendants so
    // /category/:slug and ?category=:slug behave like collection pages.
    for (let depth = 0; depth < 5 && frontier.length > 0; depth += 1) {
      const childRows = await db.select({ id: categories.id }).from(categories).where(inArray(categories.parentId, frontier));
      const childIds = childRows.map((row) => row.id).filter((id) => !categoryIds.includes(id));
      if (childIds.length === 0) break;
      categoryIds.push(...childIds);
      frontier = childIds;
    }
    conditions.push(categoryIds.length > 1 ? inArray(products.categoryId, categoryIds) : eq(products.categoryId, opts.categoryId));
  }
  if (opts.featured) conditions.push(eq(products.isFeatured, true));
  if (opts.search) conditions.push(or(like(products.name, `%${opts.search}%`), like(products.sku, `%${opts.search}%`)) as any);
  if (opts.vendorId) {
    const { productVendors } = await import('../drizzle/schema');
    const vendorProductRows = await db.select({ productId: productVendors.productId }).from(productVendors).where(eq(productVendors.vendorId, opts.vendorId));
    const vendorProductIds = vendorProductRows.map((r: any) => r.productId);
    if (vendorProductIds.length === 0) return { items: [], total: 0 };
    conditions.push(inArray(products.id, vendorProductIds));
  }
  const limit = opts.limit || 20;
  const offset = opts.offset || 0;

  const productCols = getTableColumns(products);

  // If warehouseId filter is requested, filter by sellable warehouse availability.
  // A product is "available" in a warehouse when at least one stock row for the
  // product is above its out-of-stock threshold. Simple products normally use a
  // parent-level row (variantId IS NULL), while variable products use variant
  // rows. Include active variant stock rows so category filters do not hide
  // variable products whose sellable Online quantity lives on their variations.
  // We use EXISTS subquery to avoid duplicate rows from multiple stock entries per product.
  if (opts.warehouseId) {
    const wid = opts.warehouseId;
    const warehouseCondition = and(
      ...conditions,
      sql`EXISTS (
        SELECT 1 FROM warehouse_stock ws
        WHERE ws.productId = ${products.id}
          AND ws.warehouseId = ${wid}
          AND (CASE WHEN ws.outOfStockThresholdEnabled = 1
                THEN ws.quantity > ws.outOfStockThreshold
                ELSE ws.quantity > 0 END)
          AND (
            ws.variantId IS NULL
            OR EXISTS (
              SELECT 1 FROM product_variants pv
              WHERE pv.id = ws.variantId
                AND pv.productId = ${products.id}
                AND pv.isActive = 1
            )
          )
      )`
    );
    const items = await db.select(productCols).from(products)
      .where(warehouseCondition)
      .orderBy(desc(products.isFeatured), desc(products.createdAt))
      .limit(limit).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(warehouseCondition);
    return { items, total: countResult?.count || 0 };
  }

  const items = await db.select().from(products)
    .where(and(...conditions)).orderBy(desc(products.isFeatured), desc(products.createdAt))
    .limit(limit).offset(offset);
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(products).where(and(...conditions));
  return { items, total: countResult?.count || 0 };
}

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return result[0] || null;
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0] || null;
}

export async function getProductVariants(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.isActive, true)));
}

export async function getProductStock(productId: number, variantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(warehouseStock.productId, productId)];
  if (variantId !== undefined) {
    if (variantId) conditions.push(eq(warehouseStock.variantId, variantId));
    else conditions.push(isNull(warehouseStock.variantId));
  }
  return db.select({
    warehouseId: warehouseStock.warehouseId,
    warehouseName: warehouses.name,
    warehouseCode: warehouses.code,
    warehouseType: warehouses.type,
    quantity: warehouseStock.quantity,
    reservedQty: warehouseStock.reservedQty,
    variantId: warehouseStock.variantId,
  }).from(warehouseStock)
    .innerJoin(warehouses, eq(warehouses.id, warehouseStock.warehouseId))
    .where(and(...conditions));
}

export async function transferStock(opts: {
  fromWarehouseId: number; toWarehouseId: number; productId: number;
  variantId?: number; quantity: number; reason?: string; notes?: string; createdBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Stock transfer availability is validated against the exact source warehouse row below.
  // Do not subtract existing Online/POS destination stock from Main Warehouse: those rows are
  // independent location balances, and doing so can incorrectly make Main availability negative
  // when POS or Online already holds stock for the same product.
  const srcConditions: any[] = [eq(warehouseStock.warehouseId, opts.fromWarehouseId), eq(warehouseStock.productId, opts.productId)];
  if (opts.variantId) srcConditions.push(eq(warehouseStock.variantId, opts.variantId));
  else srcConditions.push(isNull(warehouseStock.variantId));
  const [srcStock] = await db.select().from(warehouseStock).where(and(...srcConditions)).limit(1);
  if (!srcStock || srcStock.quantity < opts.quantity) {
    throw new Error(`Insufficient stock. Available: ${srcStock?.quantity || 0}, Requested: ${opts.quantity}`);
  }
  await db.update(warehouseStock).set({ quantity: srcStock.quantity - opts.quantity }).where(and(...srcConditions));
  const destConditions: any[] = [eq(warehouseStock.warehouseId, opts.toWarehouseId), eq(warehouseStock.productId, opts.productId)];
  if (opts.variantId) destConditions.push(eq(warehouseStock.variantId, opts.variantId));
  else destConditions.push(isNull(warehouseStock.variantId));
  const [destStock] = await db.select().from(warehouseStock).where(and(...destConditions)).limit(1);
  if (destStock) {
    const newDestQty = destStock.quantity + opts.quantity;
    const reorderPoint = destStock.reorderPoint ?? 0;
    // P10: Reset lowStockAlertSent if stock rises above reorderPoint
    const shouldResetAlert = destStock.lowStockAlertSent && reorderPoint > 0 && newDestQty > reorderPoint;
    await db.update(warehouseStock)
      .set({ quantity: newDestQty, ...(shouldResetAlert ? { lowStockAlertSent: false } : {}) })
      .where(and(...destConditions));
  } else {
    await db.insert(warehouseStock).values({ warehouseId: opts.toWarehouseId, productId: opts.productId, variantId: opts.variantId || null, quantity: opts.quantity, reservedQty: 0, lowStockAlertSent: false });
  }
  await db.insert(stockTransfers).values({
    fromWarehouseId: opts.fromWarehouseId, toWarehouseId: opts.toWarehouseId,
    productId: opts.productId, variantId: opts.variantId || null,
    quantity: opts.quantity, reason: opts.reason || null, notes: opts.notes || null,
    status: 'completed', createdBy: opts.createdBy || null, completedAt: new Date(),
  });
  return { success: true };
}

export async function getOrders(opts: { customerId?: number; status?: string; channel?: 'online' | 'pos'; limit?: number; offset?: number; } = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [];
  if (opts.customerId) conditions.push(eq(orders.customerId, opts.customerId));
  if (opts.status) conditions.push(eq(orders.status, opts.status as any));
  if (opts.channel) conditions.push(eq(orders.channel, opts.channel));
  const limit = opts.limit || 20;
  const offset = opts.offset || 0;
  const rows = await db.select().from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
  // Attach itemCount via a single batch query
  const orderIds = rows.map(r => r.id);
  let itemCounts: Record<number, number> = {};
  if (orderIds.length > 0) {
    const counts = await db.select({ orderId: orderItems.orderId, cnt: sql<number>`count(*)` })
      .from(orderItems)
      .where(sql`${orderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(orderItems.orderId);
    counts.forEach(c => { itemCounts[c.orderId] = Number(c.cnt); });
  }
  const items = rows.map(r => ({ ...r, itemCount: itemCounts[r.id] ?? 0 }));
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(orders)
    .where(conditions.length ? and(...conditions) : undefined);
  return { items, total: countResult?.count || 0 };
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0] || null;
}

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function getCouponByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(coupons)
    .where(and(eq(coupons.code, code.toLowerCase()), eq(coupons.isActive, true))).limit(1);
  return result[0] || null;
}

export async function getShippingZones() {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(shippingZones).where(eq(shippingZones.isActive, true));
  // Deduplicate by name (multiple WC stores may sync same zone names)
  const seen = new Set<string>();
  return all.filter(z => {
    if (seen.has(z.name)) return false;
    seen.add(z.name);
    return true;
  });
}

export async function getWishlist(userId?: number, sessionId?: string) {
  const db = await getDb();
  if (!db) return [];
  if (userId) return db.select().from(wishlists).where(eq(wishlists.userId, userId));
  if (sessionId) return db.select().from(wishlists).where(eq(wishlists.sessionId, sessionId));
  return [];
}

export async function addToWishlist(productId: number, userId?: number, sessionId?: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(wishlists).values({ productId, userId: userId || null, sessionId: sessionId || null })
    .onDuplicateKeyUpdate({ set: { productId } });
}

export async function removeFromWishlist(productId: number, userId?: number, sessionId?: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (userId) await db.delete(wishlists).where(and(eq(wishlists.productId, productId), eq(wishlists.userId, userId)));
  else if (sessionId) await db.delete(wishlists).where(and(eq(wishlists.productId, productId), eq(wishlists.sessionId, sessionId)));
}


export async function getAllWarehouses() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(warehouses).where(eq(warehouses.isActive, true));
}

export type SalesChannelWarehouse = 'online' | 'pos' | 'main';

export async function resolveWarehouseIdForChannel(channel: SalesChannelWarehouse): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const [settings] = await db.select().from(storeSettings).limit(1);
  const configuredId = channel === 'pos'
    ? settings?.posWarehouseId
    : channel === 'online'
      ? settings?.onlineWarehouseId
      : settings?.mainWarehouseId;

  if (configuredId) {
    const [configured] = await db.select({ id: warehouses.id })
      .from(warehouses)
      .where(and(eq(warehouses.id, configuredId), eq(warehouses.isActive, true)))
      .limit(1);
    if (configured?.id) return configured.id;
  }

  const fallbackConditions: any[] = [eq(warehouses.isActive, true)];
  if (channel === 'pos') {
    fallbackConditions.push(or(eq(warehouses.code, 'POS'), eq(warehouses.type, 'pos')) as any);
  } else if (channel === 'online') {
    fallbackConditions.push(or(eq(warehouses.code, 'ONLINE'), eq(warehouses.type, 'online')) as any);
  } else {
    fallbackConditions.push(or(eq(warehouses.code, 'MAIN'), eq(warehouses.type, 'main')) as any);
  }

  const [fallback] = await db.select({ id: warehouses.id })
    .from(warehouses)
    .where(and(...fallbackConditions))
    .limit(1);
  return fallback?.id ?? null;
}

/**
 * Resolve the dedicated warehouse for a POS branch (strict 1:1).
 * Used instead of resolveWarehouseIdForChannel('pos') now that each branch
 * has its own stock pool. Falls back to null if the branch is missing/inactive,
 * so callers can decide how to handle "no active branch selected".
 */
export async function resolveWarehouseIdForBranch(branchId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const [branch] = await db.select({ warehouseId: branches.warehouseId })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.isActive, true)))
    .limit(1);
  if (!branch?.warehouseId) return null;

  const [warehouse] = await db.select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.id, branch.warehouseId), eq(warehouses.isActive, true)))
    .limit(1);
  return warehouse?.id ?? null;
}


export async function getStockTransfers(productId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stockTransfers)
    .where(productId ? eq(stockTransfers.productId, productId) : undefined)
    .orderBy(desc(stockTransfers.createdAt)).limit(limit);
}

export async function createOrder(opts: {
  customerId?: number;
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
  channel: 'online' | 'pos';
  status: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  couponCode?: string;
  shippingMethod?: string;
  paymentMethod?: string;
  billingAddress?: any;
  shippingAddress?: any;
  notes?: string;
  items: Array<{
    productId: number;
    variantId?: number;
    name: string;
    sku?: string;
    quantity: number;
    qtyValue?: number;
    measurementType?: 'unit' | 'meter' | 'kg' | 'roll' | 'box';
    price: number;
    total: number;
    variantAttributes?: Record<string, any>;
  }>;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const { orders, orderItems } = await import('../drizzle/schema');

  const orderNumber = `CVE-${Date.now().toString(36).toUpperCase()}`;
  const addr = opts.shippingAddress || opts.billingAddress || {};

  const insertResult = await db.insert(orders).values({
    orderNumber,
    customerId: opts.customerId || null,
    customerEmail: opts.guestEmail || null,
    customerName: opts.guestName || null,
    customerPhone: opts.guestPhone || null,
    channel: opts.channel as any,
    status: opts.status as any,
    currency: opts.currency,
    subtotal: String(opts.subtotal),
    discountAmount: String(opts.discountTotal),
    shippingCost: String(opts.shippingTotal),
    total: String(opts.total),
    couponCode: opts.couponCode || null,
    shippingMethod: opts.shippingMethod || null,
    paymentMethod: opts.paymentMethod || null,
    shippingCountry: addr.country || 'KW',
    shippingArea: addr.city || addr.area || null,
    shippingBlock: addr.block || null,
    shippingStreet: addr.street || null,
    shippingAvenue: addr.avenue || null,
    shippingHouse: addr.house || addr.building || null,
    shippingPaci: addr.paci || null,
    shippingNotes: opts.notes || addr.notes || null,
  });

  // Different MySQL/TiDB drivers expose the insert id in slightly different
  // shapes. MyFatoorah checkout immediately calls payment.initiate with this
  // id, so never return undefined/null from createOrder after a successful
  // insert.
  const insertIdCandidates = [
    (insertResult as any)?.insertId,
    Array.isArray(insertResult) ? (insertResult as any)[0]?.insertId : undefined,
    Array.isArray((insertResult as any)?.[0]) ? (insertResult as any)[0][0]?.insertId : undefined,
  ];
  let orderId = insertIdCandidates.find((value) => typeof value === 'number' && value > 0) as number | undefined;

  if (!orderId) {
    const [createdOrder] = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    orderId = createdOrder?.id;
  }

  if (!orderId) {
    throw new Error(`Order was inserted but no numeric order id could be resolved for ${orderNumber}`);
  }

  if (opts.items.length > 0) {
    await db.insert(orderItems).values(opts.items.map(item => ({
      orderId,
      productId: item.productId,
      variantId: item.variantId || null,
      name: item.name,
      sku: item.sku || null,
      quantity: item.quantity,
      qtyValue: String(item.qtyValue ?? item.quantity),
      measurementType: (item.measurementType ?? 'unit') as any,
      unitPrice: String(item.price),
      // totalPrice = unitPrice × qtyValue for measurement-based items
      totalPrice: String(item.total),
      variantAttributes: item.variantAttributes ?? null,
    })));
  }

  // Increment coupon usage count if a coupon was applied
  if (opts.couponCode) {
    const code = opts.couponCode.toUpperCase().trim();
    await db.execute(sql`UPDATE coupons SET usageCount = usageCount + 1 WHERE UPPER(code) = ${code}`);
  }

  // P12: Increment customer totalOrders and totalSpent
  if (opts.customerId) {
    const { customers } = await import('../drizzle/schema');
    await db.execute(
      sql`UPDATE customers SET totalOrders = totalOrders + 1, totalSpent = totalSpent + ${opts.total} WHERE id = ${opts.customerId}`
    );
  }

  return { orderId, orderNumber };
}
export async function deductStockForOrder(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const { orderItems: orderItemsTable, products: productsTable,
    warehouseStock, bundleItems, productVariants: pvTable, orders: ordersTable, attributeValueBundleItems } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');

  const [order] = await db.select({ channel: ordersTable.channel, branchId: ordersTable.branchId }).from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  const orderChannel = order?.channel === 'pos' ? 'pos' : 'online';
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  if (!items.length) return;

  // POS orders deduct from their own branch's warehouse. Older POS orders created
  // before branches existed have no branchId — fall back to the old global POS
  // warehouse lookup so they still resolve correctly.
  const warehouseId = orderChannel === 'pos' && order?.branchId
    ? await resolveWarehouseIdForBranch(order.branchId)
    : await resolveWarehouseIdForChannel(orderChannel);
  if (!warehouseId) throw new Error(`${orderChannel === 'pos' ? 'POS' : 'Online'} warehouse not configured or not found`);

  await db.transaction(async (tx) => {
    const deductProductLevelComponent = async (productId: number, requiredQty: number, sourceLabel: string) => {
      const [rows] = await tx.execute(
        sql`SELECT id, quantity FROM warehouse_stock WHERE warehouseId = ${warehouseId} AND productId = ${productId} AND variantId IS NULL LIMIT 1 `.append(sql.raw('FOR UPDATE'))
      ) as any;
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) {
        throw new Error('Missing stock row for option component productId: ' + productId + ' (' + sourceLabel + ')');
      }
      if (Number(row.quantity) < requiredQty) {
        throw new Error('Insufficient stock for option component productId: ' + productId + ' (' + sourceLabel + '). Available: ' + row.quantity + ', Required: ' + requiredQty);
      }
      await tx.execute(sql`UPDATE warehouse_stock SET quantity = quantity - ${requiredQty} WHERE id = ${row.id}`);
    };

    for (const item of items) {
      const [prod] = item.productId
        ? await tx.select({ type: productsTable.type })
            .from(productsTable).where(eq(productsTable.id, item.productId)).limit(1)
        : [];

      const selectedAttributeValueIds = (() => {
        const attrs: any = (item as any).variantAttributes ?? {};
        const raw = attrs?.__selectedAttributeValueIds ?? attrs?.selectedAttributeValueIds ?? [];
        if (!Array.isArray(raw)) return [] as number[];
        return Array.from(new Set(raw.map((value: any) => Number(value)).filter((value: number) => Number.isFinite(value) && value > 0)));
      })();

      for (const attributeValueId of selectedAttributeValueIds) {
        const components = await tx.select().from(attributeValueBundleItems)
          .where(eq(attributeValueBundleItems.attributeValueId, attributeValueId));
        for (const component of components) {
          const componentQty = Math.ceil(Number(component.qty || 1) * item.quantity);
          await deductProductLevelComponent(component.productId, componentQty, 'attributeValueId: ' + attributeValueId);
        }
      }

      // Step A: Deduct bundle components for any variant that has bundle_items entries
      // This works regardless of product type (bundle, variable, etc.)
      if (item.variantId) {
        const bundleComponents = await tx.select().from(bundleItems)
          .where(eq(bundleItems.bundleVariantId, item.variantId));

        for (const component of bundleComponents) {
          const componentQty = Math.ceil(parseFloat(String(component.qty || '1')) * item.quantity);
          const sourceType = (component as any).stockSourceType === 'product' ? 'product' : 'variant';
          let compRows: any;
          if (sourceType === 'product') {
            if (!(component as any).componentProductId) {
              throw new Error('Bundle component product source is missing componentProductId for bundleVariantId: ' + item.variantId);
            }
            [compRows] = await tx.execute(
              sql`SELECT id, quantity FROM warehouse_stock WHERE warehouseId = ${warehouseId} AND productId = ${(component as any).componentProductId} AND variantId IS NULL LIMIT 1 `.append(sql.raw('FOR UPDATE'))
            ) as any;
          } else {
            if (!component.componentVariantId) {
              throw new Error('Bundle component variant source is missing componentVariantId for bundleVariantId: ' + item.variantId);
            }
            [compRows] = await tx.execute(
              sql`SELECT id, quantity FROM warehouse_stock WHERE warehouseId = ${warehouseId} AND variantId = ${component.componentVariantId} LIMIT 1 `.append(sql.raw('FOR UPDATE'))
            ) as any;
          }
          const compRow = Array.isArray(compRows) ? compRows[0] : compRows;
          const sourceLabel = sourceType === 'product'
            ? 'productId: ' + (component as any).componentProductId
            : 'variantId: ' + component.componentVariantId;
          if (!compRow) throw new Error('Missing stock row for bundle component (' + sourceLabel + ')');
          if (Number(compRow.quantity) < componentQty) {
            throw new Error('Insufficient stock for bundle component (' + sourceLabel + '). Available: ' + compRow.quantity + ', Required: ' + componentQty);
          }
          await tx.execute(sql`UPDATE warehouse_stock SET quantity = quantity - ${componentQty} WHERE id = ${compRow.id}`);
        }
      }

      // Step B: Deduct regular stock for the main item (always runs)
      // P7: Check if this item is on pre-order path. Also determine whether a
      // variation manages its own stock. Unmanaged variations intentionally draw
      // from the product-level/shared Online Store pool, not from a strict
      // variant-specific row.
      let isPreOrder = false;
      let variantManagesOwnStock = false;
      if (item.variantId) {
        const [pvRow] = await tx.select({
          manageStock: pvTable.manageStock,
          preOrderEnabled: pvTable.preOrderEnabled,
          preOrderLimit: pvTable.preOrderLimit,
          preOrderUsed: pvTable.preOrderUsed,
        }).from(pvTable).where(eq(pvTable.id, item.variantId)).limit(1);
        variantManagesOwnStock = Boolean(pvRow?.manageStock);
        if (pvRow?.preOrderEnabled && pvRow.preOrderUsed < pvRow.preOrderLimit) {
          isPreOrder = true;
          // Increment preOrderUsed (do NOT deduct warehouse stock)
          await tx.update(pvTable)
            .set({ preOrderUsed: pvRow.preOrderUsed + item.quantity })
            .where(eq(pvTable.id, item.variantId));
        }
      }
      if (isPreOrder) continue;

      if (item.variantId && !variantManagesOwnStock) {
        const [poolRowsRaw] = await tx.execute(
          sql`SELECT id, quantity
              FROM warehouse_stock
              WHERE warehouseId = ${warehouseId}
                AND productId = ${item.productId}
                AND (
                  variantId IS NULL
                  OR variantId IN (SELECT id FROM product_variants WHERE productId = ${item.productId} AND manageStock = 0)
                )
              ORDER BY CASE WHEN variantId IS NULL THEN 0 ELSE 1 END, id
              `.append(sql.raw('FOR UPDATE'))
        ) as any;
        const poolRows = Array.isArray(poolRowsRaw) ? poolRowsRaw : (poolRowsRaw ? [poolRowsRaw] : []);
        const available = poolRows.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0);
        if (available < item.quantity) {
          throw new Error('Insufficient stock for "' + item.name + '". Available: ' + available + ', Required: ' + item.quantity);
        }
        let remaining = item.quantity;
        let alertStockId: number | null = null;
        let alertNewQty = 0;
        for (const row of poolRows) {
          if (remaining <= 0) break;
          const take = Math.min(Number(row.quantity || 0), remaining);
          if (take <= 0) continue;
          const newRowQty = Number(row.quantity || 0) - take;
          await tx.execute(sql`UPDATE warehouse_stock SET quantity = ${newRowQty} WHERE id = ${row.id}`);
          remaining -= take;
          alertStockId = row.id;
          alertNewQty = newRowQty;
        }
        if (alertStockId) {
          const [stockRow] = await tx.select({
            reorderPoint: warehouseStock.reorderPoint,
            lowStockAlertSent: warehouseStock.lowStockAlertSent,
          }).from(warehouseStock).where(eq(warehouseStock.id, alertStockId)).limit(1);
          const reorderPoint = stockRow?.reorderPoint ?? 0;
          if (reorderPoint > 0 && alertNewQty <= reorderPoint && !stockRow?.lowStockAlertSent) {
            await tx.update(warehouseStock)
              .set({ lowStockAlertSent: true })
              .where(eq(warehouseStock.id, alertStockId));
            const { notifyOwner } = await import('./_core/notification');
            notifyOwner({
              title: `Low Stock Alert: ${item.name}`,
              content: `Stock for "${item.name}" (Product ID: ${item.productId}${item.variantId ? ', Variant ID: ' + item.variantId : ''}) has dropped to ${alertNewQty} units, which is at or below the reorder point of ${reorderPoint}. Please restock soon.`,
            }).catch(() => {/* non-blocking */});
          }
        }
        continue;
      }

      let lockQuery: any;
      if (item.variantId) {
        lockQuery = sql`SELECT id, quantity FROM warehouse_stock WHERE warehouseId = ${warehouseId} AND productId = ${item.productId} AND variantId = ${item.variantId} LIMIT 1 `.append(sql.raw('FOR UPDATE'));
      } else {
        lockQuery = sql`SELECT id, quantity FROM warehouse_stock WHERE warehouseId = ${warehouseId} AND productId = ${item.productId} AND variantId IS NULL LIMIT 1 `.append(sql.raw('FOR UPDATE'));
      }
      const [rows] = await tx.execute(lockQuery) as any;
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) continue;
      if (Number(row.quantity) < item.quantity) {
        throw new Error('Insufficient stock for "' + item.name + '". Available: ' + row.quantity + ', Required: ' + item.quantity);
      }
      await tx.execute(sql`UPDATE warehouse_stock SET quantity = quantity - ${item.quantity} WHERE id = ${row.id}`);
      // P10: Low stock alert — check after deduction
      const newQty = Number(row.quantity) - item.quantity;
      const [stockRow] = await tx.select({
        reorderPoint: warehouseStock.reorderPoint,
        lowStockAlertSent: warehouseStock.lowStockAlertSent,
      }).from(warehouseStock).where(eq(warehouseStock.id, row.id)).limit(1);
      const reorderPoint = stockRow?.reorderPoint ?? 0;
      if (reorderPoint > 0 && newQty <= reorderPoint && !stockRow?.lowStockAlertSent) {
        // Fire notification and mark alert as sent
        await tx.update(warehouseStock)
          .set({ lowStockAlertSent: true })
          .where(eq(warehouseStock.id, row.id));
        // Notify owner (fire-and-forget, outside transaction to avoid blocking)
        const { notifyOwner } = await import('./_core/notification');
        notifyOwner({
          title: `Low Stock Alert: ${item.name}`,
          content: `Stock for "${item.name}" (Product ID: ${item.productId}${item.variantId ? ', Variant ID: ' + item.variantId : ''}) has dropped to ${newQty} units, which is at or below the reorder point of ${reorderPoint}. Please restock soon.`,
        }).catch(() => {/* non-blocking */});
      }
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────────
// P11: SKU Generation Helper
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generate a unique SKU for a product variant.
 * Format: {productSlug}-{value1}-{value2}...
 * Appends -2, -3, etc. on collision.
 * Excludes the current variant ID from the uniqueness check (for updates).
 */
export async function generateSku(
  productSlug: string,
  attributeValues: string[],
  excludeVariantId?: number
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const base = [slugify(productSlug), ...attributeValues.map(v => slugify(v))]
    .filter(Boolean)
    .join('-')
    .substring(0, 100);

  const { productVariants } = await import('../drizzle/schema');
  const { like, ne } = await import('drizzle-orm');

  // Find existing SKUs that start with the base
  const conditions: any[] = [like(productVariants.sku, `${base}%`)];
  if (excludeVariantId) conditions.push(ne(productVariants.id, excludeVariantId));
  const existing = await db.select({ sku: productVariants.sku })
    .from(productVariants)
    .where(and(...conditions));
  const existingSet = new Set(existing.map(r => r.sku));

  // Try base first, then base-2, base-3, etc.
  if (!existingSet.has(base)) return base;
  let suffix = 2;
  while (existingSet.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

/**
 * Check if a given SKU is already used by another variant.
 * Returns the conflicting variant ID if found, null otherwise.
 */
export async function checkSkuUnique(
  sku: string,
  excludeVariantId?: number
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const { productVariants } = await import('../drizzle/schema');
  const conditions: any[] = [eq(productVariants.sku, sku)];
  if (excludeVariantId) {
    const { ne } = await import('drizzle-orm');
    conditions.push(ne(productVariants.id, excludeVariantId));
  }
  const [existing] = await db.select({ id: productVariants.id })
    .from(productVariants)
    .where(and(...conditions))
    .limit(1);
  return existing?.id ?? null;
}
