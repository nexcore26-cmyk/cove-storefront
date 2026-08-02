/**
 * Wishlist — Saved items page
 * Design: Obsidian Editorial — Live data from tRPC
 */
import { Heart, ShoppingBag, Trash2, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useState, useEffect } from 'react';
import { cleanName } from '@/lib/cleanName';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80';

function getSessionId(): string {
  let id = localStorage.getItem('cove_session_id');
  if (!id) {
    id = `sess_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('cove_session_id', id);
  }
  return id;
}

export default function Wishlist() {
  const { addItem } = useCart();
  const utils = trpc.useUtils();
  const [sessionId] = useState(() => getSessionId());

  const { data: wishlistItems, isLoading } = trpc.wishlist.get.useQuery(
    { sessionId },
    { refetchOnWindowFocus: false }
  );

  const removeMutation = trpc.wishlist.remove.useMutation({
    onSuccess: () => {
      utils.wishlist.get.invalidate();
      toast.success('Removed from wishlist');
    },
  });

  const handleAddToCart = (item: any) => {
    const product = item.product;
    if (!product) return;
    addItem({
      productId: product.id,
      name: cleanName(product.name),
      slug: product.slug,
      image: (() => {
        try {
          const imgs = JSON.parse(product.images || '[]');
          return Array.isArray(imgs) && imgs[0] ? imgs[0] : PLACEHOLDER_IMG;
        } catch { return PLACEHOLDER_IMG; }
      })(),
      price: parseFloat(String(product.salePrice || product.price || 0)),
      quantity: 1,
      shippingClassId: product.shippingClassId ?? null,
      kuwaitOnly: product.kuwaitOnly ?? false,
    });
    toast.success(`${cleanName(product.name)} added to cart`);
  };

  const handleRemove = (productId: number) => {
    removeMutation.mutate({ productId, sessionId });
  };

  return (
    <Layout>
      {/* Page header */}
      <div className="py-12 border-b" style={{ backgroundColor: '#111110', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="container text-center">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-2" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
            Your Collection
          </p>
          <h1 className="text-4xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#FAFAF8' }}>
            Wishlist
          </h1>
        </div>
      </div>

      <div className="container py-12" style={{ backgroundColor: '#FAFAF8', minHeight: '60vh' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin" size={32} style={{ color: '#9D7D39' }} />
          </div>
        ) : !wishlistItems || wishlistItems.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <Heart size={48} className="mx-auto mb-6" style={{ color: '#D4C9B8' }} />
            <h2 className="text-3xl font-light mb-4" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Your wishlist is empty
            </h2>
            <p className="text-sm mb-8" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Save pieces you love and come back to them anytime.
            </p>
            <Link href="/shop" className="btn-obsidian inline-block">
              Explore Collection
            </Link>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-8">
              <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
              </p>
              <Link href="/shop" className="text-xs font-semibold tracking-widest uppercase hover:text-[#9D7D39] transition-colors"
                style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                Continue Shopping
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {wishlistItems.map((item: any) => {
                const product = item.product;
                if (!product) return null;
                const images = (() => {
                  try { return JSON.parse(product.images || '[]'); } catch { return []; }
                })();
                const img = Array.isArray(images) && images[0] ? images[0] : PLACEHOLDER_IMG;
                const price = parseFloat(String(product.salePrice || product.price || 0));
                const originalPrice = product.salePrice ? parseFloat(String(product.price || 0)) : null;

                return (
                  <div key={item.id} className="group relative">
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemove(product.id)}
                      className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                      title="Remove from wishlist"
                    >
                      <Trash2 size={14} style={{ color: '#C0392B' }} />
                    </button>

                    {/* Image */}
                    <div className="relative overflow-hidden mb-3 bg-gray-50" style={{ aspectRatio: '3/4' }}>
                      <Link href={`/product/${product.slug}`}>
                        <img src={img} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      </Link>
                      {/* Add to cart overlay */}
                      <div
                        className="absolute bottom-0 left-0 right-0 py-3 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ backgroundColor: '#111110' }}
                      >
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="flex items-center justify-center gap-2 w-full text-xs font-semibold tracking-widest uppercase"
                          style={{ color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
                        >
                          <ShoppingBag size={12} /> Add to Cart
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div>
                      <Link href={`/product/${product.slug}`}>
                        <h3 className="text-sm font-medium mb-1 hover:text-[#9D7D39] transition-colors"
                          style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                          {cleanName(product.name)}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-medium italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                          {price.toFixed(3)} KWD
                        </span>
                        {originalPrice && (
                          <span className="text-xs line-through" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            {originalPrice.toFixed(3)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
