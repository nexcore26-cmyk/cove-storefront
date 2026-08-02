home_content = r'''/**
 * Home — Cove Interior Luxury Storefront Homepage
 * Design: Obsidian Editorial — Live data from tRPC
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { ArrowRight, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

const HERO_LIVING = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663503619764/cKkGLF3y8cCPRhNzMTjKZq/cove-hero-living-GavFKBCmKwMt5nH9i6y6Be.webp';
const HERO_BEDROOM = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663503619764/cKkGLF3y8cCPRhNzMTjKZq/cove-hero-bedroom-cXD9mE9Xq57AYqHGgwPQp2.webp';
const BRASS_CATEGORY = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663503619764/cKkGLF3y8cCPRhNzMTjKZq/cove-category-brass-B2zHoaVdgwiEAXnSwcbTXR.webp';
const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80';

function useFadeIn(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function ProductCard({ product }: { product: any }) {
  const { addItem } = useCart();
  const { ref, visible } = useFadeIn();
  const images: string[] = Array.isArray(product.images)
    ? product.images
    : (typeof product.images === 'string' ? (() => { try { return JSON.parse(product.images || '[]'); } catch { return []; } })() : []);
  const mainImage = images[0] || PLACEHOLDER_IMG;
  const price = parseFloat(String(product.price || 0));
  const salePrice = product.salePrice ? parseFloat(String(product.salePrice)) : null;

  const handleAddToCart = () => {
    addItem({ id: product.id, productId: product.id, name: product.name, slug: product.slug, image: mainImage, price: salePrice || price, quantity: 1 });
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div ref={ref} className="group"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(30px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
      <div className="product-image-wrap relative mb-4 bg-gray-50" style={{ aspectRatio: '3/4' }}>
        <img src={mainImage} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        {product.isNew && (
          <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-widest uppercase px-2 py-1"
            style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>New</span>
        )}
        {salePrice && (
          <span className="absolute top-3 right-3 text-[10px] font-semibold tracking-widest uppercase px-2 py-1"
            style={{ backgroundColor: '#C0392B', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>Sale</span>
        )}
        <div className="absolute bottom-0 left-0 right-0 py-3 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ backgroundColor: '#111110' }}>
          <button onClick={handleAddToCart} className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>Add to Cart</button>
        </div>
      </div>
      <div>
        <Link href={`/product/${product.slug}`}>
          <h3 className="text-base font-medium mb-2 gold-underline inline-block"
            style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>{product.name}</h3>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
            {(salePrice || price).toFixed(3)} KWD
          </span>
          {salePrice && <span className="text-sm line-through" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{price.toFixed(3)}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { ref: heroRef, visible: heroVisible } = useFadeIn(0.01);

  const { data: categoriesData, isLoading: catsLoading } = trpc.categories.list.useQuery({ channel: 'online' });
  const { data: featuredData, isLoading: prodsLoading } = trpc.products.list.useQuery({ featured: true, limit: 8, status: 'active' });
  const { data: allProdsData } = trpc.products.list.useQuery({ limit: 8, status: 'active' });

  const liveCategories = categoriesData || [];
  const featuredProducts = (featuredData?.items?.length ? featuredData.items : allProdsData?.items) || [];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    toast.success('Thank you for subscribing!');
  };

  const maxSlide = Math.max(0, featuredProducts.length - 4);
  const prevSlide = () => setCurrentSlide(s => Math.max(0, s - 1));
  const nextSlide = () => setCurrentSlide(s => Math.min(maxSlide, s + 1));
  const visibleProducts = featuredProducts.slice(currentSlide, currentSlide + 4);

  const displayCategories = liveCategories.length > 0
    ? liveCategories.slice(0, 4).map(cat => ({ name: cat.name, slug: cat.slug, image: cat.image || PLACEHOLDER_IMG }))
    : [
        { name: 'Brass Collection', slug: 'brass', image: BRASS_CATEGORY },
        { name: 'Sofas & Seating', slug: 'sofas', image: PLACEHOLDER_IMG },
        { name: 'Lighting', slug: 'lighting', image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80' },
        { name: 'Bedroom', slug: 'bedroom', image: HERO_BEDROOM },
      ];

  return (
    <Layout>
      {/* HERO */}
      <section className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 96px)', minHeight: '600px' }}>
        <img src={HERO_LIVING} alt="Cove Interior" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: 'center 30%' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top right, rgba(17,17,16,0.75) 0%, rgba(17,17,16,0.2) 50%, transparent 100%)' }} />
        <div ref={heroRef} className="absolute bottom-16 left-0 px-8 md:px-16 max-w-2xl"
          style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(40px)', transition: 'opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s' }}>
          <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>New Collection 2025</p>
          <h1 className="text-5xl md:text-7xl font-light leading-[1.05] mb-6" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#FAFAF8' }}>
            Crafted for the<br /><em>Discerning</em>
          </h1>
          <p className="text-sm font-light leading-relaxed mb-8 max-w-md" style={{ color: 'rgba(250,250,248,0.8)', fontFamily: 'Montserrat, sans-serif' }}>
            Discover our curated collection of luxury furniture and home decor, where every piece tells a story of exceptional craftsmanship.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/shop" className="btn-obsidian inline-block">Explore Collection</Link>
            <Link href="/shop" className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase transition-colors duration-200 hover:text-[#9D7D39]"
              style={{ color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
              View All <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <div className="absolute bottom-8 right-8 md:right-16 flex flex-col items-center gap-2">
          <div className="w-px h-12 animate-pulse" style={{ backgroundColor: 'rgba(157,125,57,0.6)' }} />
          <span className="text-[10px] tracking-[0.2em] uppercase rotate-90 origin-center mt-4" style={{ color: 'rgba(250,250,248,0.5)', fontFamily: 'Montserrat, sans-serif' }}>Scroll</span>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="py-20" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="container">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Explore</p>
              <h2 className="text-4xl md:text-5xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>Shop by Category</h2>
            </div>
            <Link href="/shop" className="hidden md:flex items-center gap-2 text-xs font-semibold tracking-widest uppercase transition-colors duration-200 hover:text-[#9D7D39]"
              style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {catsLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" style={{ color: '#9D7D39' }} /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {displayCategories[0] && (
                <div className="col-span-2 row-span-2 group relative overflow-hidden" style={{ aspectRatio: '1/1' }}>
                  <img src={displayCategories[0].image} alt={displayCategories[0].name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,16,0.7) 0%, transparent 60%)' }} />
                  <div className="absolute bottom-6 left-6">
                    <h3 className="text-2xl md:text-3xl font-light text-white mb-3" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{displayCategories[0].name}</h3>
                    <Link href={`/category/${displayCategories[0].slug}`} className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase hover:text-[#9D7D39]"
                      style={{ color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                      Shop Now <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              )}
              {displayCategories.slice(1).map(cat => (
                <div key={cat.slug} className="group relative overflow-hidden col-span-1" style={{ aspectRatio: '1/1' }}>
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,16,0.65) 0%, transparent 60%)' }} />
                  <div className="absolute bottom-4 left-4">
                    <h3 className="text-lg font-light text-white" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{cat.name}</h3>
                    <Link href={`/category/${cat.slug}`} className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-widest uppercase mt-2 hover:text-[#9D7D39]"
                      style={{ color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                      Shop <ArrowRight size={10} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="py-20" style={{ backgroundColor: '#F0EDE8' }}>
        <div className="container">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Curated</p>
              <h2 className="text-4xl md:text-5xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>Featured Pieces</h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={prevSlide} disabled={currentSlide === 0}
                className="w-10 h-10 flex items-center justify-center border transition-all duration-200 hover:border-[#9D7D39] hover:text-[#9D7D39] disabled:opacity-40"
                style={{ borderColor: '#D4C9B8', color: '#242424' }} aria-label="Previous">
                <ChevronLeft size={16} />
              </button>
              <button onClick={nextSlide} disabled={currentSlide >= maxSlide}
                className="w-10 h-10 flex items-center justify-center border transition-all duration-200 hover:border-[#9D7D39] hover:text-[#9D7D39] disabled:opacity-40"
                style={{ borderColor: '#D4C9B8', color: '#242424' }} aria-label="Next">
                <ChevronRight size={16} />
              </button>
              <Link href="/shop" className="hidden md:flex items-center gap-2 text-xs font-semibold tracking-widest uppercase ml-4 hover:text-[#9D7D39]"
                style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                View All <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          {prodsLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" style={{ color: '#9D7D39' }} /></div>
          ) : visibleProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {visibleProducts.map((product, idx) => <ProductCard key={`${product.id}-${idx}`} product={product} />)}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-sm mb-4" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                No products yet. Run a WooCommerce sync from the admin panel to import your catalogue.
              </p>
              <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                Go to Admin <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* BRAND STORY */}
      <section className="grid grid-cols-1 md:grid-cols-2 min-h-[600px]">
        <div className="relative overflow-hidden" style={{ minHeight: '400px' }}>
          <img src={HERO_BEDROOM} alt="Cove Interior — The Story" className="absolute inset-0 w-full h-full object-cover" />
        </div>
        <div className="flex flex-col justify-center px-10 md:px-16 py-16" style={{ backgroundColor: '#111110' }}>
          <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Our Philosophy</p>
          <h2 className="text-4xl md:text-5xl font-light leading-tight mb-6" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#FAFAF8' }}>
            Every space deserves a<br /><em>masterpiece</em>
          </h2>
          <div className="w-12 mb-6" style={{ height: '1px', backgroundColor: '#9D7D39' }} />
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(250,250,248,0.7)', fontFamily: 'Montserrat, sans-serif' }}>
            At Cove Interior, we believe that exceptional living begins with exceptional design. Each piece in our collection is thoughtfully selected for its craftsmanship, materiality, and ability to transform a space.
          </p>
          <p className="text-sm leading-relaxed mb-10" style={{ color: 'rgba(250,250,248,0.7)', fontFamily: 'Montserrat, sans-serif' }}>
            From our signature brass collection to bespoke upholstered seating, every item is an investment in beauty that endures.
          </p>
          <Link href="/shop" className="inline-flex items-center gap-3 text-xs font-semibold tracking-widest uppercase group" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
            Discover Our Story <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 border-y" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[{ value: '500+', label: 'Curated Pieces' }, { value: '12+', label: 'Years of Excellence' }, { value: '3', label: 'Flagship Showrooms' }, { value: '5,000+', label: 'Happy Clients' }].map(stat => (
              <div key={stat.label}>
                <p className="text-4xl md:text-5xl font-light mb-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>{stat.value}</p>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRASS LIFESTYLE */}
      <section className="relative overflow-hidden" style={{ height: '70vh', minHeight: '400px' }}>
        <img src={BRASS_CATEGORY} alt="Brass Collection" className="w-full h-full object-cover" style={{ objectPosition: 'center 40%' }} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(17,17,16,0.5)' }}>
          <div className="text-center px-6">
            <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Signature Collection</p>
            <h2 className="text-5xl md:text-7xl font-light mb-8" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#FAFAF8' }}>The Brass Edit</h2>
            <Link href="/shop" className="btn-gold-outline inline-block">Shop the Collection</Link>
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="py-20" style={{ backgroundColor: '#111110' }}>
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Stay Inspired</p>
            <h2 className="text-4xl md:text-5xl font-light mb-4" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#FAFAF8' }}>Join the Cove Circle</h2>
            <p className="text-sm leading-relaxed mb-10" style={{ color: 'rgba(250,250,248,0.6)', fontFamily: 'Montserrat, sans-serif' }}>
              Be the first to discover new arrivals, exclusive offers, and interior inspiration curated for the discerning home.
            </p>
            {subscribed ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#9D7D39' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#FAFAF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <p className="text-sm font-medium" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Welcome to the Cove Circle</p>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" required
                  className="flex-1 px-5 py-3 text-sm bg-transparent border outline-none transition-colors duration-200 focus:border-[#9D7D39]"
                  style={{ borderColor: 'rgba(255,255,255,0.2)', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }} />
                <button type="submit" className="btn-obsidian whitespace-nowrap" style={{ backgroundColor: '#9D7D39' }}>Subscribe</button>
              </form>
            )}
            <p className="text-xs mt-4" style={{ color: 'rgba(250,250,248,0.3)', fontFamily: 'Montserrat, sans-serif' }}>No spam, ever. Unsubscribe at any time.</p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
'''

with open('/home/ubuntu/cove-storefront/client/src/pages/Home.tsx', 'w') as f:
    f.write(home_content)
print('Home.tsx written:', len(home_content.splitlines()), 'lines')
