/**
 * Cart Router — DB-persisted cart
 *
 * Strategy:
 * - Cart identified by userId (logged-in) or sessionId (guest)
 * - Guest carts expire after 30 days
 * - On login, guest cart is merged into user cart (merge procedure)
 * - All mutations are idempotent (upsert semantics)
 */

import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';

const cartItemInput = z.object({
  productId: z.number(),
  variantId: z.number().optional(),
  quantity: z.number().int().min(1).default(1),
  qtyValue: z.number().positive().default(1),
  measurementType: z.enum(['unit', 'meter', 'kg', 'roll', 'box']).default('unit'),
  sessionId: z.string().optional(), // required for guest carts
});

export const cartRouter = router({
  /**
   * Get the current cart (by userId or sessionId).
   * Returns items with product/variant details.
   */
  get: publicProcedure
    .input(z.object({ sessionId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const { getDb } = await import('../db');
      const { carts, cartItems, products, productVariants } = await import('../../drizzle/schema');
      const { eq, and, isNull } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return { cartId: null, items: [] };

      const userId = ctx.user?.id;
      const sessionId = input.sessionId;

      // Find existing cart
      let cart = null;
      if (userId) {
        const [c] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
        cart = c;
      } else if (sessionId) {
        const [c] = await db.select().from(carts).where(eq(carts.sessionId, sessionId)).limit(1);
        cart = c;
      }

      if (!cart) return { cartId: null, items: [] };

      const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
      if (!items.length) return { cartId: cart.id, items: [] };

      // Enrich with product/variant data
      const productIds = Array.from(new Set(items.map(i => i.productId)));
      const variantIds = Array.from(new Set(items.map(i => i.variantId).filter(Boolean) as number[]));

      const { inArray } = await import('drizzle-orm');
      const prods = productIds.length
        ? await db.select({ id: products.id, name: products.name, slug: products.slug, images: products.images, price: products.price, salePrice: products.salePrice, measurementType: products.measurementType, kuwaitOnly: products.kuwaitOnly, shippingClassId: products.shippingClassId })
            .from(products).where(inArray(products.id, productIds))
        : [];

      const variants = variantIds.length
        ? await db.select({ id: productVariants.id, name: productVariants.name, price: productVariants.price, salePrice: productVariants.salePrice, image: productVariants.image, sku: productVariants.sku })
            .from(productVariants).where(inArray(productVariants.id, variantIds))
        : [];

      const enriched = items.map(item => {
        const prod = prods.find(p => p.id === item.productId);
        const variant = item.variantId ? variants.find(v => v.id === item.variantId) : null;
        const price = parseFloat(String(variant?.salePrice || variant?.price || prod?.salePrice || prod?.price || '0'));
        return {
          id: item.id,
          cartId: item.cartId,
          productId: item.productId,
          variantId: item.variantId ?? undefined,
          quantity: item.quantity,
          qtyValue: parseFloat(String(item.qtyValue ?? 1)),
          measurementType: item.measurementType ?? 'unit',
          name: prod?.name ?? '',
          slug: prod?.slug ?? '',
          image: (variant?.image || (prod?.images as string[])?.[0] || '') as string,
          price,
          variantName: variant?.name,
          sku: variant?.sku ?? undefined,
          kuwaitOnly: prod?.kuwaitOnly ?? false,
          shippingClassId: prod?.shippingClassId ?? null,
        };
      });

      return { cartId: cart.id, items: enriched };
    }),

  /**
   * Add or update an item in the cart.
   * If item already exists (same productId + variantId), increments quantity/qtyValue.
   */
  addItem: publicProcedure
    .input(cartItemInput)
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import('../db');
      const { carts, cartItems } = await import('../../drizzle/schema');
      const { eq, and, isNull } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const userId = ctx.user?.id;
      const sessionId = input.sessionId;
      if (!userId && !sessionId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'sessionId required for guest cart' });

      // Get or create cart
      let cartId: number;
      if (userId) {
        const [existing] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
        if (existing) {
          cartId = existing.id;
        } else {
          const [ins] = await db.insert(carts).values({ userId });
          cartId = (ins as any).insertId;
        }
      } else {
        const [existing] = await db.select().from(carts).where(eq(carts.sessionId, sessionId!)).limit(1);
        if (existing) {
          cartId = existing.id;
        } else {
          const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
          const [ins] = await db.insert(carts).values({ sessionId, expiresAt: expires });
          cartId = (ins as any).insertId;
        }
      }

      // Check if item already exists
      const conditions = input.variantId
        ? and(eq(cartItems.cartId, cartId), eq(cartItems.productId, input.productId), eq(cartItems.variantId, input.variantId))
        : and(eq(cartItems.cartId, cartId), eq(cartItems.productId, input.productId), isNull(cartItems.variantId));

      const [existing] = await db.select().from(cartItems).where(conditions).limit(1);

      if (existing) {
        // Increment
        const newQty = existing.quantity + input.quantity;
        const newQtyValue = parseFloat((parseFloat(String(existing.qtyValue ?? 1)) + input.qtyValue).toFixed(3));
        await db.update(cartItems)
          .set({ quantity: newQty, qtyValue: String(newQtyValue) })
          .where(eq(cartItems.id, existing.id));
      } else {
        await db.insert(cartItems).values({
          cartId,
          productId: input.productId,
          variantId: input.variantId ?? null,
          quantity: input.quantity,
          qtyValue: String(input.qtyValue),
          measurementType: input.measurementType,
        });
      }

      return { success: true };
    }),

  /**
   * Update quantity/qtyValue of a specific cart item.
   */
  updateItem: publicProcedure
    .input(z.object({
      cartItemId: z.number(),
      quantity: z.number().int().min(1).optional(),
      qtyValue: z.number().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import('../db');
      const { cartItems } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const updates: any = {};
      if (input.quantity !== undefined) updates.quantity = input.quantity;
      if (input.qtyValue !== undefined) updates.qtyValue = String(input.qtyValue);

      await db.update(cartItems).set(updates).where(eq(cartItems.id, input.cartItemId));
      return { success: true };
    }),

  /**
   * Remove a specific item from the cart.
   */
  removeItem: publicProcedure
    .input(z.object({ cartItemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import('../db');
      const { cartItems } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await db.delete(cartItems).where(eq(cartItems.id, input.cartItemId));
      return { success: true };
    }),

  /**
   * Clear all items from the cart.
   */
  clear: publicProcedure
    .input(z.object({ sessionId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import('../db');
      const { carts, cartItems } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return { success: true };

      const userId = ctx.user?.id;
      const sessionId = input.sessionId;

      let cart = null;
      if (userId) {
        const [c] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
        cart = c;
      } else if (sessionId) {
        const [c] = await db.select().from(carts).where(eq(carts.sessionId, sessionId)).limit(1);
        cart = c;
      }

      if (cart) {
        await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      }
      return { success: true };
    }),

  /**
   * Merge guest cart into user cart on login.
   * Called after OAuth login completes with the guest sessionId.
   * Items are merged: if same productId+variantId exists, quantities are summed.
   * Guest cart is deleted after merge.
   */
  mergeOnLogin: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { getDb } = await import('../db');
      const { carts, cartItems } = await import('../../drizzle/schema');
      const { eq, and, isNull } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return { merged: 0 };

      // Find guest cart
      const [guestCart] = await db.select().from(carts).where(eq(carts.sessionId, input.sessionId)).limit(1);
      if (!guestCart) return { merged: 0 };

      const guestItems = await db.select().from(cartItems).where(eq(cartItems.cartId, guestCart.id));
      if (!guestItems.length) {
        await db.delete(carts).where(eq(carts.id, guestCart.id));
        return { merged: 0 };
      }

      // Get or create user cart
      let userCartId: number;
      const [userCart] = await db.select().from(carts).where(eq(carts.userId, ctx.user.id)).limit(1);
      if (userCart) {
        userCartId = userCart.id;
      } else {
        const [ins] = await db.insert(carts).values({ userId: ctx.user.id });
        userCartId = (ins as any).insertId;
      }

      // Merge items
      let merged = 0;
      for (const guestItem of guestItems) {
        const conditions = guestItem.variantId
          ? and(eq(cartItems.cartId, userCartId), eq(cartItems.productId, guestItem.productId), eq(cartItems.variantId, guestItem.variantId))
          : and(eq(cartItems.cartId, userCartId), eq(cartItems.productId, guestItem.productId), isNull(cartItems.variantId));

        const [existing] = await db.select().from(cartItems).where(conditions).limit(1);
        if (existing) {
          await db.update(cartItems).set({
            quantity: existing.quantity + guestItem.quantity,
            qtyValue: String(parseFloat(String(existing.qtyValue ?? 1)) + parseFloat(String(guestItem.qtyValue ?? 1))),
          }).where(eq(cartItems.id, existing.id));
        } else {
          await db.insert(cartItems).values({ ...guestItem, id: undefined as any, cartId: userCartId });
        }
        merged++;
      }

      // Delete guest cart (cascade deletes items)
      await db.delete(carts).where(eq(carts.id, guestCart.id));

      return { merged };
    }),

  /**
   * Update cart-level fields (coupon, shipping country/city).
   */
  updateMeta: publicProcedure
    .input(z.object({
      sessionId: z.string().optional(),
      couponCode: z.string().optional().nullable(),
      shippingCountry: z.string().optional().nullable(),
      shippingCity: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import('../db');
      const { carts } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return { success: true };

      const userId = ctx.user?.id;
      const sessionId = input.sessionId;

      let cart = null;
      if (userId) {
        const [c] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
        cart = c;
      } else if (sessionId) {
        const [c] = await db.select().from(carts).where(eq(carts.sessionId, sessionId)).limit(1);
        cart = c;
      }

      if (!cart) return { success: true };

      const updates: any = {};
      if (input.couponCode !== undefined) updates.couponCode = input.couponCode;
      if (input.shippingCountry !== undefined) updates.shippingCountry = input.shippingCountry;
      if (input.shippingCity !== undefined) updates.shippingCity = input.shippingCity;

      await db.update(carts).set(updates).where(eq(carts.id, cart.id));
      return { success: true };
    }),
});
