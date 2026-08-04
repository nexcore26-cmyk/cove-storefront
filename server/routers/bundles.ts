/**
 * Bundles Router — Phase 21
 *
 * A "bundle" product variant is composed of one or more component variants from
 * other products. The effective stock of a bundle variant is the minimum stock
 * of all its component variants in the target warehouse.
 *
 * Procedures:
 *   bundles.getItems(bundleVariantId)        — list component variants with product info
 *   bundles.setItems(bundleVariantId, items) — admin: replace all bundle items
 *   bundles.checkStock(bundleVariantId, warehouseId) — return min stock across components
 *   bundles.searchVariants(query)            — admin typeahead: search variants by product/variant name
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

export const bundlesRouter = router({
  /**
   * List all component variants for a given bundle variant.
   * Returns each component with product name, variant name, attributes, image, and qty.
   */
  getItems: publicProcedure
    .input(z.object({ bundleVariantId: z.number() }))
    .query(async ({ input, ctx }) => {
      const { bundleItems, productVariants, products } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];

      // bundle_items has no tenantId column of its own - scoped via the
      // component variant's tenantId (already joined for display fields).
      const rows = await db
        .select({
          id: bundleItems.id,
          bundleVariantId: bundleItems.bundleVariantId,
          componentVariantId: bundleItems.componentVariantId,
          componentProductId: bundleItems.componentProductId,
          stockSourceType: bundleItems.stockSourceType,
          qty: bundleItems.qty,
          // Component variant fields
          variantName: productVariants.name,
          variantSku: productVariants.sku,
          variantImage: productVariants.image,
          variantAttributes: productVariants.attributes,
          variantPrice: productVariants.price,
          variantProductId: productVariants.productId,
          // Component product fields
          productName: products.name,
          productSlug: products.slug,
        })
        .from(bundleItems)
        .innerJoin(productVariants, eq(productVariants.id, bundleItems.componentVariantId))
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(and(eq(bundleItems.bundleVariantId, input.bundleVariantId), eq(productVariants.tenantId, ctx.tenantId)))
        .orderBy(bundleItems.id);

      return rows;
    }),

  /**
   * Admin: replace all bundle items for a variant.
   * Deletes existing items then inserts new ones in a single transaction.
   */
  setItems: adminProcedure
    .input(
      z.object({
        bundleVariantId: z.number(),
        items: z.array(
          z.object({
            componentVariantId: z.number().nullable().optional(),
            componentProductId: z.number().nullable().optional(),
            stockSourceType: z.enum(["variant", "product"]).default("variant"),
            qty: z.number().min(0.001).default(1),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { bundleItems, productVariants } = await import("../../drizzle/schema");
      const { eq, and, inArray } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [ownedBundle] = await db.select({ id: productVariants.id }).from(productVariants).where(and(eq(productVariants.id, input.bundleVariantId), eq(productVariants.tenantId, ctx.tenantId))).limit(1);
      if (!ownedBundle) throw new TRPCError({ code: "NOT_FOUND", message: "Bundle variant not found" });

      const componentVariantIds = input.items.map((item) => item.componentVariantId).filter((id): id is number => id != null);
      if (componentVariantIds.length > 0) {
        const ownedComponents = await db.select({ id: productVariants.id }).from(productVariants).where(and(inArray(productVariants.id, componentVariantIds), eq(productVariants.tenantId, ctx.tenantId)));
        if (ownedComponents.length !== new Set(componentVariantIds).size) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "One or more component variants were not found" });
        }
      }

      // Delete all existing bundle items for this variant
      await db.delete(bundleItems).where(eq(bundleItems.bundleVariantId, input.bundleVariantId));

      // Insert new items (skip if empty)
      if (input.items.length > 0) {
        await db.insert(bundleItems).values(
          input.items.map((item) => ({
            bundleVariantId: input.bundleVariantId,
            componentVariantId: item.componentVariantId,
            qty: String(item.qty),
          }))
        );
      }

      return { success: true, count: input.items.length };
    }),

  /**
   * Return the effective stock of a bundle variant in a given warehouse.
   * Effective stock = min(component variant stock × (1/qty)) across all components.
   * If no components are defined, returns null (no bundle items configured).
   * If any component has 0 stock, returns 0 (bundle is out of stock).
   */
  checkStock: publicProcedure
    .input(
      z.object({
        bundleVariantId: z.number(),
        warehouseId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { bundleItems, warehouseStock, productVariants } = await import("../../drizzle/schema");
      const { eq, and, isNull } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { effectiveStock: null, components: [] };

      const [ownedBundle] = await db.select({ id: productVariants.id }).from(productVariants).where(and(eq(productVariants.id, input.bundleVariantId), eq(productVariants.tenantId, ctx.tenantId))).limit(1);
      if (!ownedBundle) return { effectiveStock: null, components: [] };

      // Get all bundle items for this variant
      const items = await db
        .select()
        .from(bundleItems)
        .where(eq(bundleItems.bundleVariantId, input.bundleVariantId));

      if (items.length === 0) return { effectiveStock: null, components: [] };

      // For each component, get its stock in the target warehouse
      const componentStocks: Array<{
        componentVariantId: number;
        qty: number;
        stock: number;
        availableUnits: number; // floor(stock / qty)
      }> = [];

      for (const item of items) {
        const qty = parseFloat(String(item.qty));
        // Try variant-level stock first, fall back to product-level stock
        const stockRows = await db
          .select()
          .from(warehouseStock)
          .where(
            and(
              eq(warehouseStock.warehouseId, input.warehouseId),
              eq(warehouseStock.variantId, item.componentVariantId)
            )
          )
          .limit(1);

        let stock = 0;
        if (stockRows.length > 0) {
          stock = stockRows[0].quantity || 0;
        }

        const availableUnits = qty > 0 ? Math.floor(stock / qty) : 0;
        componentStocks.push({
          componentVariantId: item.componentVariantId,
          qty,
          stock,
          availableUnits,
        });
      }

      // Effective stock = min of all component available units
      const effectiveStock = Math.min(...componentStocks.map((c) => c.availableUnits));

      return { effectiveStock, components: componentStocks };
    }),

  /**
   * Admin typeahead: search product-level and variant-level stock sources.
   * Simple/product-level sources return stockSourceType='product'; managed variations return stockSourceType='variant'.
   */
  searchVariants: adminProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];

      const raw = input.query.trim();
      const q = `%${raw}%`;
      const numericId = Number(raw);
      const hasNumericId = Number.isFinite(numericId) && raw !== '';
      const tenantId = ctx.tenantId;

      const [productRowsRaw] = await db.execute(sql`
        SELECT
          'product' AS stockSourceType,
          p.id AS componentProductId,
          NULL AS componentVariantId,
          p.id AS productId,
          p.name AS productName,
          p.sku AS productSku,
          p.slug AS productSlug,
          NULL AS variantName,
          NULL AS variantSku,
          NULL AS variantImage,
          COALESCE((
            SELECT ws.quantity - COALESCE(ws.reservedQty, 0)
            FROM warehouse_stock ws
            JOIN warehouses w ON w.id = ws.warehouseId
            WHERE ws.productId = p.id AND ws.variantId IS NULL AND w.type = 'online'
            LIMIT 1
          ), 0) AS onlineStock,
          COALESCE((
            SELECT ws.quantity - COALESCE(ws.reservedQty, 0)
            FROM warehouse_stock ws
            JOIN warehouses w ON w.id = ws.warehouseId
            WHERE ws.productId = p.id AND ws.variantId IS NULL AND (w.type = 'pos' OR w.name LIKE '%POS%' OR w.name LIKE '%Brass%')
            LIMIT 1
          ), 0) AS posStock
        FROM products p
        WHERE
          p.tenantId = ${tenantId}
          AND p.status <> 'archived'
          AND (p.name LIKE ${q} OR p.sku LIKE ${q} OR (${hasNumericId} AND p.id = ${hasNumericId ? numericId : 0}))
          AND EXISTS (
            SELECT 1 FROM warehouse_stock ws
            WHERE ws.productId = p.id AND ws.variantId IS NULL
          )
        ORDER BY p.name ASC
        LIMIT 20
      `) as any;

      const [variantRowsRaw] = await db.execute(sql`
        SELECT
          'variant' AS stockSourceType,
          p.id AS componentProductId,
          pv.id AS componentVariantId,
          p.id AS productId,
          p.name AS productName,
          p.sku AS productSku,
          p.slug AS productSlug,
          pv.name AS variantName,
          pv.sku AS variantSku,
          pv.image AS variantImage,
          COALESCE((
            SELECT ws.quantity - COALESCE(ws.reservedQty, 0)
            FROM warehouse_stock ws
            JOIN warehouses w ON w.id = ws.warehouseId
            WHERE ws.variantId = pv.id AND w.type = 'online'
            LIMIT 1
          ), 0) AS onlineStock,
          COALESCE((
            SELECT ws.quantity - COALESCE(ws.reservedQty, 0)
            FROM warehouse_stock ws
            JOIN warehouses w ON w.id = ws.warehouseId
            WHERE ws.variantId = pv.id AND (w.type = 'pos' OR w.name LIKE '%POS%' OR w.name LIKE '%Brass%')
            LIMIT 1
          ), 0) AS posStock
        FROM product_variants pv
        INNER JOIN products p ON p.id = pv.productId
        WHERE
          pv.tenantId = ${tenantId}
          AND p.status <> 'archived'
          AND (p.name LIKE ${q} OR p.sku LIKE ${q} OR pv.name LIKE ${q} OR pv.sku LIKE ${q} OR (${hasNumericId} AND (p.id = ${hasNumericId ? numericId : 0} OR pv.id = ${hasNumericId ? numericId : 0})))
          AND pv.manageStock = 1
        ORDER BY p.name ASC, pv.name ASC
        LIMIT 20
      `) as any;

      const productRows = Array.isArray(productRowsRaw) ? productRowsRaw : [];
      const variantRows = Array.isArray(variantRowsRaw) ? variantRowsRaw : [];
      return [...productRows, ...variantRows].slice(0, 30).map((row: any) => ({
        ...row,
        componentProductId: row.componentProductId == null ? null : Number(row.componentProductId),
        componentVariantId: row.componentVariantId == null ? null : Number(row.componentVariantId),
        productId: row.productId == null ? null : Number(row.productId),
        onlineStock: Number(row.onlineStock ?? 0),
        posStock: Number(row.posStock ?? 0),
      }));
    }),

  /**
   * Get all products of type='bundle' with their variants.
   * Used by the AdminBundles page to list all bundle products.
   */
  listBundleProducts: adminProcedure.query(async ({ ctx }) => {
    const { products, productVariants } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];

    const bundleProducts = await db
      .select()
      .from(products)
      .where(and(eq(products.type, "bundle"), eq(products.tenantId, ctx.tenantId)));

    // Fetch variants for each bundle product
    const result = await Promise.all(
      bundleProducts.map(async (product) => {
        const variants = await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.productId, product.id));
        return { ...product, variants };
      })
    );

    return result;
  }),
});
