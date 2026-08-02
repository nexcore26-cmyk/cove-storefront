/**
 * CartContext — DB-persisted cart for Cove Interior storefront
 *
 * Strategy:
 * - Local state (reducer) provides instant UI response (no latency)
 * - All mutations sync to DB in the background (fire-and-forget with error logging)
 * - On mount: load from DB if user is logged in, else use localStorage as fallback
 * - On login: merge guest cart (localStorage) into user DB cart
 * - Guest carts use a stable sessionId stored in localStorage
 * - localStorage is kept as a fallback for offline/error scenarios
 */
import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

export type MeasurementType = 'unit' | 'meter' | 'kg' | 'roll' | 'box';

export interface CartItem {
  id: number;           // cartItemId from DB (0 for optimistic items not yet saved)
  productId: number;
  name: string;
  nameAr?: string;
  slug: string;
  image: string;
  price: number;
  quantity: number;
  qtyValue: number;
  measurementType: MeasurementType;
  variantId?: number;
  variantName?: string;
  sku?: string;
  shippingClassId?: number | null;
  kuwaitOnly?: boolean;
  maxStock?: number | null;
  variantAttributes?: Record<string, any>;
  selectedAttributeValueIds?: number[];
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  loaded: boolean; // true once DB load has completed
}

type CartAction =
  | { type: 'SET_ITEMS'; payload: CartItem[] }
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { productId: number; variantId?: number } }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: number; variantId?: number; quantity: number } }
  | { type: 'UPDATE_QTY_VALUE'; payload: { productId: number; variantId?: number; qtyValue: number } }
  | { type: 'UPDATE_ITEM_ID'; payload: { productId: number; variantId?: number; id: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_CART' }
  | { type: 'OPEN_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'SET_LOADED' };

function getCartSelectionKey(item: { productId: number; variantId?: number; selectedAttributeValueIds?: number[]; variantAttributes?: Record<string, any> }): string {
  const selectedIds = item.selectedAttributeValueIds ?? (Array.isArray((item.variantAttributes as any)?.__selectedAttributeValueIds) ? (item.variantAttributes as any).__selectedAttributeValueIds : []);
  return JSON.stringify({
    productId: item.productId,
    variantId: item.variantId ?? null,
    selectedAttributeValueIds: [...selectedIds].map(Number).filter(Number.isFinite).sort((a, b) => a - b),
  });
}

function clampUnitQuantity(quantity: number, maxStock?: number | null): number {
  const normalized = Math.max(1, Math.floor(Number(quantity) || 1));
  return typeof maxStock === 'number' && Number.isFinite(maxStock) && maxStock >= 0
    ? Math.max(1, Math.min(normalized, Math.floor(maxStock)))
    : normalized;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { ...state, items: action.payload, loaded: true };
    case 'SET_LOADED':
      return { ...state, loaded: true };
    case 'ADD_ITEM': {
      const existing = state.items.findIndex(
        (i) => getCartSelectionKey(i) === getCartSelectionKey(action.payload)
      );
      if (existing >= 0) {
        const items = [...state.items];
        const prev = items[existing];
        if (prev.measurementType === 'unit') {
          const maxStock = action.payload.maxStock ?? prev.maxStock ?? null;
          const nextQty = clampUnitQuantity(prev.quantity + action.payload.quantity, maxStock);
          items[existing] = { ...prev, maxStock, quantity: nextQty, qtyValue: nextQty };
        } else {
          items[existing] = { ...prev, qtyValue: parseFloat((prev.qtyValue + action.payload.qtyValue).toFixed(3)) };
        }
        return { ...state, items, isOpen: true };
      }
      const payload = action.payload.measurementType === 'unit'
        ? { ...action.payload, quantity: clampUnitQuantity(action.payload.quantity, action.payload.maxStock), qtyValue: clampUnitQuantity(action.payload.quantity, action.payload.maxStock) }
        : action.payload;
      return { ...state, items: [...state.items, payload], isOpen: true };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(
          (i) => !(i.productId === action.payload.productId && i.variantId === action.payload.variantId)
        ),
      };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map((i) =>
          i.productId === action.payload.productId && i.variantId === action.payload.variantId
            ? { ...i, quantity: clampUnitQuantity(action.payload.quantity, i.maxStock), qtyValue: clampUnitQuantity(action.payload.quantity, i.maxStock) }
            : i
        ),
      };
    case 'UPDATE_QTY_VALUE':
      return {
        ...state,
        items: state.items.map((i) =>
          i.productId === action.payload.productId && i.variantId === action.payload.variantId
            ? { ...i, qtyValue: Math.max(0.001, action.payload.qtyValue) }
            : i
        ),
      };
    case 'UPDATE_ITEM_ID':
      return {
        ...state,
        items: state.items.map((i) =>
          i.productId === action.payload.productId && i.variantId === action.payload.variantId
            ? { ...i, id: action.payload.id }
            : i
        ),
      };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    case 'TOGGLE_CART':
      return { ...state, isOpen: !state.isOpen };
    case 'OPEN_CART':
      return { ...state, isOpen: true };
    case 'CLOSE_CART':
      return { ...state, isOpen: false };
    default:
      return state;
  }
}

// Stable guest session ID stored in localStorage
function getOrCreateSessionId(): string {
  const key = 'cove_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  itemCount: number;
  subtotal: number;
  loaded: boolean;
  sessionId: string;
  addItem: (item: Omit<CartItem, 'id' | 'qtyValue' | 'measurementType'> & { qtyValue?: number; measurementType?: MeasurementType; maxStock?: number | null }) => void;
  removeItem: (productId: number, variantId?: number) => void;
  updateQuantity: (productId: number, variantId: number | undefined, quantity: number) => void;
  updateQtyValue: (productId: number, variantId: number | undefined, qtyValue: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const sessionIdRef = useRef<string>('');

  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false, loaded: false }, (init) => {
    // Initialize from localStorage as immediate fallback
    try {
      const saved = localStorage.getItem('cove_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((item: any) => ({
          ...item,
          id: item.id ?? 0,
          variantAttributes: item.variantAttributes ?? undefined,
          selectedAttributeValueIds: item.selectedAttributeValueIds ?? (Array.isArray(item.variantAttributes?.__selectedAttributeValueIds) ? item.variantAttributes.__selectedAttributeValueIds : undefined),
          qtyValue: item.qtyValue ?? item.quantity ?? 1,
          measurementType: item.measurementType ?? 'unit',
        }));
        return { ...init, items: migrated };
      }
    } catch { /* ignore */ }
    return init;
  });

  // tRPC mutations
  const addItemMutation = trpc.cart.addItem.useMutation();
  const removeItemMutation = trpc.cart.removeItem.useMutation();
  const updateItemMutation = trpc.cart.updateItem.useMutation();
  const clearMutation = trpc.cart.clear.useMutation();
  const mergeMutation = trpc.cart.mergeOnLogin.useMutation();
  const utils = trpc.useUtils();

  // Load cart from DB on mount / user change
  useEffect(() => {
    const sid = getOrCreateSessionId();
    sessionIdRef.current = sid;

    utils.cart.get.fetch({ sessionId: user ? undefined : sid }).then((data) => {
      if (data && data.items.length > 0) {
        dispatch({ type: 'SET_ITEMS', payload: data.items as CartItem[] });
      } else {
        dispatch({ type: 'SET_LOADED' });
      }
    }).catch(() => {
      dispatch({ type: 'SET_LOADED' });
    });
  }, [user?.id]);

  // Merge guest cart on login
  const prevUserIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (user && prevUserIdRef.current === undefined && sessionIdRef.current) {
      // Just logged in — merge guest cart
      mergeMutation.mutate({ sessionId: sessionIdRef.current }, {
        onSuccess: () => {
          utils.cart.get.fetch({ sessionId: undefined }).then((data) => {
            if (data && data.items.length > 0) {
              dispatch({ type: 'SET_ITEMS', payload: data.items as CartItem[] });
            }
          }).catch(() => {});
        },
      });
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id]);

  // Persist to localStorage as backup whenever items change
  useEffect(() => {
    if (state.loaded) {
      localStorage.setItem('cove_cart', JSON.stringify(state.items));
    }
  }, [state.items, state.loaded]);

  const itemCount = state.items.reduce((sum: number, i: CartItem) => sum + (i.measurementType === 'unit' ? i.quantity : 1), 0);
  const subtotal = state.items.reduce((sum: number, i: CartItem) => sum + i.price * i.qtyValue, 0);

  const addItem = useCallback((item: Omit<CartItem, 'id' | 'qtyValue' | 'measurementType'> & { qtyValue?: number; measurementType?: MeasurementType; maxStock?: number | null }) => {
    const fullItem: CartItem = {
      ...item,
      id: 0,
      qtyValue: item.qtyValue ?? item.quantity ?? 1,
      measurementType: item.measurementType ?? 'unit',
      maxStock: item.maxStock ?? null,
    };
    dispatch({ type: 'ADD_ITEM', payload: fullItem });
    // Sync to DB
    addItemMutation.mutate({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      qtyValue: fullItem.qtyValue,
      measurementType: fullItem.measurementType,
      sessionId: user ? undefined : sessionIdRef.current,
      variantAttributes: fullItem.variantAttributes,
    }, {
      onError: (err) => console.error('[Cart] addItem sync failed:', err),
    });
  }, [user, addItemMutation]);

  const removeItem = useCallback((productId: number, variantId?: number) => {
    const item = state.items.find((i: CartItem) => i.productId === productId && i.variantId === variantId);
    dispatch({ type: 'REMOVE_ITEM', payload: { productId, variantId } });
    if (item && item.id > 0) {
      removeItemMutation.mutate({ cartItemId: item.id }, {
        onError: (err) => console.error('[Cart] removeItem sync failed:', err),
      });
    }
  }, [state.items, removeItemMutation]);

  const updateQuantity = useCallback((productId: number, variantId: number | undefined, quantity: number) => {
    const item = state.items.find((i: CartItem) => i.productId === productId && i.variantId === variantId);
    dispatch({ type: 'UPDATE_QUANTITY', payload: { productId, variantId, quantity } });
    if (item && item.id > 0) {
      updateItemMutation.mutate({ cartItemId: item.id, quantity }, {
        onError: (err) => console.error('[Cart] updateQuantity sync failed:', err),
      });
    }
  }, [state.items, updateItemMutation]);

  const updateQtyValue = useCallback((productId: number, variantId: number | undefined, qtyValue: number) => {
    const item = state.items.find((i: CartItem) => i.productId === productId && i.variantId === variantId);
    dispatch({ type: 'UPDATE_QTY_VALUE', payload: { productId, variantId, qtyValue } });
    if (item && item.id > 0) {
      updateItemMutation.mutate({ cartItemId: item.id, qtyValue }, {
        onError: (err) => console.error('[Cart] updateQtyValue sync failed:', err),
      });
    }
  }, [state.items, updateItemMutation]);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
    clearMutation.mutate({ sessionId: user ? undefined : sessionIdRef.current }, {
      onError: (err) => console.error('[Cart] clear sync failed:', err),
    });
  }, [user, clearMutation]);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        isOpen: state.isOpen,
        itemCount,
        subtotal,
        loaded: state.loaded,
        sessionId: sessionIdRef.current,
        addItem,
        removeItem,
        updateQuantity,
        updateQtyValue,
        clearCart,
        toggleCart: () => dispatch({ type: 'TOGGLE_CART' }),
        openCart: () => dispatch({ type: 'OPEN_CART' }),
        closeCart: () => dispatch({ type: 'CLOSE_CART' }),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
