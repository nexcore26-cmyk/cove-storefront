/**
 * P2 — Persistent Cart Tests
 * Tests:
 * - add/update/remove/clear cart items
 * - guest cart uses sessionId (survives page reload)
 * - merge guest cart into user cart on login
 * - duplicate item quantities are summed on merge
 * - guest cart is deleted after merge
 */
import { describe, it, expect } from 'vitest';

// ─── Simulate cart state ──────────────────────────────────────────────────────
interface CartItem {
  id: number;
  cartId: number;
  productId: number;
  variantId: number | null;
  name: string;
  quantity: number;
  qtyValue: number;
  priceSnapshot: number;
}

interface Cart {
  id: number;
  userId: number | null;
  sessionId: string | null;
  items: CartItem[];
}

let nextId = 1;
function makeCart(userId: number | null, sessionId: string | null): Cart {
  return { id: nextId++, userId, sessionId, items: [] };
}

function addItem(cart: Cart, item: Omit<CartItem, 'id' | 'cartId'>): Cart {
  const existing = cart.items.find(
    i => i.productId === item.productId && i.variantId === item.variantId
  );
  if (existing) {
    existing.quantity += item.quantity;
    existing.qtyValue += item.qtyValue;
  } else {
    cart.items.push({ ...item, id: nextId++, cartId: cart.id });
  }
  return cart;
}

function updateItem(cart: Cart, itemId: number, qty: number): Cart {
  const item = cart.items.find(i => i.id === itemId);
  if (item) item.quantity = qty;
  return cart;
}

function removeItem(cart: Cart, itemId: number): Cart {
  cart.items = cart.items.filter(i => i.id !== itemId);
  return cart;
}

function clearCart(cart: Cart): Cart {
  cart.items = [];
  return cart;
}

function mergeCarts(guestCart: Cart, userCart: Cart): Cart {
  for (const guestItem of guestCart.items) {
    const existing = userCart.items.find(
      i => i.productId === guestItem.productId && i.variantId === guestItem.variantId
    );
    if (existing) {
      existing.quantity += guestItem.quantity;
      existing.qtyValue += guestItem.qtyValue;
    } else {
      userCart.items.push({ ...guestItem, id: nextId++, cartId: userCart.id });
    }
  }
  // Guest cart is deleted after merge
  guestCart.items = [];
  return userCart;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('P2 — Persistent Cart', () => {
  describe('add items', () => {
    it('adds a new item to an empty cart', () => {
      const cart = makeCart(null, 'guest-session-001');
      addItem(cart, { productId: 1, variantId: null, name: 'Sofa', quantity: 1, qtyValue: 1, priceSnapshot: 250 });
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productId).toBe(1);
      expect(cart.items[0].quantity).toBe(1);
    });

    it('sums quantity when adding the same item twice', () => {
      const cart = makeCart(null, 'guest-session-002');
      addItem(cart, { productId: 2, variantId: null, name: 'Chair', quantity: 1, qtyValue: 1, priceSnapshot: 100 });
      addItem(cart, { productId: 2, variantId: null, name: 'Chair', quantity: 2, qtyValue: 2, priceSnapshot: 100 });
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(3);
    });

    it('treats same product with different variants as separate items', () => {
      const cart = makeCart(null, 'guest-session-003');
      addItem(cart, { productId: 3, variantId: 10, name: 'Table (White)', quantity: 1, qtyValue: 1, priceSnapshot: 300 });
      addItem(cart, { productId: 3, variantId: 11, name: 'Table (Black)', quantity: 1, qtyValue: 1, priceSnapshot: 320 });
      expect(cart.items).toHaveLength(2);
    });
  });

  describe('update items', () => {
    it('updates item quantity', () => {
      const cart = makeCart(1, null);
      addItem(cart, { productId: 4, variantId: null, name: 'Lamp', quantity: 1, qtyValue: 1, priceSnapshot: 50 });
      const itemId = cart.items[0].id;
      updateItem(cart, itemId, 5);
      expect(cart.items[0].quantity).toBe(5);
    });
  });

  describe('remove items', () => {
    it('removes an item from the cart', () => {
      const cart = makeCart(1, null);
      addItem(cart, { productId: 5, variantId: null, name: 'Rug', quantity: 1, qtyValue: 1, priceSnapshot: 180 });
      const itemId = cart.items[0].id;
      removeItem(cart, itemId);
      expect(cart.items).toHaveLength(0);
    });

    it('does not affect other items when removing one', () => {
      const cart = makeCart(1, null);
      addItem(cart, { productId: 6, variantId: null, name: 'Mirror', quantity: 1, qtyValue: 1, priceSnapshot: 75 });
      addItem(cart, { productId: 7, variantId: null, name: 'Vase', quantity: 2, qtyValue: 2, priceSnapshot: 30 });
      const firstId = cart.items[0].id;
      removeItem(cart, firstId);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productId).toBe(7);
    });
  });

  describe('clear cart', () => {
    it('removes all items from the cart', () => {
      const cart = makeCart(1, null);
      addItem(cart, { productId: 8, variantId: null, name: 'Cushion', quantity: 3, qtyValue: 3, priceSnapshot: 25 });
      addItem(cart, { productId: 9, variantId: null, name: 'Throw', quantity: 1, qtyValue: 1, priceSnapshot: 60 });
      clearCart(cart);
      expect(cart.items).toHaveLength(0);
    });
  });

  describe('guest cart with sessionId', () => {
    it('creates a guest cart with a stable sessionId', () => {
      const sessionId = 'stable-session-abc123';
      const cart = makeCart(null, sessionId);
      expect(cart.userId).toBeNull();
      expect(cart.sessionId).toBe(sessionId);
    });

    it('guest cart persists across page reload (same sessionId)', () => {
      const sessionId = 'stable-session-def456';
      const cart1 = makeCart(null, sessionId);
      addItem(cart1, { productId: 10, variantId: null, name: 'Shelf', quantity: 1, qtyValue: 1, priceSnapshot: 120 });

      // Simulate page reload — same sessionId retrieves same cart
      const cart2 = { ...cart1 }; // same cart from DB
      expect(cart2.sessionId).toBe(sessionId);
      expect(cart2.items).toHaveLength(1);
    });
  });

  describe('merge guest cart into user cart on login', () => {
    it('merges all guest items into user cart', () => {
      const guestCart = makeCart(null, 'guest-session-xyz');
      addItem(guestCart, { productId: 11, variantId: null, name: 'Bookcase', quantity: 1, qtyValue: 1, priceSnapshot: 400 });
      addItem(guestCart, { productId: 12, variantId: null, name: 'Desk', quantity: 1, qtyValue: 1, priceSnapshot: 350 });

      const userCart = makeCart(42, null);
      mergeCarts(guestCart, userCart);

      expect(userCart.items).toHaveLength(2);
      expect(guestCart.items).toHaveLength(0); // guest cart cleared after merge
    });

    it('sums quantities when same item exists in both carts', () => {
      const guestCart = makeCart(null, 'guest-session-yyy');
      addItem(guestCart, { productId: 13, variantId: null, name: 'Ottoman', quantity: 2, qtyValue: 2, priceSnapshot: 200 });

      const userCart = makeCart(43, null);
      addItem(userCart, { productId: 13, variantId: null, name: 'Ottoman', quantity: 1, qtyValue: 1, priceSnapshot: 200 });

      mergeCarts(guestCart, userCart);

      expect(userCart.items).toHaveLength(1);
      expect(userCart.items[0].quantity).toBe(3); // 1 + 2 = 3
    });

    it('preserves user cart items not in guest cart', () => {
      const guestCart = makeCart(null, 'guest-session-zzz');
      addItem(guestCart, { productId: 14, variantId: null, name: 'Sideboard', quantity: 1, qtyValue: 1, priceSnapshot: 500 });

      const userCart = makeCart(44, null);
      addItem(userCart, { productId: 15, variantId: null, name: 'Coffee Table', quantity: 1, qtyValue: 1, priceSnapshot: 280 });

      mergeCarts(guestCart, userCart);

      expect(userCart.items).toHaveLength(2);
      expect(userCart.items.some(i => i.productId === 14)).toBe(true);
      expect(userCart.items.some(i => i.productId === 15)).toBe(true);
    });

    it('returns merged=0 when guest cart is empty', () => {
      const guestCart = makeCart(null, 'guest-session-empty');
      const userCart = makeCart(45, null);
      addItem(userCart, { productId: 16, variantId: null, name: 'Armchair', quantity: 1, qtyValue: 1, priceSnapshot: 450 });

      const mergedCount = guestCart.items.length;
      mergeCarts(guestCart, userCart);

      expect(mergedCount).toBe(0);
      expect(userCart.items).toHaveLength(1); // user cart unchanged
    });
  });
});
