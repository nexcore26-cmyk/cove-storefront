product_content = r'''/**
 * ProductDetail — Full product page
 * Design: Obsidian Editorial — Live data from tRPC
 */
import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { ChevronLeft, ChevronRight, Minus, Plus, Heart, Share2, Check, Loader2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80';

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useCart();

  const [currentImage, setCurrentImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'details' | 'shipping'>('description');

  const { data: product, isLoading, error } = trpc.products.getBySlug.useQuery({ slug: slug || '' }, { enabled: !!slug });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin" size={32} style={{ color: '#9D7D39' }} />
        </div>
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="text-3xl font-light mb-4" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>Product Not Found</h1>
          <p className="text-sm mb-8" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>The product you are looking for does not exist or has been removed.</p>
          <Link href="/shop" className="btn-obsidian inline-block">Back to Shop</Link>
        </div>
      </Layout>
    );
  }

  const images: string[] = Array.isArray(product.images)
    ? product.images
    : (typeof product.images === 'string' ? (() => { try { return JSON.parse(product.images || '[]'); } catch { return []; } })() : []);
  const displayImages = images.length > 0 ? images : [PLACEHOLDER_IMG];

  const variants: any[] = Array.isArray(product.variants)
    ? product.variants
    : (typeof product.variants === 'string' ? (() => { try { return JSON.parse(product.variants || '[]'); } catch { return []; } })() : []);

  const price = parseFloat(String(product.price || 0));
  const salePrice = product.salePrice ? parseFloat(String(product.salePrice)) : null;
  const displayPrice = salePrice || price;

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: displayImages[0],
      price: displayPrice,
      quantity,
      variantId: selectedVariant || undefined,
    });
    setAddedToCart(true);
    toast.success(`${product.name} added to cart`);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const prevImage = () => setCurrentImage(i => (i === 0 ? displayImages.length - 1 : i - 1));
  const nextImage = () => setCurrentImage(i => (i === displayImages.length - 1 ? 0 : i + 1));

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="border-b py-4" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
        <div className="container">
          <nav className="flex items-center gap-2 text-xs" style={{ fontFamily: 'Montserrat, sans-serif', color: '#8A8A82' }}>
            <Link href="/" className="hover:text-[#9D7D39] transition-colors">Home</Link>
            <span>/</span>
            <Link href="/shop" className="hover:text-[#9D7D39] transition-colors">Shop</Link>
            <span>/</span>
            <span style={{ color: '#242424' }}>{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20">
          {/* ── Image Gallery ─────────────────────────────────────────── */}
          <div>
            {/* Main image */}
            <div className="relative overflow-hidden mb-4 bg-gray-50" style={{ aspectRatio: '4/5' }}>
              <img src={displayImages[currentImage]} alt={product.name} className="w-full h-full object-cover" />
              {displayImages.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white transition-colors shadow-sm">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white transition-colors shadow-sm">
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
              {salePrice && (
                <span className="absolute top-4 left-4 text-[10px] font-semibold tracking-widest uppercase px-2 py-1"
                  style={{ backgroundColor: '#C0392B', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>Sale</span>
              )}
            </div>
            {/* Thumbnails */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {displayImages.map((img, idx) => (
                  <button key={idx} onClick={() => setCurrentImage(idx)}
                    className="flex-shrink-0 w-16 h-20 overflow-hidden border-2 transition-colors duration-200"
                    style={{ borderColor: currentImage === idx ? '#9D7D39' : 'transparent' }}>
                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Product Info ───────────────────────────────────────────── */}
          <div className="flex flex-col">
            {product.sku && (
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                SKU: {product.sku}
              </p>
            )}
            <h1 className="text-3xl md:text-4xl font-light mb-4" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-4 mb-6">
              <span className="text-2xl font-medium italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                {displayPrice.toFixed(3)} KWD
              </span>
              {salePrice && (
                <span className="text-lg line-through" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{price.toFixed(3)} KWD</span>
              )}
            </div>

            <div className="w-12 mb-6" style={{ height: '1px', backgroundColor: '#E8E4DC' }} />

            {/* Variants */}
            {variants.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                  Options
                </p>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v: any) => (
                    <button key={v.id} onClick={() => setSelectedVariant(v.id === selectedVariant ? null : v.id)}
                      disabled={v.stock === 0}
                      className="px-4 py-2 text-xs border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        borderColor: selectedVariant === v.id ? '#9D7D39' : '#D4C9B8',
                        backgroundColor: selectedVariant === v.id ? '#9D7D39' : 'transparent',
                        color: selectedVariant === v.id ? '#FAFAF8' : '#242424',
                        fontFamily: 'Montserrat, sans-serif',
                      }}>
                      {v.name || v.attributes || `Option ${v.id}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>Quantity</p>
              <div className="flex items-center border w-32" style={{ borderColor: '#D4C9B8' }}>
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors">
                  <Minus size={14} />
                </button>
                <span className="flex-1 text-center text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors">
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex gap-3 mb-8">
              <button onClick={handleAddToCart}
                className="flex-1 py-4 text-xs font-semibold tracking-widest uppercase flex items-center justify-center gap-2 transition-all duration-300"
                style={{ backgroundColor: addedToCart ? '#2E7D32' : '#111110', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                {addedToCart ? <><Check size={14} /> Added!</> : 'Add to Cart'}
              </button>
              <button onClick={() => { setWishlisted(w => !w); toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist'); }}
                className="w-14 flex items-center justify-center border transition-all duration-200"
                style={{ borderColor: wishlisted ? '#9D7D39' : '#D4C9B8', color: wishlisted ? '#9D7D39' : '#242424' }}>
                <Heart size={18} fill={wishlisted ? '#9D7D39' : 'none'} />
              </button>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}
                className="w-14 flex items-center justify-center border transition-all duration-200 hover:border-[#9D7D39]"
                style={{ borderColor: '#D4C9B8', color: '#242424' }}>
                <Share2 size={18} />
              </button>
            </div>

            {/* Stock status */}
            <div className="flex items-center gap-2 mb-8">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (product.stockQuantity ?? 0) > 0 ? '#2E7D32' : '#C0392B' }} />
              <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                {(product.stockQuantity ?? 0) > 0 ? `In stock (${product.stockQuantity} available)` : 'Out of stock'}
              </span>
            </div>

            {/* Tabs */}
            <div className="border-t" style={{ borderColor: '#E8E4DC' }}>
              <div className="flex gap-6 pt-4 mb-4">
                {(['description', 'details', 'shipping'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className="text-xs font-semibold tracking-widest uppercase pb-2 border-b-2 transition-colors duration-200"
                    style={{
                      borderColor: activeTab === tab ? '#9D7D39' : 'transparent',
                      color: activeTab === tab ? '#9D7D39' : '#8A8A82',
                      fontFamily: 'Montserrat, sans-serif',
                    }}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <div className="text-sm leading-relaxed" style={{ color: '#4A4A48', fontFamily: 'Montserrat, sans-serif' }}>
                {activeTab === 'description' && (
                  <div dangerouslySetInnerHTML={{ __html: product.description || 'No description available.' }} />
                )}
                {activeTab === 'details' && (
                  <div>
                    {product.weight && <p className="mb-2"><strong>Weight:</strong> {product.weight} kg</p>}
                    {product.dimensions && <p className="mb-2"><strong>Dimensions:</strong> {typeof product.dimensions === 'string' ? product.dimensions : JSON.stringify(product.dimensions)}</p>}
                    {product.sku && <p className="mb-2"><strong>SKU:</strong> {product.sku}</p>}
                    {!product.weight && !product.dimensions && <p>No additional details available.</p>}
                  </div>
                )}
                {activeTab === 'shipping' && (
                  <div>
                    <p className="mb-2">Free delivery on orders over 50 KWD within Kuwait.</p>
                    <p className="mb-2">Standard delivery: 2–5 business days.</p>
                    <p>Express delivery available at checkout.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
'''

with open('/home/ubuntu/cove-storefront/client/src/pages/ProductDetail.tsx', 'w') as f:
    f.write(product_content)
print('ProductDetail.tsx written:', len(product_content.splitlines()), 'lines')
