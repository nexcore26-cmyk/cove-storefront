/**
 * CartDrawer — Slides in from the right
 * Obsidian Editorial Design System
 * Supports measurement-based quantities (meter, kg, roll, box)
 */
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Link } from 'wouter';
import { useCart } from '@/contexts/CartContext';
import { cleanName } from '@/lib/cleanName';

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, updateQtyValue, subtotal } = useCart();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm flex flex-col shadow-2xl"
        style={{ backgroundColor: '#FAFAF8' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: '#E8E4DC' }}
        >
          <h2
            className="text-sm font-semibold tracking-widest uppercase"
            style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
          >
            Your Cart
            {items.length > 0 && (
              <span className="ml-2 text-xs" style={{ color: '#8A8A82' }}>
                ({items.length} {items.length === 1 ? 'item' : 'items'})
              </span>
            )}
          </h2>
          <button
            onClick={closeCart}
            className="transition-colors duration-200 hover:text-[#9D7D39]"
            style={{ color: '#242424' }}
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
              <ShoppingBag size={48} style={{ color: '#D4C9B8' }} />
              <p
                className="text-sm text-center"
                style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
              >
                Your cart is empty
              </p>
              <button
                onClick={closeCart}
                className="btn-obsidian text-xs"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#E8E4DC' }}>
              {items.map((item) => {
                const isUnit = !item.measurementType || item.measurementType === 'unit';
                const lineTotal = (item.price * item.qtyValue).toFixed(3);
                return (
                  <li key={`${item.productId}-${item.variantId}`} className="flex gap-4 p-6">
                    {/* Image */}
                    <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-gray-100">
                      <img
                        src={item.image}
                        alt={cleanName(item.name)}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium leading-snug mb-1 truncate"
                        style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                      >
                        {cleanName(item.name)}
                      </p>
                      {item.variantName && (
                        <p
                          className="text-xs mb-2"
                          style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                        >
                          {item.variantName}
                        </p>
                      )}
                      <p
                        className="text-base font-medium italic mb-3"
                        style={{
                          fontFamily: "'Cormorant Garamond', Georgia, serif",
                          color: '#9D7D39',
                        }}
                      >
                        {lineTotal} KWD
                        {!isUnit && (
                          <span className="text-xs ml-1" style={{ color: '#8A8A82' }}>
                            ({item.price.toFixed(3)} / {item.measurementType})
                          </span>
                        )}
                      </p>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-3">
                        {isUnit ? (
                          (() => {
                            const maxStock = typeof item.maxStock === 'number' && Number.isFinite(item.maxStock) ? Math.floor(item.maxStock) : null;
                            const atMaxStock = maxStock !== null && item.quantity >= maxStock;
                            return <>
                            <button
                              onClick={() => {
                                if (item.quantity - 1 <= 0) removeItem(item.productId, item.variantId);
                                else updateQuantity(item.productId, item.variantId, item.quantity - 1);
                              }}
                              className="w-7 h-7 flex items-center justify-center border transition-colors duration-150 hover:border-[#9D7D39] hover:text-[#9D7D39]"
                              style={{ borderColor: '#E8E4DC', color: '#242424' }}
                              aria-label="Decrease quantity"
                            >
                              <Minus size={12} />
                            </button>
                            <span
                              className="text-sm font-medium w-6 text-center"
                              style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                            >
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => !atMaxStock && updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                              disabled={atMaxStock}
                              title={atMaxStock && maxStock !== null ? `Only ${maxStock} available` : 'Increase quantity'}
                              className="w-7 h-7 flex items-center justify-center border transition-colors duration-150 hover:border-[#9D7D39] hover:text-[#9D7D39] disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ borderColor: '#E8E4DC', color: '#242424' }}
                              aria-label="Increase quantity"
                            >
                              <Plus size={12} />
                            </button>
                          </>;
                          })()
                        ) : (
                          <div className="flex items-center border" style={{ borderColor: '#E8E4DC' }}>
                            <input
                              type="number"
                              min="0.001"
                              step="0.5"
                              value={item.qtyValue}
                              onChange={e => {
                                const v = parseFloat(e.target.value);
                                if (v > 0) updateQtyValue(item.productId, item.variantId, v);
                              }}
                              className="w-16 h-7 text-center text-xs outline-none bg-transparent"
                              style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                            />
                            <span className="pr-2 text-xs" style={{ color: '#8A8A82' }}>
                              {item.measurementType}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => removeItem(item.productId, item.variantId)}
                          className="ml-auto text-xs transition-colors duration-150 hover:text-red-500"
                          style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div
            className="border-t p-6 space-y-4"
            style={{ borderColor: '#E8E4DC' }}
          >
            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ fontFamily: 'Montserrat, sans-serif', color: '#8A8A82' }}
              >
                Subtotal
              </span>
              <span
                className="text-xl font-medium italic"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  color: '#9D7D39',
                }}
              >
                {subtotal.toFixed(3)} KWD
              </span>
            </div>
            <p
              className="text-xs"
              style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
            >
              Shipping cost calculated at checkout
            </p>

            {/* CTA buttons */}
            <div className="space-y-3">
              <Link
                href="/checkout"
                onClick={closeCart}
                className="block w-full text-center btn-obsidian"
              >
                Proceed to Checkout
              </Link>
              <Link
                href="/cart"
                onClick={closeCart}
                className="block w-full text-center btn-gold-outline"
              >
                View Cart
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
