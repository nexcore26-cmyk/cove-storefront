/**
 * Cart — Full cart page
 * Design: Obsidian Editorial
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { Minus, Plus, X, ShoppingBag, ArrowRight, Tag, Loader2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/contexts/CartContext';
import { cleanName } from '@/lib/cleanName';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function Cart() {
  const { items, removeItem, updateQuantity, updateQtyValue, subtotal, clearCart } = useCart();

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<null | { code: string; type: string; amount: string; freeShipping: boolean }>(null);
  const utils = trpc.useUtils();

  const couponDiscount = (() => {
    if (!appliedCoupon) return 0;
    const amt = parseFloat(appliedCoupon.amount);
    if (appliedCoupon.type === 'percent') return Math.min((subtotal * amt) / 100, subtotal);
    if (appliedCoupon.type === 'fixed_cart') return Math.min(amt, subtotal);
    return 0;
  })();

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const result = await utils.coupons.validate.fetch({ code, cartTotal: subtotal });
      setAppliedCoupon({ code: result.code, type: result.type, amount: String(result.amount), freeShipping: result.freeShipping ?? false });
      toast.success(`Coupon "${result.code}" applied!`);
      setCouponInput('');
    } catch (err: any) {
      setCouponError(err?.message || 'Invalid coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <Layout>
      {/* Page header */}
      <div
        className="py-14 border-b"
        style={{ backgroundColor: '#111110', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="container">
          <p
            className="text-xs font-semibold tracking-[0.25em] uppercase mb-3"
            style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}
          >
            Review
          </p>
          <h1
            className="text-5xl font-light"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#FAFAF8' }}
          >
            Your Cart
          </h1>
        </div>
      </div>

      <div className="container py-12">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <ShoppingBag size={64} style={{ color: '#D4C9B8' }} />
            <h2
              className="text-3xl font-light"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}
            >
              Your cart is empty
            </h2>
            <p
              className="text-sm"
              style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
            >
              Discover our curated collection of luxury furniture and décor.
            </p>
            <Link href="/shop" className="btn-obsidian inline-block mt-4">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Cart items */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                >
                  {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </h2>
                <button
                  onClick={clearCart}
                  className="text-xs transition-colors duration-200 hover:text-red-500"
                  style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                >
                  Clear Cart
                </button>
              </div>

              <div className="divide-y" style={{ borderColor: '#E8E4DC' }}>
                {items.map((item) => {
                  const isUnit = !item.measurementType || item.measurementType === 'unit';
                  const lineTotal = (item.price * item.qtyValue).toFixed(3);
                  return (
                  <div key={`${item.productId}-${item.variantId}`} className="flex gap-6 py-6">
                    {/* Image */}
                    <div className="w-24 h-28 flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#F0EDE8' }}>
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3
                            className="text-sm font-medium mb-1"
                            style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                          >
                            {cleanName(item.name)}
                          </h3>
                          {item.variantName && (
                            <p
                              className="text-xs mb-3"
                              style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                            >
                              {item.variantName}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(item.productId, item.variantId)}
                          className="flex-shrink-0 transition-colors duration-150 hover:text-red-500"
                          style={{ color: '#8A8A82' }}
                          aria-label="Remove item"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        {/* Quantity */}
                        {isUnit ? (
                          <div className="flex items-center border" style={{ borderColor: '#E8E4DC' }}>
                            <button
                              onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                              className="w-9 h-9 flex items-center justify-center transition-colors hover:bg-gray-50"
                              style={{ color: '#242424' }}
                            >
                              <Minus size={12} />
                            </button>
                            <span
                              className="w-10 text-center text-sm"
                              style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                            >
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                              className="w-9 h-9 flex items-center justify-center transition-colors hover:bg-gray-50"
                              style={{ color: '#242424' }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
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
                              className="w-16 h-9 text-center text-sm outline-none bg-transparent"
                              style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                            />
                            <span className="pr-3 text-xs" style={{ color: '#8A8A82' }}>
                              {item.measurementType}
                            </span>
                          </div>
                        )}

                        {/* Price */}
                        <span
                          className="text-xl font-medium italic"
                          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}
                        >
                          {lineTotal} KWD
                          {!isUnit && (
                            <span className="text-xs ml-1" style={{ color: '#8A8A82' }}>
                              ({item.price.toFixed(3)} / {item.measurementType})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Continue shopping */}
              <div className="mt-8">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase transition-colors duration-200 hover:text-[#9D7D39]"
                  style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                >
                  ← Continue Shopping
                </Link>
              </div>
            </div>

            {/* Order summary */}
            <div className="lg:col-span-1">
              <div
                className="p-8 sticky top-28"
                style={{ backgroundColor: '#F0EDE8' }}
              >
                <h2
                  className="text-xs font-semibold tracking-widest uppercase mb-6"
                  style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                >
                  Order Summary
                </h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Subtotal</span>
                    <span className="text-sm font-medium" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>{subtotal.toFixed(3)} KWD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Shipping</span>
                    <span className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                      Calculated at checkout
                    </span>
                  </div>

                </div>

                <div className="gold-rule mb-6" />

                <div className="flex justify-between mb-8">
                  <span
                    className="text-sm font-semibold tracking-wider uppercase"
                    style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                  >
                    Total
                  </span>
                  <span
                    className="text-2xl font-medium italic"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}
                  >
                    {subtotal.toFixed(3)} KWD
                  </span>
                </div>

                {/* Coupon discount line */}
                {couponDiscount > 0 && (
                  <div className="flex justify-between mb-2">
                    <span className="text-xs flex items-center gap-1" style={{ color: '#10B981', fontFamily: 'Montserrat, sans-serif' }}>
                      <Tag size={11} /> {appliedCoupon?.code}
                    </span>
                    <span className="text-xs" style={{ color: '#10B981', fontFamily: 'Montserrat, sans-serif' }}>−{couponDiscount.toFixed(3)} KWD</span>
                  </div>
                )}

                {/* Coupon code */}
                <div className="mb-6">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 border" style={{ borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.05)' }}>
                      <span className="text-xs font-medium" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                        {appliedCoupon.code} — {appliedCoupon.type === 'percent' ? `${parseFloat(appliedCoupon.amount).toFixed(0)}% off` : `${parseFloat(appliedCoupon.amount).toFixed(3)} KWD off`}
                        {appliedCoupon.freeShipping ? ' + Free Shipping' : ''}
                      </span>
                      <button onClick={() => { setAppliedCoupon(null); setCouponError(''); }} className="p-1 hover:opacity-70" style={{ color: '#8A8A82' }}>
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value); setCouponError(''); }}
                          onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                          placeholder="Coupon code"
                          className="flex-1 px-4 py-3 text-xs border bg-transparent outline-none focus:border-[#9D7D39] transition-colors uppercase"
                          style={{ borderColor: couponError ? '#EF4444' : '#D4C9B8', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                        />
                        <button
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !couponInput.trim()}
                          className="px-4 py-3 text-xs font-semibold tracking-wider uppercase border transition-colors hover:bg-[#9D7D39] hover:text-white hover:border-[#9D7D39] disabled:opacity-50"
                          style={{ borderColor: '#D4C9B8', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                        >
                          {couponLoading ? <Loader2 size={13} className="animate-spin" /> : 'Apply'}
                        </button>
                      </div>
                      {couponError && <p className="text-xs mt-1" style={{ color: '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>{couponError}</p>}
                    </>
                  )}
                </div>

                <Link
                  href="/checkout"
                  className="flex items-center justify-center gap-3 btn-obsidian w-full"
                >
                  Proceed to Checkout <ArrowRight size={14} />
                </Link>

                <p
                  className="text-xs text-center mt-4"
                  style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                >
                  Secure checkout · Free returns · 14-day policy for non-manufactured products
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
