import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────────────────────────────────────
// HOMEPAGE CMS SECTIONS
// ─────────────────────────────────────────────────────────────────────────────
export const homepageSections = mysqlTable("homepage_sections", {
  id: int("id").autoincrement().primaryKey(),
  sectionKey: varchar("sectionKey", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 512 }),
  titleAr: varchar("titleAr", { length: 512 }),
  subtitle: text("subtitle"),
  subtitleAr: text("subtitleAr"),
  ctaText: varchar("ctaText", { length: 256 }),
  ctaTextAr: varchar("ctaTextAr", { length: 256 }),
  ctaUrl: varchar("ctaUrl", { length: 512 }),
  imageUrl: text("imageUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS (Manus auth + storefront customers)
// ─────────────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "pos", "orders"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordHash: text("passwordHash"),
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  wcId: int("wcId"),
  wcSource: mysqlEnum("wcSource", ["main", "brass"]),
  name: varchar("name", { length: 255 }).notNull(),
  nameAr: varchar("nameAr", { length: 255 }),
  slug: varchar("slug", { length: 255 }).notNull(),
  parentId: int("parentId"),
  description: text("description"),
  image: text("image"),
  channel: mysqlEnum("channel", ["web", "store", "online", "pos", "both", "none"]).default("both"),
  displayOrder: int("displayOrder").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("categories_slug_idx").on(t.slug),
  uniqueIndex("categories_wcId_source_unique").on(t.wcId, t.wcSource),
]);

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  wcId: int("wcId"),
  wcSource: mysqlEnum("wcSource", ["main", "brass"]),
  name: varchar("name", { length: 500 }).notNull(),
  nameAr: varchar("nameAr", { length: 500 }),
  slug: varchar("slug", { length: 500 }).notNull().unique(),
  sku: varchar("sku", { length: 128 }),
  description: text("description"),
  descriptionAr: text("descriptionAr"),
  shortDescription: text("shortDescription"),
  shortDescriptionAr: text("shortDescriptionAr"),
  price: decimal("price", { precision: 12, scale: 3 }).notNull().default("0.000"),
  salePrice: decimal("salePrice", { precision: 12, scale: 3 }),
  cog: decimal("cog", { precision: 12, scale: 3 }),
  currency: varchar("currency", { length: 8 }).default("KWD").notNull(),
  images: json("images").$type<string[]>().default([]),
  categoryId: int("categoryId"),
  tags: json("tags").$type<string[]>().default([]),
  status: mysqlEnum("status", ["active", "draft", "archived"]).default("active").notNull(),
  type: mysqlEnum("type", ["simple", "variable", "grouped", "bundle", "custom_box"]).default("simple").notNull(),
  measurementType: mysqlEnum("measurementType", ["unit", "meter", "kg", "roll", "box"]).default("unit").notNull(),
  isFeatured: boolean("isFeatured").default(false).notNull(),
  isNew: boolean("isNew").default(false).notNull(),
  weight: decimal("weight", { precision: 8, scale: 3 }),
  dimensionsJson: json("dimensionsJson").$type<{ length?: string; width?: string; height?: string }>(),
  wcRawData: json("wcRawData"),
  customBoxConfig: json("customBoxConfig").$type<{ minItems: number; maxItems: number; allowedVariantIds: number[] } | null>().default(null),
  shippingClass: varchar("shippingClass", { length: 128 }),
  shippingClassId: int("shippingClassId"),
  kuwaitOnly: boolean("kuwaitOnly").default(false).notNull(),
  color: varchar("color", { length: 255 }),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("products_slug_idx").on(t.slug),
  index("products_wcId_idx").on(t.wcId),
  index("products_sku_idx").on(t.sku),
  index("products_categoryId_idx").on(t.categoryId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
export const productVariants = mysqlTable("product_variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  wcVariantId: int("wcVariantId"),
  sku: varchar("sku", { length: 128 }),
  name: varchar("name", { length: 255 }).notNull(),
  attributes: json("attributes").$type<Record<string, string>>().default({}),
  price: decimal("price", { precision: 12, scale: 3 }).notNull().default("0.000"),
  salePrice: decimal("salePrice", { precision: 12, scale: 3 }),
  cog: decimal("cog", { precision: 12, scale: 3 }),
  image: text("image"),
  galleryImages: json("galleryImages").$type<string[]>().default([]),
  weight: decimal("weight", { precision: 8, scale: 3 }),
  isActive: boolean("isActive").default(true).notNull(),
  // P7: Pre-order support
  preOrderEnabled: boolean("preOrderEnabled").default(false).notNull(),
  preOrderLimit: int("preOrderLimit").default(0).notNull(),
  preOrderUsed: int("preOrderUsed").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("variants_productId_idx").on(t.productId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// WAREHOUSES  (Main, Online, POS)
// ─────────────────────────────────────────────────────────────────────────────
export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  type: mysqlEnum("type", ["main", "online", "pos"]).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WAREHOUSE STOCK
// ─────────────────────────────────────────────────────────────────────────────
export const warehouseStock = mysqlTable("warehouse_stock", {
  id: int("id").autoincrement().primaryKey(),
  warehouseId: int("warehouseId").notNull(),
  productId: int("productId").notNull(),
  variantId: int("variantId"),
  quantity: int("quantity").default(0).notNull(),
  reservedQty: int("reservedQty").default(0).notNull(),
  reorderPoint: int("reorderPoint").default(0),
  // Out-of-stock threshold: when enabled, product shows as OOS once qty drops to this value
  outOfStockThresholdEnabled: boolean("outOfStockThresholdEnabled").default(false).notNull(),
  outOfStockThreshold: int("outOfStockThreshold").default(0).notNull(),
  // P10: Low stock alert tracking
  lowStockAlertSent: boolean("lowStockAlertSent").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("stock_warehouse_product_idx").on(t.warehouseId, t.productId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// STORE SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
export const storeSettings = mysqlTable("store_settings", {
  id: int("id").autoincrement().primaryKey(),
  // POS channel
  posEnabled: boolean("posEnabled").default(false).notNull(),
  posWarehouseId: int("posWarehouseId"),   // FK to warehouses.id
  // Warehouse assignments
  mainWarehouseId: int("mainWarehouseId"),  // FK to warehouses.id
  onlineWarehouseId: int("onlineWarehouseId"), // FK to warehouses.id
  // Store identity
  storeName: varchar("storeName", { length: 255 }).default("Cove Interior").notNull(),
  storeCurrency: varchar("storeCurrency", { length: 8 }).default("KWD").notNull(),
  // Payment gateways
  activeGateway: mysqlEnum("activeGateway", ["myfatoorah", "upayment", "taly"]).default("myfatoorah").notNull(),
  codEnabled: boolean("codEnabled").default(false).notNull(),
  // Per-gateway API keys (stored here so admin can manage without redeploying)
  myfatoorahApiKey: text("myfatoorahApiKey"),
  myfatoorahIsTest: boolean("myfatoorahIsTest").default(false).notNull(),
  upaymentApiKey: text("upaymentApiKey"),
  talyApiKey: text("talyApiKey"),
  // Shipping: feature flags
  shippingTableRateEnabled: boolean("shippingTableRateEnabled").default(false).notNull(),
  // Kuwait base delivery cost (default 2 KWD)
  kuwaitBaseDeliveryCost: decimal("kuwaitBaseDeliveryCost", { precision: 10, scale: 3 }).default("2.000").notNull(),
  adminLanguage: mysqlEnum("adminLanguage", ["en", "ar"]).default("en").notNull(),
  // POS terminal settings (B6)
  posTerminalName: varchar("posTerminalName", { length: 128 }).default("Register 1"),
  posOpeningHour: int("posOpeningHour").default(9),
  posClosingHour: int("posClosingHour").default(21),
  posReceiptHeader: varchar("posReceiptHeader", { length: 512 }),
  posReceiptFooter: varchar("posReceiptFooter", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// STOCK TRANSFERS
// ─────────────────────────────────────────────────────────────────────────────
export const stockTransfers = mysqlTable("stock_transfers", {
  id: int("id").autoincrement().primaryKey(),
  fromWarehouseId: int("fromWarehouseId").notNull(),
  toWarehouseId: int("toWarehouseId").notNull(),
  productId: int("productId").notNull(),
  variantId: int("variantId"),
  quantity: int("quantity").notNull(),
  reason: varchar("reason", { length: 255 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "completed", "cancelled"]).default("completed").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (t) => [
  index("transfers_product_idx").on(t.productId),
  index("transfers_createdAt_idx").on(t.createdAt),
]);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  wcCustomerId: int("wcCustomerId"),
  wcSource: mysqlEnum("wcSource", ["main", "brass"]),
  firstName: varchar("firstName", { length: 128 }),
  lastName: varchar("lastName", { length: 128 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  country: varchar("country", { length: 4 }).default("KW"),
  area: varchar("area", { length: 128 }),
  block: varchar("block", { length: 32 }),
  street: varchar("street", { length: 128 }),
  avenue: varchar("avenue", { length: 128 }),
  house: varchar("house", { length: 128 }),
  paci: varchar("paci", { length: 64 }),
  notes: text("notes"),
  totalOrders: int("totalOrders").default(0),
  totalSpent: decimal("totalSpent", { precision: 14, scale: 3 }).default("0.000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("customers_email_idx").on(t.email),
  index("customers_wcId_idx").on(t.wcCustomerId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 64 }).notNull().unique(),
  wcOrderId: int("wcOrderId"),
  wcSource: mysqlEnum("wcSource", ["main", "brass"]),
  customerId: int("customerId"),
  customerName: varchar("customerName", { length: 256 }),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerPhone: varchar("customerPhone", { length: 32 }),
  shippingCountry: varchar("shippingCountry", { length: 4 }).default("KW"),
  shippingArea: varchar("shippingArea", { length: 128 }),
  shippingBlock: varchar("shippingBlock", { length: 32 }),
  shippingStreet: varchar("shippingStreet", { length: 128 }),
  shippingAvenue: varchar("shippingAvenue", { length: 128 }),
  shippingHouse: varchar("shippingHouse", { length: 128 }),
  shippingPaci: varchar("shippingPaci", { length: 64 }),
  shippingNotes: text("shippingNotes"),
  subtotal: decimal("subtotal", { precision: 14, scale: 3 }).notNull().default("0.000"),
  shippingCost: decimal("shippingCost", { precision: 10, scale: 3 }).default("0.000"),
  discountAmount: decimal("discountAmount", { precision: 10, scale: 3 }).default("0.000"),
  total: decimal("total", { precision: 14, scale: 3 }).notNull().default("0.000"),
  currency: varchar("currency", { length: 8 }).default("KWD").notNull(),
  couponCode: varchar("couponCode", { length: 64 }),
  status: mysqlEnum("status", [
    "pending", "processing", "on_hold", "completed",
    "cancelled", "refunded", "failed", "shipped", "delivered", "exchanged"
  ]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 64 }),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  paymentReference: varchar("paymentReference", { length: 256 }),
  gatewayRef: varchar("gatewayRef", { length: 256 }),      // MyFatoorah InvoiceId
  refundId: varchar("refundId", { length: 256 }),           // MyFatoorah RefundId
  refundedAt: timestamp("refundedAt"),
  refundAmount: decimal("refundAmount", { precision: 10, scale: 3 }),
  refundNote: text("refundNote"),
  shippingMethod: varchar("shippingMethod", { length: 128 }),
  trackingNumber: varchar("trackingNumber", { length: 256 }),
  invoiceKey: varchar("invoiceKey", { length: 512 }),
  channel: mysqlEnum("channel", ["online", "pos"]).default("online").notNull(),
  createdByUserId: int("createdByUserId"),
  exchangedFromOrderId: int("exchangedFromOrderId"),  // P6: self-reference for exchange workflow
  internalNotes: text("internalNotes"),  // E1: admin-only internal notes
  paidAt: timestamp("paidAt"),
  shippedAt: timestamp("shippedAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("orders_orderNumber_idx").on(t.orderNumber),
  index("orders_customerId_idx").on(t.customerId),
  index("orders_status_idx").on(t.status),
  index("orders_createdAt_idx").on(t.createdAt),
]);

// ─────────────────────────────────────────────────────────────────────────────
// ORDER ITEMS
// ─────────────────────────────────────────────────────────────────────────────
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId"),
  variantId: int("variantId"),
  wcProductId: int("wcProductId"),
  name: varchar("name", { length: 500 }).notNull(),
  sku: varchar("sku", { length: 128 }),
  image: text("image"),
  quantity: int("quantity").notNull().default(1),
  // Measurement-based quantity: e.g. 2.5 meters, 1.2 kg
  qtyValue: decimal("qtyValue", { precision: 10, scale: 3 }).default("1.000").notNull(),
  measurementType: mysqlEnum("measurementType", ["unit", "meter", "kg", "roll", "box"]).default("unit").notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 3 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 14, scale: 3 }).notNull(),
  cog: decimal("cog", { precision: 12, scale: 3 }),
  variantAttributes: json("variantAttributes").$type<Record<string, string>>(),
  isGift: boolean("isGift").default(false).notNull(),
  giftNote: varchar("giftNote", { length: 500 }),
}, (t) => [
  index("order_items_orderId_idx").on(t.orderId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// COUPONS
// ─────────────────────────────────────────────────────────────────────────────
export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  wcId: int("wcId"),
  wcSource: mysqlEnum("wcSource", ["main", "brass"]),
  code: varchar("code", { length: 128 }).notNull().unique(),
  description: text("description"),
  type: mysqlEnum("type", ["percent", "fixed_cart", "fixed_product"]).default("percent").notNull(),
  amount: decimal("amount", { precision: 10, scale: 3 }).notNull().default("0.000"),
  minimumAmount: decimal("minimumAmount", { precision: 10, scale: 3 }),
  maximumAmount: decimal("maximumAmount", { precision: 10, scale: 3 }),
  usageLimit: int("usageLimit"),
  usageCount: int("usageCount").default(0),
  usageLimitPerUser: int("usageLimitPerUser"),
  individualUse: boolean("individualUse").default(false),
  freeShipping: boolean("freeShipping").default(false),
  expiryDate: timestamp("expiryDate"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("coupons_code_idx").on(t.code),
]);

// ─────────────────────────────────────────────────────────────────────────────
// SHIPPING CLASSES
// Each class defines how much it costs to ship per item to Kuwait and GCC.
// Kuwait cost is a flat fee per order item; GCC cost is per-unit (qty multiplier).
// ─────────────────────────────────────────────────────────────────────────────
export const shippingClasses = mysqlTable("shipping_classes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  // Kuwait: flat cost per order (not per qty)
  kuwaitCost: decimal("kuwaitCost", { precision: 10, scale: 3 }).default("2.000").notNull(),
  // GCC: cost per unit (multiplied by qty at checkout)
  gccCostPerUnit: decimal("gccCostPerUnit", { precision: 10, scale: 3 }).default("0.000").notNull(),
  // Kuwait-only: if true, this class cannot be shipped to GCC
  kuwaitOnly: boolean("kuwaitOnly").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("shipping_classes_slug_idx").on(t.slug),
]);

// ─────────────────────────────────────────────────────────────────────────────
// KUWAIT CITY SURCHARGES
// Each Kuwait city can have an additional delivery surcharge on top of the base fee.
// ─────────────────────────────────────────────────────────────────────────────
export const kuwaitCitySurcharges = mysqlTable("kuwait_city_surcharges", {
  id: int("id").autoincrement().primaryKey(),
  cityName: varchar("cityName", { length: 128 }).notNull().unique(),
  cityNameAr: varchar("cityNameAr", { length: 128 }),
  surcharge: decimal("surcharge", { precision: 10, scale: 3 }).default("0.000").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// SHIPPING ZONES
// ─────────────────────────────────────────────────────────────────────────────
export const shippingZones = mysqlTable("shipping_zones", {
  id: int("id").autoincrement().primaryKey(),
  wcZoneId: int("wcZoneId"),
  name: varchar("name", { length: 128 }).notNull(),
  countries: json("countries").$type<string[]>().default([]),
  // Base shipping cost for this zone (Kuwait: 2 KWD flat per order)
  baseCost: decimal("baseCost", { precision: 10, scale: 3 }).default("0.000").notNull(),
  // Whether city-level surcharges apply (Kuwait only)
  citySurchargesEnabled: boolean("citySurchargesEnabled").default(false).notNull(),
  // Whether shipping class costs apply per item
  shippingClassCostsEnabled: boolean("shippingClassCostsEnabled").default(true).notNull(),
  // Calculation type: 'order' = one cost per order, 'class' = per item × qty
  costCalculationType: mysqlEnum("costCalculationType", ["order", "class"]).default("class").notNull(),
  methods: json("methods").$type<Array<{
    id: string;
    title: string;
    type: string;
    cost?: string;
    freeShippingMinAmount?: string;
    enabled: boolean;
  }>>().default([]),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WISHLISTS
// ─────────────────────────────────────────────────────────────────────────────
export const wishlists = mysqlTable("wishlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 128 }),
  productId: int("productId").notNull(),
  variantId: int("variantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("wishlists_userId_idx").on(t.userId),
  index("wishlists_sessionId_idx").on(t.sessionId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────
export const productTranslations = mysqlTable("product_translations", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  locale: mysqlEnum("locale", ["en", "ar"]).notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  shortDescription: text("shortDescription"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("product_translations_product_locale_unique").on(t.productId, t.locale),
  index("product_translations_productId_idx").on(t.productId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────
export const categoryTranslations = mysqlTable("category_translations", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  locale: mysqlEnum("locale", ["en", "ar"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("category_translations_cat_locale_unique").on(t.categoryId, t.locale),
  index("category_translations_categoryId_idx").on(t.categoryId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// SYNC LOG
// ─────────────────────────────────────────────────────────────────────────────
export const syncLogs = mysqlTable("sync_logs", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["main", "brass"]).notNull(),
  type: mysqlEnum("type", ["products", "categories", "orders", "customers", "coupons", "shipping_zones", "full"]).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  itemsSynced: int("itemsSynced").default(0),
  itemsFailed: int("itemsFailed").default(0),
  errorLog: json("errorLog").$type<string[]>().default([]),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  triggeredBy: int("triggeredBy"),
});

// ─────────────────────────────────────────────────────────────────────────────
// BUNDLE ITEMS
// Links a bundle product variant to its component variants.
// Stock of the bundle = min(stock of all components in the relevant warehouse).
// Purchasing a bundle deducts qty from each component variant.
// ─────────────────────────────────────────────────────────────────────────────
export const bundleItems = mysqlTable("bundle_items", {
  id: int("id").autoincrement().primaryKey(),
  bundleVariantId: int("bundleVariantId").notNull(), // FK to product_variants.id (the bundle)
  componentVariantId: int("componentVariantId").notNull(), // FK to product_variants.id (component)
  qty: decimal("qty", { precision: 10, scale: 3 }).default("1.000").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("bundle_items_bundleVariantId_idx").on(t.bundleVariantId),
  index("bundle_items_componentVariantId_idx").on(t.componentVariantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// ATTRIBUTES  (global, reusable across products — e.g. "Color", "Steel", "Set")
// ─────────────────────────────────────────────────────────────────────────────
export const attributes = mysqlTable("attributes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),          // EN system name
  nameAr: varchar("nameAr", { length: 255 }),                 // AR storefront display name
  displayType: mysqlEnum("displayType", ["button", "color", "image"]).default("button").notNull(),
  // P8: global = participates in variant generation; custom = display-only, does not generate variants
  type: mysqlEnum("type", ["global", "custom"]).default("global").notNull(),
  descriptionEn: text("descriptionEn"),
  descriptionAr: text("descriptionAr"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ATTRIBUTE VALUES  (options within an attribute)
// ─────────────────────────────────────────────────────────────────────────────
export const attributeValues = mysqlTable("attribute_values", {
  id: int("id").autoincrement().primaryKey(),
  attributeId: int("attributeId").notNull(),
  labelEn: varchar("labelEn", { length: 255 }).notNull(),
  labelAr: varchar("labelAr", { length: 255 }),
  // Swatch: hex color string for 'color' type, or image URL for 'image' type
  swatch: varchar("swatch", { length: 512 }),
  // Main image shown when this value is selected
  image: text("image"),
  // Additional gallery images
  galleryImages: json("galleryImages").$type<string[]>().default([]),
  // Pricing overrides (null = use product price)
  price: decimal("price", { precision: 12, scale: 3 }),
  salePrice: decimal("salePrice", { precision: 12, scale: 3 }),
  cog: decimal("cog", { precision: 12, scale: 3 }),
  shippingClass: varchar("shippingClass", { length: 128 }),
  shippingClassId: int("shippingClassId"),
  weight: decimal("weight", { precision: 8, scale: 3 }),
  dimL: decimal("dimL", { precision: 8, scale: 2 }),
  dimW: decimal("dimW", { precision: 8, scale: 2 }),
  dimH: decimal("dimH", { precision: 8, scale: 2 }),
  // Bundle: if true, stock is computed from linked products (attribute_value_bundle_items)
  isBundle: boolean("isBundle").default(false).notNull(),
  // Simple stock management toggle
  manageStock: boolean("manageStock").default(false).notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("attr_values_attributeId_idx").on(t.attributeId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// ATTRIBUTE VALUE BUNDLE ITEMS
// When isBundle=true, this table defines which products (and qty) make up the bundle.
// Stock = min(floor(product_online_stock / qty)) across all items.
// Order deduction: deduct qty from each linked product's online warehouse stock.
// ─────────────────────────────────────────────────────────────────────────────
export const attributeValueBundleItems = mysqlTable("attribute_value_bundle_items", {
  id: int("id").autoincrement().primaryKey(),
  attributeValueId: int("attributeValueId").notNull(),
  productId: int("productId").notNull(),
  qty: int("qty").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("avbi_attributeValueId_idx").on(t.attributeValueId),
  index("avbi_productId_idx").on(t.productId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// ATTRIBUTE VALUE STOCK  (per-warehouse stock for simple attribute values)
// Only used when attributeValues.manageStock = true and isBundle = false.
// ─────────────────────────────────────────────────────────────────────────────
export const attributeValueStock = mysqlTable("attribute_value_stock", {
  id: int("id").autoincrement().primaryKey(),
  attributeValueId: int("attributeValueId").notNull(),
  warehouseId: int("warehouseId").notNull(),
  quantity: int("quantity").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("av_stock_value_warehouse_unique").on(t.attributeValueId, t.warehouseId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT ATTRIBUTES  (assigns a global attribute to a specific product)
// ─────────────────────────────────────────────────────────────────────────────
export const productAttributes = mysqlTable("product_attributes", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  attributeId: int("attributeId").notNull(),
  // Which value IDs are active for this product (subset of all attribute values)
  activeValueIds: json("activeValueIds").$type<number[]>().default([]),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("product_attributes_product_attr_unique").on(t.productId, t.attributeId),
  index("product_attributes_productId_idx").on(t.productId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Warehouse = typeof warehouses.$inferSelect;
export type WarehouseStock = typeof warehouseStock.$inferSelect;
export type StockTransfer = typeof stockTransfers.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type ShippingClass = typeof shippingClasses.$inferSelect;
export type InsertShippingClass = typeof shippingClasses.$inferInsert;
export type KuwaitCitySurcharge = typeof kuwaitCitySurcharges.$inferSelect;
export type InsertKuwaitCitySurcharge = typeof kuwaitCitySurcharges.$inferInsert;
export type ShippingZone = typeof shippingZones.$inferSelect;
export type Wishlist = typeof wishlists.$inferSelect;
export type SyncLog = typeof syncLogs.$inferSelect;
export type StoreSettings = typeof storeSettings.$inferSelect;
export type ProductTranslation = typeof productTranslations.$inferSelect;
export type CategoryTranslation = typeof categoryTranslations.$inferSelect;
export type BundleItem = typeof bundleItems.$inferSelect;
export type InsertBundleItem = typeof bundleItems.$inferInsert;
export type Attribute = typeof attributes.$inferSelect;
export type InsertAttribute = typeof attributes.$inferInsert;
export type AttributeValue = typeof attributeValues.$inferSelect;
export type InsertAttributeValue = typeof attributeValues.$inferInsert;
export type AttributeValueBundleItem = typeof attributeValueBundleItems.$inferSelect;
export type AttributeValueStock = typeof attributeValueStock.$inferSelect;
export type ProductAttribute = typeof productAttributes.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE BUILDER
// ─────────────────────────────────────────────────────────────────────────────
export const pages = mysqlTable("pages", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }),
  isPublished: boolean("isPublished").default(true).notNull(),
  isSystem: boolean("isSystem").default(false).notNull(), // true = homepage, cannot delete
  metaTitle: varchar("metaTitle", { length: 255 }),
  metaDescription: text("metaDescription"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pageBlocks = mysqlTable("page_blocks", {
  id: int("id").autoincrement().primaryKey(),
  pageId: int("pageId").notNull().references(() => pages.id, { onDelete: "cascade" }),
  blockType: mysqlEnum("blockType", [
    "hero_slider",
    "text_html",
    "category_grid",
    "product_grid",
    "banner",
    "spacer",
    "contact_form",
    "image_gallery"
  ]).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  config: json("config").$type<Record<string, any>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("page_blocks_pageId_idx").on(t.pageId),
]);

export type Page = typeof pages.$inferSelect;
export type InsertPage = typeof pages.$inferInsert;
export type PageBlock = typeof pageBlocks.$inferSelect;
export type InsertPageBlock = typeof pageBlocks.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// KUWAIT AREA DELIVERY CHARGES
// ─────────────────────────────────────────────────────────────────────────────
export const kuwaitAreaCharges = mysqlTable("kuwait_area_charges", {
  id: int("id").autoincrement().primaryKey(),
  areaName: varchar("areaName", { length: 128 }).notNull().unique(),
  extraCharge: decimal("extraCharge", { precision: 10, scale: 3 }).default("0.000").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type KuwaitAreaCharge = typeof kuwaitAreaCharges.$inferSelect;
export type InsertKuwaitAreaCharge = typeof kuwaitAreaCharges.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// VENDORS
// ─────────────────────────────────────────────────────────────────────────────
export const vendors = mysqlTable("vendors", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  notes: text("notes"),
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("0.00"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// ORDER EXPENSES
// ─────────────────────────────────────────────────────────────────────────────
export const orderExpenses = mysqlTable("order_expenses", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 128 }).notNull(),
  description: varchar("description", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 3 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("order_expenses_orderId_idx").on(t.orderId),
]);
export type OrderExpense = typeof orderExpenses.$inferSelect;
export type InsertOrderExpense = typeof orderExpenses.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT VENDOR OWNERSHIP
// ─────────────────────────────────────────────────────────────────────────────
// Tracks which products are owned by external vendors (consignment/commission model)
export const productVendors = mysqlTable("product_vendors", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  vendorId: int("vendorId").notNull().references(() => vendors.id),
  ownershipType: mysqlEnum("ownershipType", ["own", "consignment", "commission"]).default("own").notNull(),
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("0.00"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("product_vendors_productId_idx").on(t.productId),
]);
export type ProductVendor = typeof productVendors.$inferSelect;
export type InsertProductVendor = typeof productVendors.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT CART
// ─────────────────────────────────────────────────────────────────────────────
// DB-persisted cart: survives browser close, enables abandoned cart tracking.
// A cart is identified by either userId (logged-in) or sessionId (guest).
// On login, the guest cart is merged into the user cart.
export const carts = mysqlTable("carts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("sessionId", { length: 128 }), // for guest carts
  couponCode: varchar("couponCode", { length: 64 }),
  shippingCountry: varchar("shippingCountry", { length: 4 }),
  shippingCity: varchar("shippingCity", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  expiresAt: timestamp("expiresAt"), // null = never expires (logged-in users)
}, (t) => [
  index("carts_userId_idx").on(t.userId),
  index("carts_sessionId_idx").on(t.sessionId),
]);
export type Cart = typeof carts.$inferSelect;
export type InsertCart = typeof carts.$inferInsert;

export const cartItems = mysqlTable("cart_items", {
  id: int("id").autoincrement().primaryKey(),
  cartId: int("cartId").notNull().references(() => carts.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: int("variantId").references(() => productVariants.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull().default(1),
  qtyValue: decimal("qtyValue", { precision: 10, scale: 3 }).default("1.000"),
  measurementType: mysqlEnum("measurementType", ["unit", "meter", "kg", "roll", "box"]).default("unit"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
}, (t) => [
  index("cart_items_cartId_idx").on(t.cartId),
  index("cart_items_productId_idx").on(t.productId),
]);
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

// ─── Return Requests ──────────────────────────────────────────────────────────
export const returnRequests = mysqlTable("return_requests", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  orderItemId: int("orderItemId").references(() => orderItems.id, { onDelete: "set null" }),
  requestedByUserId: int("requestedByUserId").references(() => users.id, { onDelete: "set null" }),
  reason: varchar("reason", { length: 512 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "executed"]).notNull().default("pending"),
  resolvedByUserId: int("resolvedByUserId").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolvedAt"),
  notes: varchar("notes", { length: 1024 }),
  // P66: refund amount captured at execution time
  refundAmount: decimal("refundAmount", { precision: 12, scale: 3 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("return_requests_orderId_idx").on(t.orderId),
  index("return_requests_status_idx").on(t.status),
]);
export type ReturnRequest = typeof returnRequests.$inferSelect;
export type InsertReturnRequest = typeof returnRequests.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO MODULE
// ─────────────────────────────────────────────────────────────────────────────
// portfolioCategories: e.g. '3D Design', 'Real Projects', '3D vs Real', 'Events'
// portfolioItems: individual portfolio entries linked to a category
// portfolioImages: ordered gallery images for each portfolio item
// ─────────────────────────────────────────────────────────────────────────────

export const portfolioCategories = mysqlTable('portfolio_categories', {
  id: int('id').autoincrement().primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  nameAr: varchar('nameAr', { length: 255 }),
  type: mysqlEnum('type', ['portfolio', 'events']).notNull().default('portfolio'),
  sortOrder: int('sortOrder').default(0).notNull(),
  isVisible: boolean('isVisible').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
export type PortfolioCategory = typeof portfolioCategories.$inferSelect;
export type InsertPortfolioCategory = typeof portfolioCategories.$inferInsert;

export const portfolioItems = mysqlTable('portfolio_items', {
  id: int('id').autoincrement().primaryKey(),
  categoryId: int('categoryId').notNull().references(() => portfolioCategories.id, { onDelete: 'cascade' }),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  titleAr: varchar('titleAr', { length: 255 }),
  description: text('description'),
  descriptionAr: text('descriptionAr'),
  coverImage: varchar('coverImage', { length: 1024 }),
  videoUrl: varchar('videoUrl', { length: 1024 }),
  sortOrder: int('sortOrder').default(0).notNull(),
  isVisible: boolean('isVisible').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index('portfolio_items_categoryId_idx').on(t.categoryId),
]);
export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type InsertPortfolioItem = typeof portfolioItems.$inferInsert;

export const portfolioImages = mysqlTable('portfolio_images', {
  id: int('id').autoincrement().primaryKey(),
  itemId: int('itemId').notNull().references(() => portfolioItems.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 1024 }).notNull(),
  altText: varchar('altText', { length: 255 }),
  sortOrder: int('sortOrder').default(0).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (t) => [
  index('portfolio_images_itemId_idx').on(t.itemId),
]);
export type PortfolioImage = typeof portfolioImages.$inferSelect;
export type InsertPortfolioImage = typeof portfolioImages.$inferInsert;
