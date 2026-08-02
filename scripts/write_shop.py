shop_content = r'''/**
 * Shop — Cove Interior Product Listing
 * Design: Obsidian Editorial — Live data from tRPC
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { SlidersHorizontal, X, ChevronDown, ChevronUp, Heart, Loader2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80';

const sortOptions = [
  { label: 'Featured', value: 'featured' },
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
];

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b py-5" style={{ borderColor: '#E8E4DC' }}>
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full text-left">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>{title}</span>
        {open ? <ChevronUp size={14} style={{ color: '#8A8A82' }} /> : <ChevronDown size={14} style={{ color: '#8A8A82' }} />}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function ProductCard({ product, onWishlist }: { product: any; onWishlist?: (id: number) => void }) {
  const { addItem } = useCart();
  const images: string[] = Array.isArray(product.images)
    ? product.images
    : (typeof product.images === 'string' ? (() => { try { return JSON.parse(product.images || '[]'); } catch { return []; } })() : []);
  const mainImage = images[0] || PLACEHOLDER_IMG;
  const price = parseFloat(String(product.price || 0));
  const salePrice = product.salePrice ? parseFloat(String(product.salePrice)) : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({ id: product.id, productId: product.id, name: product.name, slug: product.slug, image: mainImage, price: salePrice || price, quantity: 1 });
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div className="group">
      <div className="relative overflow-hidden mb-4" style={{ aspectRatio: '3/4', backgroundColor: '#F5F3EF' }}>
        <Link href={`/product/${product.slug}`}>
          <img src={mainImage} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
        </Link>
        {product.isNew && (
          <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-widest uppercase px-2 py-1 z-10"
            style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>New</span>
        )}
        {salePrice && (
          <span className="absolute top-3 right-3 text-[10px] font-semibold tracking-widest uppercase px-2 py-1 z-10"
            style={{ backgroundColor: '#C0392B', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>Sale</span>
        )}
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={() => onWishlist?.(product.id)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm hover:bg-[#9D7D39] hover:text-white transition-colors duration-200"
            style={{ color: '#242424' }}>
            <Heart size={14} />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 py-3 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ backgroundColor: '#111110' }}>
          <button onClick={handleAddToCart} className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>Add to Cart</button>
        </div>
      </div>
      <div>
        <Link href={`/product/${product.slug}`}>
          <h3 className="text-sm font-medium mb-2 hover:text-[#9D7D39] transition-colors duration-200"
            style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>{product.name}</h3>
        </Link>
        {product.sku && (
          <p className="text-[10px] mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>SKU: {product.sku}</p>
        )}
        <div className="flex items-center gap-3">
          <span className="text-base font-medium italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
            {(salePrice || price).toFixed(3)} KWD
          </span>
          {salePrice && <span className="text-sm line-through" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{price.toFixed(3)}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Shop() {
  const { slug: categorySlug } = useParams<{ slug?: string }>();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [selectedCategoryId, debouncedSearch, sort]);

  const { data: categoriesData } = trpc.categories.list.useQuery({ channel: 'online' });
  const categories = categoriesData || [];

  // Resolve category from URL slug
  useEffect(() => {
    if (categorySlug && categories.length > 0) {
      const found = categories.find(c => c.slug === categorySlug || c.slug === `main-${categorySlug}`);
      setSelectedCategoryId(found?.id);
    }
  }, [categorySlug, categories]);

  const queryInput = {
    categoryId: selectedCategoryId,
    search: debouncedSearch || undefined,
    featured: sort === 'featured' ? true : undefined,
    status: 'active' as const,
    limit: LIMIT,
    offset: page * LIMIT,
  };

  const { data: productsData, isLoading } = trpc.products.list.useQuery(queryInput);
  const products = productsData?.items || [];
  const total = productsData?.total || 0;
  const totalPages = Math.ceil(total / LIMIT);

  // Sort client-side for price sorts (server returns by featured/date)
  const sortedProducts = [...products].sort((a, b) => {
    if (sort === 'price_asc') return parseFloat(String(a.price)) - parseFloat(String(b.price));
    if (sort === 'price_desc') return parseFloat(String(b.price)) - parseFloat(String(a.price));
    return 0;
  });

  const handleWishlist = (productId: number) => {
    toast.success('Added to wishlist');
  };

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  return (
    <Layout>
      {/* Page header */}
      <div className="border-b py-10" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
        <div className="container">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
            {selectedCategory ? 'Category' : 'Collection'}
          </p>
          <h1 className="text-4xl md:text-5xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            {selectedCategory ? selectedCategory.name : 'All Products'}
          </h1>
          {total > 0 && (
            <p className="text-xs mt-2" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{total} pieces</p>
          )}
        </div>
      </div>

      <div className="container py-10">
        <div className="flex gap-10">
          {/* Sidebar filters — desktop */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              <FilterSection title="Categories">
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedCategoryId(undefined)}
                    className="block w-full text-left text-xs py-1 transition-colors duration-200"
                    style={{ fontFamily: 'Montserrat, sans-serif', color: !selectedCategoryId ? '#9D7D39' : '#242424', fontWeight: !selectedCategoryId ? 600 : 400 }}>
                    All Products
                  </button>
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id === selectedCategoryId ? undefined : cat.id)}
                      className="block w-full text-left text-xs py-1 transition-colors duration-200"
                      style={{ fontFamily: 'Montserrat, sans-serif', color: selectedCategoryId === cat.id ? '#9D7D39' : '#242424', fontWeight: selectedCategoryId === cat.id ? 600 : 400 }}>
                      {cat.name}
                    </button>
                  ))}
                </div>
              </FilterSection>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setMobileFiltersOpen(true)}
                  className="lg:hidden flex items-center gap-2 text-xs font-semibold tracking-widest uppercase border px-4 py-2"
                  style={{ borderColor: '#D4C9B8', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                  <SlidersHorizontal size={14} /> Filters
                </button>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="border px-4 py-2 text-xs outline-none focus:border-[#9D7D39] transition-colors duration-200 w-48 md:w-64"
                  style={{ borderColor: '#D4C9B8', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs hidden md:block" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                  {total} results
                </span>
                <select value={sort} onChange={e => setSort(e.target.value)}
                  className="border px-3 py-2 text-xs outline-none focus:border-[#9D7D39] transition-colors duration-200 bg-transparent"
                  style={{ borderColor: '#D4C9B8', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                  {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>

            {/* Active filters */}
            {(selectedCategoryId || debouncedSearch) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedCategory && (
                  <button onClick={() => setSelectedCategoryId(undefined)}
                    className="flex items-center gap-1 text-xs px-3 py-1 border"
                    style={{ borderColor: '#9D7D39', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                    {selectedCategory.name} <X size={10} />
                  </button>
                )}
                {debouncedSearch && (
                  <button onClick={() => setSearch('')}
                    className="flex items-center gap-1 text-xs px-3 py-1 border"
                    style={{ borderColor: '#9D7D39', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                    "{debouncedSearch}" <X size={10} />
                  </button>
                )}
              </div>
            )}

            {/* Products grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="animate-spin" size={32} style={{ color: '#9D7D39' }} />
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="text-center py-32">
                <p className="text-lg font-light mb-4" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>No products found</p>
                <p className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                  {debouncedSearch ? `No results for "${debouncedSearch}"` : 'Try adjusting your filters or run a WooCommerce sync from the admin panel.'}
                </p>
                {!debouncedSearch && (
                  <Link href="/admin" className="inline-flex items-center gap-2 mt-4 text-xs font-semibold tracking-widest uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                    Go to Admin Panel
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                  {sortedProducts.map(product => (
                    <ProductCard key={product.id} product={product} onWishlist={handleWishlist} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-12">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="w-10 h-10 flex items-center justify-center border text-xs disabled:opacity-40 hover:border-[#9D7D39] transition-colors"
                      style={{ borderColor: '#D4C9B8' }}>
                      ‹
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button key={i} onClick={() => setPage(i)}
                        className="w-10 h-10 flex items-center justify-center border text-xs transition-colors"
                        style={{ borderColor: page === i ? '#9D7D39' : '#D4C9B8', backgroundColor: page === i ? '#9D7D39' : 'transparent', color: page === i ? '#FAFAF8' : '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="w-10 h-10 flex items-center justify-center border text-xs disabled:opacity-40 hover:border-[#9D7D39] transition-colors"
                      style={{ borderColor: '#D4C9B8' }}>
                      ›
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filters drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold tracking-widest uppercase" style={{ fontFamily: 'Montserrat, sans-serif' }}>Filters</h3>
              <button onClick={() => setMobileFiltersOpen(false)}><X size={20} /></button>
            </div>
            <div className="space-y-1">
              <button onClick={() => { setSelectedCategoryId(undefined); setMobileFiltersOpen(false); }}
                className="block w-full text-left text-xs py-2 transition-colors duration-200"
                style={{ fontFamily: 'Montserrat, sans-serif', color: !selectedCategoryId ? '#9D7D39' : '#242424', fontWeight: !selectedCategoryId ? 600 : 400 }}>
                All Products
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => { setSelectedCategoryId(cat.id); setMobileFiltersOpen(false); }}
                  className="block w-full text-left text-xs py-2 transition-colors duration-200"
                  style={{ fontFamily: 'Montserrat, sans-serif', color: selectedCategoryId === cat.id ? '#9D7D39' : '#242424', fontWeight: selectedCategoryId === cat.id ? 600 : 400 }}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
'''

with open('/home/ubuntu/cove-storefront/client/src/pages/Shop.tsx', 'w') as f:
    f.write(shop_content)
print('Shop.tsx written:', len(shop_content.splitlines()), 'lines')
