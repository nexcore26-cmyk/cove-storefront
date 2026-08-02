/**
 * Portfolio Router
 *
 * Manages portfolio categories, items, and gallery images.
 * Used for Company Portfolio (/cp/), Events (/events/), and detail pages (/portfolio/[slug]).
 *
 * Public procedures: listCategories, listItems, getItem, listImages
 * Admin procedures: createCategory, updateCategory, deleteCategory,
 *                   createItem, updateItem, deleteItem,
 *                   addImage, deleteImage, reorderImages, adminListItems
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { getDb } from '../db';

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  return next({ ctx });
});

function toSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const portfolioRouter = router({

  // ── Categories ─────────────────────────────────────────────────────────────

  listCategories: publicProcedure
    .input(z.object({ type: z.enum(['portfolio', 'events', 'all']).default('all') }))
    .query(async ({ input }) => {
      const { portfolioCategories } = await import('../../drizzle/schema');
      const { asc, eq } = await import('drizzle-orm');
      const db = await getDb();
      const query = db.select().from(portfolioCategories).orderBy(asc(portfolioCategories.sortOrder), asc(portfolioCategories.id));
      if (input.type !== 'all') {
        return query.where(eq(portfolioCategories.type, input.type as 'portfolio' | 'events'));
      }
      return query;
    }),

  createCategory: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      nameAr: z.string().optional(),
      type: z.enum(['portfolio', 'events']).default('portfolio'),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const { portfolioCategories } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      const slug = toSlug(input.name) + '-' + Date.now();
      await db.insert(portfolioCategories).values({
        slug,
        name: input.name,
        nameAr: input.nameAr ?? null,
        type: input.type,
        sortOrder: input.sortOrder,
        isVisible: true,
      });
      const [created] = await db.select().from(portfolioCategories).where(eq(portfolioCategories.slug, slug));
      return created;
    }),

  updateCategory: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      nameAr: z.string().optional(),
      type: z.enum(['portfolio', 'events']).optional(),
      sortOrder: z.number().optional(),
      isVisible: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { portfolioCategories } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      const { id, ...rest } = input;
      await db.update(portfolioCategories).set(rest).where(eq(portfolioCategories.id, id));
      const [updated] = await db.select().from(portfolioCategories).where(eq(portfolioCategories.id, id));
      return updated;
    }),

  deleteCategory: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { portfolioCategories } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      await db.delete(portfolioCategories).where(eq(portfolioCategories.id, input.id));
      return { success: true };
    }),

  // ── Items ──────────────────────────────────────────────────────────────────

  listItems: publicProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      categorySlug: z.string().optional(),
      visibleOnly: z.boolean().default(true),
    }))
    .query(async ({ input }) => {
      const { portfolioCategories, portfolioItems } = await import('../../drizzle/schema');
      const { asc, eq, and } = await import('drizzle-orm');
      const db = await getDb();

      let catId = input.categoryId;
      if (!catId && input.categorySlug) {
        const [cat] = await db.select().from(portfolioCategories).where(eq(portfolioCategories.slug, input.categorySlug));
        if (!cat) return [];
        catId = cat.id;
      }

      const conditions: any[] = [];
      if (catId) conditions.push(eq(portfolioItems.categoryId, catId));
      if (input.visibleOnly) conditions.push(eq(portfolioItems.isVisible, true));

      return db
        .select()
        .from(portfolioItems)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(portfolioItems.sortOrder), asc(portfolioItems.id));
    }),

  getItem: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const { portfolioCategories, portfolioItems, portfolioImages } = await import('../../drizzle/schema');
      const { eq, asc } = await import('drizzle-orm');
      const db = await getDb();

      const [item] = await db.select().from(portfolioItems).where(eq(portfolioItems.slug, input.slug));
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });

      const [category] = await db.select().from(portfolioCategories).where(eq(portfolioCategories.id, item.categoryId));
      const images = await db.select().from(portfolioImages).where(eq(portfolioImages.itemId, item.id)).orderBy(asc(portfolioImages.sortOrder), asc(portfolioImages.id));

      return { ...item, category: category ?? null, images };
    }),

  adminListItems: adminProcedure
    .input(z.object({ categoryId: z.number().optional() }))
    .query(async ({ input }) => {
      const { portfolioItems } = await import('../../drizzle/schema');
      const { asc, eq, and } = await import('drizzle-orm');
      const db = await getDb();
      const conditions: any[] = [];
      if (input.categoryId) conditions.push(eq(portfolioItems.categoryId, input.categoryId));
      return db
        .select()
        .from(portfolioItems)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(portfolioItems.sortOrder), asc(portfolioItems.id));
    }),

  createItem: adminProcedure
    .input(z.object({
      categoryId: z.number(),
      title: z.string().min(1),
      titleAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      coverImage: z.string().optional(),
      videoUrl: z.string().optional(),
      sortOrder: z.number().default(0),
      images: z.array(z.object({
        url: z.string(),
        altText: z.string().optional(),
        sortOrder: z.number().default(0),
      })).default([]),
    }))
    .mutation(async ({ input }) => {
      const { portfolioItems, portfolioImages } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      const { images, ...itemData } = input;
      const slug = toSlug(input.title) + '-' + Date.now();
      await db.insert(portfolioItems).values({ ...itemData, slug, isVisible: true });
      const [created] = await db.select().from(portfolioItems).where(eq(portfolioItems.slug, slug));
      if (images.length > 0) {
        await db.insert(portfolioImages).values(images.map(img => ({ ...img, itemId: created.id })));
      }
      return created;
    }),

  updateItem: adminProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      titleAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      coverImage: z.string().optional(),
      videoUrl: z.string().optional(),
      sortOrder: z.number().optional(),
      isVisible: z.boolean().optional(),
      categoryId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { portfolioItems } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      const { id, ...rest } = input;
      await db.update(portfolioItems).set(rest).where(eq(portfolioItems.id, id));
      const [updated] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id));
      return updated;
    }),

  deleteItem: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { portfolioItems } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      await db.delete(portfolioItems).where(eq(portfolioItems.id, input.id));
      return { success: true };
    }),

  // ── Images ─────────────────────────────────────────────────────────────────

  listImages: publicProcedure
    .input(z.object({ itemId: z.number() }))
    .query(async ({ input }) => {
      const { portfolioImages } = await import('../../drizzle/schema');
      const { eq, asc } = await import('drizzle-orm');
      const db = await getDb();
      return db.select().from(portfolioImages).where(eq(portfolioImages.itemId, input.itemId)).orderBy(asc(portfolioImages.sortOrder), asc(portfolioImages.id));
    }),

  addImage: adminProcedure
    .input(z.object({
      itemId: z.number(),
      url: z.string().min(1),
      altText: z.string().optional(),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const { portfolioImages } = await import('../../drizzle/schema');
      const db = await getDb();
      await db.insert(portfolioImages).values(input);
      return { success: true };
    }),

  deleteImage: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { portfolioImages } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      await db.delete(portfolioImages).where(eq(portfolioImages.id, input.id));
      return { success: true };
    }),

  reorderImages: adminProcedure
    .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
    .mutation(async ({ input }) => {
      const { portfolioImages } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      for (const { id, sortOrder } of input) {
        await db.update(portfolioImages).set({ sortOrder }).where(eq(portfolioImages.id, id));
      }
      return { success: true };
    }),
});
