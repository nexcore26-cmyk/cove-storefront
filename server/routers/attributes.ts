import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  attributes,
  attributeValues,
  attributeValueBundleItems,
  attributeValueStock,
  productAttributes,
  productVariants,
  warehouses as warehousesTable,
  warehouseStock,
  storeSettings,
  products as productsTable,
} from "../../drizzle/schema";
import { eq, inArray, and, asc } from "drizzle-orm";

// ─── Admin procedure guard ────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
  return next({ ctx });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOnlineWarehouseId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [settings] = await db.select({ onlineWarehouseId: storeSettings.onlineWarehouseId }).from(storeSettings).limit(1);
  if (settings?.onlineWarehouseId) return settings.onlineWarehouseId;
  const [wh] = await db
    .select({ id: warehousesTable.id })
    .from(warehousesTable)
    .where(eq(warehousesTable.type, "online"))
    .limit(1);
  return wh?.id ?? null;
}

/** Compute effective stock for a bundle attribute value in a given warehouse */
async function computeBundleStock(
  attributeValueId: number,
  warehouseId: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const items = await db
    .select()
    .from(attributeValueBundleItems)
    .where(eq(attributeValueBundleItems.attributeValueId, attributeValueId));
  if (items.length === 0) return 0;
  const productIds = items.map((i) => i.productId);
  const stocks = await db
    .select({
      productId: warehouseStock.productId,
      qty: warehouseStock.quantity,
    })
    .from(warehouseStock)
    .where(
      and(
        inArray(warehouseStock.productId, productIds),
        eq(warehouseStock.warehouseId, warehouseId)
      )
    );
  const stockMap = new Map(stocks.map((s) => [s.productId, s.qty ?? 0]));
  let min = Infinity;
  for (const item of items) {
    const available = Number(stockMap.get(item.productId) ?? 0);
    const needed = item.qty;
    const can = Math.floor(available / needed);
    if (can < min) min = can;
  }
  return min === Infinity ? 0 : min;
}


function normalizeVariantValue(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeVariantAttributesPayload(attributesPayload: unknown): Record<string, string> {
  if (!attributesPayload) return {};

  if (Array.isArray(attributesPayload)) {
    const normalized: Record<string, string> = {};
    for (const entry of attributesPayload) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const key = firstDefinedString(item.name, item.attribute, item.label, item.slug);
      const value = firstDefinedString(item.option, item.value, item.labelEn, item.label);
      if (key && value) normalized[key] = value;
    }
    return normalized;
  }

  if (typeof attributesPayload === "object") {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(attributesPayload as Record<string, unknown>)) {
      if (!key || value === null || value === undefined || typeof value === "object") continue;
      normalized[key] = String(value);
    }
    return normalized;
  }

  return {};
}

function buildVariantSignature(attributesPayload: unknown): string {
  return Object.entries(normalizeVariantAttributesPayload(attributesPayload))
    .map(([key, value]) => `${normalizeVariantValue(key)}=${normalizeVariantValue(value)}`)
    .sort()
    .join("|");
}

function cartesianProduct<T>(sets: T[][]): T[][] {
  if (sets.length === 0) return [];
  return sets.reduce<T[][]>((acc, set) => {
    if (acc.length === 0) return set.map((item) => [item]);
    const next: T[][] = [];
    for (const existing of acc) {
      for (const item of set) next.push([...existing, item]);
    }
    return next;
  }, []);
}

function firstDefinedString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const s = String(value).trim();
    if (s.length > 0) return s;
  }
  return undefined;
}

function firstDefinedArray(...values: Array<unknown>): string[] {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value.filter(Boolean).map(String);
  }
  return [];
}

async function syncProductVariantsFromAttributes(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  tenantId: number,
  productId: number,
  assignments: Array<{ attributeId: number; activeValueIds: number[]; sortOrder: number; galleryControlling?: boolean; isImageMaster?: boolean; stockControlling?: boolean }>
) {
  const normalizedAssignments = assignments
    .map((assignment, index) => ({
      ...assignment,
      sortOrder: assignment.sortOrder ?? index,
      activeValueIds: Array.from(new Set((assignment.activeValueIds ?? []).map(Number).filter(Number.isFinite))),
      galleryControlling: assignment.galleryControlling === true || assignment.isImageMaster === true,
      isImageMaster: assignment.galleryControlling === true || assignment.isImageMaster === true,
      stockControlling: assignment.stockControlling === true,
    }))
    .filter((assignment) => assignment.activeValueIds.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.attributeId - b.attributeId);

  if (normalizedAssignments.length === 0) {
    return { generated: 0, created: 0, updated: 0, skipped: 0, message: "No active attribute values selected; variants were not generated." };
  }

  const attributeIds = normalizedAssignments.map((assignment) => assignment.attributeId);
  const valueIds = normalizedAssignments.flatMap((assignment) => assignment.activeValueIds);

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.tenantId, tenantId)))
    .limit(1);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

  const attrs = await db
    .select()
    .from(attributes)
    .where(and(inArray(attributes.id, attributeIds), eq(attributes.tenantId, tenantId)))
    .orderBy(asc(attributes.sortOrder), asc(attributes.id));
  const attrMap = new Map(attrs.map((attr) => [attr.id, attr]));

  const vals = await db
    .select()
    .from(attributeValues)
    .where(and(inArray(attributeValues.id, valueIds), eq(attributeValues.tenantId, tenantId)))
    .orderBy(asc(attributeValues.sortOrder), asc(attributeValues.id));
  const valueMap = new Map(vals.map((value) => [value.id, value]));

  for (const assignment of normalizedAssignments) {
    if (!attrMap.has(assignment.attributeId)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Attribute ${assignment.attributeId} does not exist.` });
    }
    for (const valueId of assignment.activeValueIds) {
      const value = valueMap.get(valueId);
      if (!value || value.attributeId !== assignment.attributeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Value ${valueId} does not belong to attribute ${assignment.attributeId}.` });
      }
      if (value.isEnabled === false) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Attribute value ${value.labelEn} is disabled.` });
      }
    }
  }

  const matrixInput = normalizedAssignments.map((assignment) => {
    const attr = attrMap.get(assignment.attributeId)!;
    return assignment.activeValueIds.map((valueId) => ({ attr, value: valueMap.get(valueId)! }));
  });
  const combinations = cartesianProduct(matrixInput);

  const generatedSignatures = new Set(combinations.map((combo) => {
    const attrsForSignature: Record<string, string> = {};
    for (const entry of combo) attrsForSignature[String(entry.attr.name)] = String(entry.value.labelEn);
    return buildVariantSignature(attrsForSignature);
  }));

  const existingVariants = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.tenantId, tenantId)));

  const bySignature = new Map<string, (typeof existingVariants)[number]>();
  const duplicateVariantIds: number[] = [];
  const sortedExistingVariants = [...existingVariants].sort((a, b) => Number(a.id) - Number(b.id));

  for (const variant of sortedExistingVariants) {
    const signature = buildVariantSignature((variant.attributes ?? {}) as Record<string, string>);
    const existingCanonical = bySignature.get(signature);

    if (!existingCanonical) {
      bySignature.set(signature, variant);
      continue;
    }

    if (generatedSignatures.has(signature)) {
      duplicateVariantIds.push(Number(variant.id));
    }
  }

  if (duplicateVariantIds.length > 0) {
    await db.delete(productVariants).where(inArray(productVariants.id, duplicateVariantIds));
  }

  const { generateSku } = await import("../db");
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const combo of combinations) {
    const attributesPayload: Record<string, string> = {};
    const optionLabels: string[] = [];
    const optionValues = combo.map((entry) => entry.value);
    const masterOptionValues = combo
      .filter((entry) => normalizedAssignments.some((assignment) => assignment.attributeId === entry.attr.id && (assignment.galleryControlling || assignment.isImageMaster)))
      .map((entry) => entry.value);
    const imageSeedValues = masterOptionValues.length > 0 ? masterOptionValues : [];

    for (const entry of combo) {
      const attrName = String(entry.attr.name);
      const label = String(entry.value.labelEn);
      attributesPayload[attrName] = label;
      optionLabels.push(label);
    }

    const signature = buildVariantSignature(attributesPayload);
    const existing = bySignature.get(signature);
    const seedImage = firstDefinedString(...imageSeedValues.map((value) => value.image), ...imageSeedValues.map((value) => value.swatch));
    const seedGallery = firstDefinedArray(...imageSeedValues.map((value) => value.galleryImages));
    const seedPrice = firstDefinedString(...optionValues.map((value) => value.price), (product as any).price, "0.000")!;
    const seedSalePrice = firstDefinedString(...optionValues.map((value) => value.salePrice), (product as any).salePrice);
    const seedCog = firstDefinedString(...optionValues.map((value) => value.cog), (product as any).cog);
    const seedWeight = firstDefinedString(...optionValues.map((value) => value.weight), (product as any).weight);
    const name = optionLabels.join(" / ").substring(0, 255) || String((product as any).name ?? "Variant");

    if (existing) {
      const updatePayload: Record<string, unknown> = {
        attributes: attributesPayload,
        name: existing.name || name,
        isActive: true,
      };
      if (!existing.image && seedImage) updatePayload.image = seedImage;
      if ((!existing.galleryImages || (Array.isArray(existing.galleryImages) && existing.galleryImages.length === 0)) && seedGallery.length > 0) updatePayload.galleryImages = seedGallery;
      if (!existing.price || String(existing.price) === "0.000") updatePayload.price = seedPrice;
      if (!existing.salePrice && seedSalePrice) updatePayload.salePrice = seedSalePrice;
      if (!existing.cog && seedCog) updatePayload.cog = seedCog;
      if (!existing.weight && seedWeight) updatePayload.weight = seedWeight;
      await db.update(productVariants).set(updatePayload as any).where(eq(productVariants.id, existing.id));
      updated++;
      continue;
    }

    const sku = await generateSku(tenantId, String((product as any).slug || productId), optionLabels);
    await db.insert(productVariants).values({
      productId,
      tenantId,
      sku,
      name,
      attributes: attributesPayload,
      price: seedPrice,
      salePrice: seedSalePrice ?? null,
      cog: seedCog ?? null,
      image: seedImage ?? null,
      galleryImages: seedGallery,
      weight: seedWeight ?? null,
      isActive: true,
      preOrderEnabled: false,
      preOrderLimit: 0,
      preOrderUsed: 0,
    } as any);
    created++;
  }

  for (const existing of sortedExistingVariants) {
    const signature = buildVariantSignature((existing.attributes ?? {}) as Record<string, string>);
    if (!generatedSignatures.has(signature)) skipped++;
  }

  return { generated: combinations.length, created, updated, skipped, deduped: duplicateVariantIds.length };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const attributesRouter = router({
  // ── List all attributes (with their values) ──────────────────────────────
  list: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const attrs = await db
      .select()
      .from(attributes)
      .where(eq(attributes.tenantId, ctx.tenantId))
      .orderBy(asc(attributes.sortOrder), asc(attributes.id));
    const attrIds = attrs.map((a) => a.id);
    if (attrIds.length === 0) return attrs.map((a) => ({ ...a, values: [] }));
    const vals = await db
      .select()
      .from(attributeValues)
      .where(and(eq(attributeValues.tenantId, ctx.tenantId), inArray(attributeValues.attributeId, attrIds)))
      .orderBy(asc(attributeValues.sortOrder), asc(attributeValues.id));
    const valMap = new Map<number, typeof vals>();
    for (const v of vals) {
      if (!valMap.has(v.attributeId)) valMap.set(v.attributeId, []);
      valMap.get(v.attributeId)!.push(v);
    }
    return attrs.map((a) => ({ ...a, values: valMap.get(a.id) ?? [] }));
  }),

  // ── Get single attribute with values ─────────────────────────────────────
  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "NOT_FOUND" });
      const [attr] = await db
        .select()
        .from(attributes)
        .where(and(eq(attributes.id, input.id), eq(attributes.tenantId, ctx.tenantId)));
      if (!attr) throw new TRPCError({ code: "NOT_FOUND" });
      const vals = await db
        .select()
        .from(attributeValues)
        .where(and(eq(attributeValues.attributeId, input.id), eq(attributeValues.tenantId, ctx.tenantId)))
        .orderBy(asc(attributeValues.sortOrder), asc(attributeValues.id));
      // Attach bundle items to each value
      const valueIds = vals.map((v) => v.id);
      const bundleItemsData =
        valueIds.length > 0
          ? await db
              .select()
              .from(attributeValueBundleItems)
              .where(inArray(attributeValueBundleItems.attributeValueId, valueIds))
          : [];
      const bundleMap = new Map<number, typeof bundleItemsData>();
      for (const bi of bundleItemsData) {
        if (!bundleMap.has(bi.attributeValueId))
          bundleMap.set(bi.attributeValueId, []);
        bundleMap.get(bi.attributeValueId)!.push(bi);
      }
      return {
        ...attr,
        values: vals.map((v) => ({
          ...v,
          bundleItems: bundleMap.get(v.id) ?? [],
        })),
      };
    }),

  // ── Create attribute ──────────────────────────────────────────────────────────────────────────
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        nameAr: z.string().optional(),
        displayType: z.enum(["button", "color", "image", "radio", "default"]).default("button"),
        // P8: global = participates in variant generation; custom = display-only
        type: z.enum(["global", "custom"]).default("global"),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(attributes).values({ ...input, tenantId: ctx.tenantId });
      return { id: (result as any).insertId };
    }),

  // ── Update attribute ──────────────────────────────────────────────────────────────────────────
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        nameAr: z.string().nullable().optional(),
        displayType: z.enum(["button", "color", "image", "radio", "default"]).optional(),
        // P8: global = participates in variant generation; custom = display-only
        type: z.enum(["global", "custom"]).optional(),
        descriptionEn: z.string().nullable().optional(),
        descriptionAr: z.string().nullable().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      // Explicitly coerce empty strings to null so clearing a field persists in DB
      const updateData: Record<string, unknown> = { ...data };
      if ("descriptionEn" in updateData) updateData.descriptionEn = updateData.descriptionEn || null;
      if ("descriptionAr" in updateData) updateData.descriptionAr = updateData.descriptionAr || null;
      if ("nameAr" in updateData) updateData.nameAr = updateData.nameAr || null;
      await db.update(attributes).set(updateData).where(and(eq(attributes.id, id), eq(attributes.tenantId, ctx.tenantId)));
      return { success: true };
    }),

  // ── Delete attribute (cascades values) ─────────────────────────────────────────────────────
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify this attribute belongs to the requesting tenant before touching anything.
      const [owned] = await db
        .select({ id: attributes.id })
        .from(attributes)
        .where(and(eq(attributes.id, input.id), eq(attributes.tenantId, ctx.tenantId)))
        .limit(1);
      if (!owned) throw new TRPCError({ code: "NOT_FOUND" });
      // Delete bundle items for all values of this attribute
      const vals = await db
        .select({ id: attributeValues.id })
        .from(attributeValues)
        .where(eq(attributeValues.attributeId, input.id));
      if (vals.length > 0) {
        const valIds = vals.map((v) => v.id);
        await db
          .delete(attributeValueBundleItems)
          .where(inArray(attributeValueBundleItems.attributeValueId, valIds));
        await db
          .delete(attributeValueStock)
          .where(inArray(attributeValueStock.attributeValueId, valIds));
        await db
          .delete(attributeValues)
          .where(inArray(attributeValues.id, valIds));
      }
      await db.delete(attributes).where(eq(attributes.id, input.id));
      return { success: true };
    }),

  // ── Create attribute value ────────────────────────────────────────────────
  createValue: adminProcedure
    .input(
      z.object({
        attributeId: z.number(),
        labelEn: z.string().min(1),
        labelAr: z.string().optional(),
        swatch: z.string().optional(),
        image: z.string().optional(),
        galleryImages: z.array(z.string()).default([]),
        price: z.string().optional(),
        salePrice: z.string().optional(),
        cog: z.string().optional(),
        shippingClass: z.string().optional(),
        shippingClassId: z.number().nullable().optional(),
        weight: z.string().optional(),
        dimL: z.string().optional(),
        dimW: z.string().optional(),
        dimH: z.string().optional(),
        isBundle: z.boolean().default(false),
        manageStock: z.boolean().default(false),
        isEnabled: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify the parent attribute belongs to this tenant before attaching a value to it.
      const [parentAttr] = await db
        .select({ id: attributes.id })
        .from(attributes)
        .where(and(eq(attributes.id, input.attributeId), eq(attributes.tenantId, ctx.tenantId)))
        .limit(1);
      if (!parentAttr) throw new TRPCError({ code: "NOT_FOUND", message: "Attribute not found" });
      const [result] = await db.insert(attributeValues).values({ ...input, tenantId: ctx.tenantId });
      return { id: (result as any).insertId };
    }),

  // ── Update attribute value ────────────────────────────────────────────────
  updateValue: adminProcedure
    .input(
      z.object({
        id: z.number(),
        labelEn: z.string().min(1).optional(),
        labelAr: z.string().optional(),
        swatch: z.string().optional(),
        image: z.string().optional(),
        galleryImages: z.array(z.string()).optional(),
        price: z.string().optional(),
        salePrice: z.string().optional(),
        cog: z.string().optional(),
        shippingClass: z.string().optional(),
        shippingClassId: z.number().nullable().optional(),
        weight: z.string().optional(),
        dimL: z.string().optional(),
        dimW: z.string().optional(),
        dimH: z.string().optional(),
        isBundle: z.boolean().optional(),
        manageStock: z.boolean().optional(),
        isEnabled: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db.update(attributeValues).set(data).where(and(eq(attributeValues.id, id), eq(attributeValues.tenantId, ctx.tenantId)));
      return { success: true };
    }),

  // ── Delete attribute value ────────────────────────────────────────────────
  deleteValue: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [owned] = await db
        .select({ id: attributeValues.id })
        .from(attributeValues)
        .where(and(eq(attributeValues.id, input.id), eq(attributeValues.tenantId, ctx.tenantId)))
        .limit(1);
      if (!owned) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .delete(attributeValueBundleItems)
        .where(eq(attributeValueBundleItems.attributeValueId, input.id));
      await db
        .delete(attributeValueStock)
        .where(eq(attributeValueStock.attributeValueId, input.id));
      await db.delete(attributeValues).where(eq(attributeValues.id, input.id));
      return { success: true };
    }),

  // ── Set bundle items for a value ──────────────────────────────────────────
  setBundleItems: adminProcedure
    .input(
      z.object({
        attributeValueId: z.number(),
        items: z.array(
          z.object({
            productId: z.number(),
            qty: z.number().min(1).default(1),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // attribute_value_bundle_items has no tenantId column of its own -
      // verify ownership through the parent attribute value instead.
      const [ownedValue] = await db
        .select({ id: attributeValues.id })
        .from(attributeValues)
        .where(and(eq(attributeValues.id, input.attributeValueId), eq(attributeValues.tenantId, ctx.tenantId)))
        .limit(1);
      if (!ownedValue) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.items.length > 0) {
        const productIds = input.items.map((item) => item.productId);
        const ownedProducts = await db
          .select({ id: productsTable.id })
          .from(productsTable)
          .where(and(inArray(productsTable.id, productIds), eq(productsTable.tenantId, ctx.tenantId)));
        if (ownedProducts.length !== new Set(productIds).size) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "One or more bundle products were not found" });
        }
      }
      await db
        .delete(attributeValueBundleItems)
        .where(
          eq(attributeValueBundleItems.attributeValueId, input.attributeValueId)
        );
      if (input.items.length > 0) {
        await db.insert(attributeValueBundleItems).values(
          input.items.map((item) => ({
            attributeValueId: input.attributeValueId,
            productId: item.productId,
            qty: item.qty,
          }))
        );
      }
      return { success: true };
    }),

  // ── Get bundle items for a value ──────────────────────────────────────────
  getBundleItems: publicProcedure
    .input(z.object({ attributeValueId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      // Verify the parent attribute value belongs to this tenant before
      // returning anything (attribute_value_bundle_items has no tenantId
      // column of its own).
      const [ownedValue] = await db
        .select({ id: attributeValues.id })
        .from(attributeValues)
        .where(and(eq(attributeValues.id, input.attributeValueId), eq(attributeValues.tenantId, ctx.tenantId)))
        .limit(1);
      if (!ownedValue) return [];
      const items = await db
        .select({
          id: attributeValueBundleItems.id,
          productId: attributeValueBundleItems.productId,
          qty: attributeValueBundleItems.qty,
          productName: productsTable.name,
          productSku: productsTable.sku,
        })
        .from(attributeValueBundleItems)
        .leftJoin(
          productsTable,
          eq(attributeValueBundleItems.productId, productsTable.id)
        )
        .where(
          eq(
            attributeValueBundleItems.attributeValueId,
            input.attributeValueId
          )
        );
      return items;
    }),

  // ── Get product attributes (for product edit page) ────────────────────────
  getProductAttributes: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const pas = await db
        .select()
        .from(productAttributes)
        .where(and(eq(productAttributes.productId, input.productId), eq(productAttributes.tenantId, ctx.tenantId)))
        .orderBy(asc(productAttributes.sortOrder));
      if (pas.length === 0) return [];
      const attrIds = pas.map((pa) => pa.attributeId);
      const attrs = await db
        .select()
        .from(attributes)
        .where(inArray(attributes.id, attrIds));
      const vals = await db
        .select()
        .from(attributeValues)
        .where(inArray(attributeValues.attributeId, attrIds))
        .orderBy(asc(attributeValues.sortOrder));
      const selectedValueIds = Array.from(new Set(pas.flatMap((pa) => (pa.activeValueIds ?? []) as number[]).map(Number).filter(Number.isFinite)));
      const selectedBundleItems = selectedValueIds.length
        ? await db
            .select({
              id: attributeValueBundleItems.id,
              attributeValueId: attributeValueBundleItems.attributeValueId,
              productId: attributeValueBundleItems.productId,
              qty: attributeValueBundleItems.qty,
              productName: productsTable.name,
              productSku: productsTable.sku,
            })
            .from(attributeValueBundleItems)
            .leftJoin(productsTable, eq(productsTable.id, attributeValueBundleItems.productId))
            .where(inArray(attributeValueBundleItems.attributeValueId, selectedValueIds))
        : [];
      const bundleItemsByValueId = selectedBundleItems.reduce((map, item) => {
        const key = item.attributeValueId;
        if (!map[key]) map[key] = [];
        map[key].push(item);
        return map;
      }, {} as Record<number, any[]>);
      const attrMap = new Map(attrs.map((a) => [a.id, a]));
      const valsByAttr = new Map<number, any[]>();
      for (const v of vals) {
        if (!valsByAttr.has(v.attributeId)) valsByAttr.set(v.attributeId, []);
        valsByAttr.get(v.attributeId)!.push({ ...v, bundleItems: bundleItemsByValueId[v.id] ?? [] });
      }
      return pas.map((pa) => ({
        ...pa,
        attribute: attrMap.get(pa.attributeId),
        allValues: valsByAttr.get(pa.attributeId) ?? [],
      }));
    }),

  // ── Set product attributes ────────────────────────────────────────────────
  setProductAttributes: adminProcedure
    .input(
      z.object({
        productId: z.number(),
        assignments: z.array(
          z.object({
            attributeId: z.number(),
            activeValueIds: z.array(z.number()),
            sortOrder: z.number().default(0),
            galleryControlling: z.boolean().optional().default(false),
            isImageMaster: z.boolean().optional().default(false),
            stockControlling: z.boolean().optional().default(false),
          })
        ),
        syncVariants: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [ownedProduct] = await db
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(and(eq(productsTable.id, input.productId), eq(productsTable.tenantId, ctx.tenantId)))
        .limit(1);
      if (!ownedProduct) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      const normalizedAssignments = input.assignments.map((a, index) => ({
        attributeId: a.attributeId,
        activeValueIds: Array.from(new Set((a.activeValueIds ?? []).map(Number).filter(Number.isFinite))),
        sortOrder: a.sortOrder ?? index,
        galleryControlling: a.galleryControlling === true || a.isImageMaster === true,
        isImageMaster: a.galleryControlling === true || a.isImageMaster === true,
        stockControlling: a.stockControlling === true,
      }));

      // Validate selected active values before replacing assignments.
      const selectedValueIds = normalizedAssignments.flatMap((a) => a.activeValueIds);
      if (selectedValueIds.length > 0) {
        const selectedValues = await db
          .select({ id: attributeValues.id, attributeId: attributeValues.attributeId, isEnabled: attributeValues.isEnabled })
          .from(attributeValues)
          .where(and(inArray(attributeValues.id, selectedValueIds), eq(attributeValues.tenantId, ctx.tenantId)));
        const selectedById = new Map(selectedValues.map((v) => [v.id, v]));
        for (const assignment of normalizedAssignments) {
          for (const valueId of assignment.activeValueIds) {
            const value = selectedById.get(valueId);
            if (!value || value.attributeId !== assignment.attributeId) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `Value ${valueId} does not belong to attribute ${assignment.attributeId}.` });
            }
            if (value.isEnabled === false) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `Value ${valueId} is disabled.` });
            }
          }
        }
      }

      const requestedMasterIds = normalizedAssignments.filter((a) => a.galleryControlling || a.isImageMaster).map((a) => a.attributeId);
      if (requestedMasterIds.length > 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only one attribute can be the product image master." });
      }
      const requestedStockControllerIds = normalizedAssignments.filter((a) => a.stockControlling).map((a) => a.attributeId);
      if (requestedStockControllerIds.length > 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only one attribute can control stock quantity for this product." });
      }

      // Replace assignment rows for this product.
      await db
        .delete(productAttributes)
        .where(and(eq(productAttributes.productId, input.productId), eq(productAttributes.tenantId, ctx.tenantId)));
      if (normalizedAssignments.length > 0) {
        await db.insert(productAttributes).values(
          normalizedAssignments.map((a) => ({
            productId: input.productId,
            tenantId: ctx.tenantId,
            attributeId: a.attributeId,
            activeValueIds: a.activeValueIds,
            galleryControlling: a.galleryControlling,
            isImageMaster: a.galleryControlling,
            stockControlling: a.stockControlling,
            sortOrder: a.sortOrder,
          }))
        );
      }

      const variantSync = input.syncVariants
        ? await syncProductVariantsFromAttributes(db, ctx.tenantId, input.productId, normalizedAssignments)
        : null;
      return { success: true, variantSync };
    }),

  // ── Get stock for attribute values (for storefront) ───────────────────────
  // Returns stock info per value: { valueId, onlineQty, posQty, isBundle }
  getValueStock: publicProcedure
    .input(z.object({ valueIds: z.array(z.number()) }))
    .query(async ({ input, ctx }) => {
      if (input.valueIds.length === 0) return [];
      const db = await getDb();
      if (!db) return [];

      // Get all warehouses belonging to this tenant
      const allWarehouses = await db.select().from(warehousesTable).where(eq(warehousesTable.tenantId, ctx.tenantId));
      const onlineWh = allWarehouses.find((w) => String(w.type).toLowerCase() === "online");
      const shopWarehouses = allWarehouses.filter((w) => ["pos", "shop", "store"].includes(String(w.type).toLowerCase()));

      // Get the values to know which are bundles (only this tenant's values -
      // any requested id belonging to another tenant is silently dropped)
      const vals = await db
        .select()
        .from(attributeValues)
        .where(and(inArray(attributeValues.id, input.valueIds), eq(attributeValues.tenantId, ctx.tenantId)));

      const result: Array<{
        valueId: number;
        onlineQty: number;
        posQty: number;
        isBundle: boolean;
        manageStock: boolean;
        stocks: Array<{ warehouseId: number; quantity: number }>;
      }> = [];

      for (const val of vals) {
        const stocks = await db
          .select()
          .from(attributeValueStock)
          .where(and(eq(attributeValueStock.attributeValueId, val.id), eq(attributeValueStock.tenantId, ctx.tenantId)));
        const stockRows = stocks.map((s) => ({ warehouseId: s.warehouseId, quantity: s.quantity }));

        if (val.isBundle) {
          const onlineQty = onlineWh
            ? await computeBundleStock(val.id, onlineWh.id)
            : 0;
          const shopQuantities = await Promise.all(shopWarehouses.map((warehouse) => computeBundleStock(val.id, warehouse.id)));
          const posQty = shopQuantities.reduce((sum, qty) => sum + qty, 0);
          result.push({ valueId: val.id, onlineQty, posQty, isBundle: true, manageStock: true, stocks: stockRows });
        } else if (val.manageStock) {
          // Simple stock from attribute_value_stock
          const onlineQty =
            stocks.find((s) => s.warehouseId === onlineWh?.id)?.quantity ?? 0;
          const shopWarehouseIds = new Set(shopWarehouses.map((warehouse) => warehouse.id));
          const posQty = stocks
            .filter((s) => shopWarehouseIds.has(s.warehouseId))
            .reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);
          result.push({ valueId: val.id, onlineQty, posQty, isBundle: false, manageStock: true, stocks: stockRows });
        } else {
          // No stock management — legacy behavior is always available, but expose
          // manageStock=false so configurable image swatches can require a real quantity.
          result.push({
            valueId: val.id,
            onlineQty: 999,
            posQty: 999,
            isBundle: false,
            manageStock: false,
            stocks: stockRows,
          });
        }
      }
      return result;
    }),

  // ── Admin: update simple attribute value stock ────────────────────────────
  updateValueStock: adminProcedure
    .input(
      z.object({
        attributeValueId: z.number(),
        warehouseId: z.number(),
        quantity: z.number().min(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [ownedValue] = await db
        .select({ id: attributeValues.id })
        .from(attributeValues)
        .where(and(eq(attributeValues.id, input.attributeValueId), eq(attributeValues.tenantId, ctx.tenantId)))
        .limit(1);
      if (!ownedValue) throw new TRPCError({ code: "NOT_FOUND" });
      const [ownedWarehouse] = await db
        .select({ id: warehousesTable.id })
        .from(warehousesTable)
        .where(and(eq(warehousesTable.id, input.warehouseId), eq(warehousesTable.tenantId, ctx.tenantId)))
        .limit(1);
      if (!ownedWarehouse) throw new TRPCError({ code: "NOT_FOUND", message: "Warehouse not found" });
      await db
        .update(attributeValues)
        .set({ manageStock: true })
        .where(eq(attributeValues.id, input.attributeValueId));
      // Upsert
      const existing = await db
        .select()
        .from(attributeValueStock)
        .where(
          and(
            eq(attributeValueStock.attributeValueId, input.attributeValueId),
            eq(attributeValueStock.warehouseId, input.warehouseId)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(attributeValueStock)
          .set({ quantity: input.quantity })
          .where(
            and(
              eq(
                attributeValueStock.attributeValueId,
                input.attributeValueId
              ),
              eq(attributeValueStock.warehouseId, input.warehouseId)
            )
          );
      } else {
        await db.insert(attributeValueStock).values({
          attributeValueId: input.attributeValueId,
          tenantId: ctx.tenantId,
          warehouseId: input.warehouseId,
          quantity: input.quantity,
        });
      }
      return { success: true };
    }),
});
