/**
 * ProductDetail — Full product page
 * Design: Obsidian Editorial — Live data from tRPC
 * Variants grouped by attribute: fixed attributes shown as labels,
 * selectable attributes shown as image swatches or text buttons.
 */
import { useState, useMemo } from 'react';
import { useParams, Link } from 'wouter';
import { ChevronLeft, ChevronRight, Minus, Plus, Heart, Share2, Check, Loader2, MapPin } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80';

// Strip internal channel suffixes from display names
const cleanName = (name: string) => name.replace(/\s+(store|web|event|vendor)$/i, '').trim();

// Strip Visual Composer shortcodes from description HTML
const cleanDescription = (html: string) => html.replace(/\[\/?vc_[^\]]*\]/g, '').replace(/\[\/?woodmart_[^\]]*\]/g, '').trim();

// Parse attributes from a variant — always returns array of {name, option}
function parseAttrs(attrs: any): { name: string; option: string }[] {
  if (!attrs) return [];
  const parsed = typeof attrs === 'string' ? (() => { try { return JSON.parse(attrs); } catch { return attrs; } })() : attrs;
  if (Array.isArray(parsed)) {
    return parsed.map((a: any) => ({ name: String(a.name || ''), option: String(a.option || a.value || '') }));
  }
  if (typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, string>).map(([name, option]) => ({ name, option }));
  }
  return [];
}

// Build attribute groups from all variants
function buildAttrGroups(variants: any[]) {
  // Map: attrName → Set of option values
  const attrOptions: Record<string, Set<string>> = {};
  for (const v of variants) {
    for (const { name, option } of parseAttrs(v.attributes)) {
      if (!attrOptions[name]) attrOptions[name] = new Set();
      attrOptions[name].add(option);
    }
  }

  // Fixed = only 1 unique value; selectable = more than 1
  const fixed: { name: string; value: string }[] = [];
  const selectable: { name: string; options: string[] }[] = [];

  for (const [name, opts] of Object.entries(attrOptions)) {
    if (opts.size === 1) {
      fixed.push({ name, value: Array.from(opts)[0] });
    } else {
      selectable.push({ name, options: Array.from(opts) });
    }
  }

  return { fixed, selectable };
}

// Find the variant that matches all selected attribute values
function findMatchingVariant(variants: any[], selections: Record<string, string>): any | null {
  const selEntries = Object.entries(selections);
  if (selEntries.length === 0) return null;
  return variants.find(v => {
    const attrs = parseAttrs(v.attributes);
    return selEntries.every(([name, option]) =>
      attrs.some(a => a.name === name && a.option === option)
    );
  }) || null;
}

// Get the image for a specific option value within an attribute
function getOptionImage(variants: any[], attrName: string, option: string): string | null {
  const v = variants.find(v => {
    const attrs = parseAttrs(v.attributes);
    return attrs.some(a => a.name === attrName && a.option === option);
  });
  return v?.image || null;
}

// Storefront product pages must render only values assigned to the current product.
// The attributes API may include all global values for an attribute, while
// activeValueIds contains the product-specific values selected in admin.
function getProductVisibleAttributeValues(pa: any): any[] {
  const values: any[] = pa?.allValues ?? [];
  const activeIds = Array.isArray(pa?.activeValueIds)
    ? new Set(pa.activeValueIds.map((id: any) => Number(id)))
    : null;

  if (!activeIds || activeIds.size === 0) return values;
  return values.filter((value: any) => activeIds.has(Number(value.id)));
}

// Admin Product Attributes image swatches may be saved under either
// `swatch` (legacy/imported values) or `image` (current NativeMediaField uploads).
// Normalize here so every image-type attribute renders consistently for all products.
function getAttributeValueImage(value: any): string | null {
  const candidates = [
    value?.swatch,
    value?.image,
    value?.displayImage,
    value?.imageUrl,
    value?.mediaUrl,
  ];
  const found = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return found ? found.trim() : null;
}
export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useCart();

  const [currentImage, setCurrentImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [qtyValue, setQtyValue] = useState<number>(1);  // decimal qty for measurement-based products
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [addedToCart, setAddedToCart] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'details' | 'shipping'>('description');
  // Custom box selections: variantId → quantity
  const [boxSelections, setBoxSelections] = useState<Record<number, number>>({});
  const [boxAddedToCart, setBoxAddedToCart] = useState(false);

  const { locale } = useLanguage();
  const { data: productData, isLoading, error } = trpc.products.bySlug.useQuery(
    { slug: slug || '', locale },
    { enabled: !!slug }
  );
  const product = productData?.product;
  const liveVariants: any[] = productData?.variants || [];

  // ── New-system attributes ─────────────────────────────────────────────────
  const [attrSelections, setAttrSelections] = useState<Record<number, number>>({}); // attributeId → valueId

  const { data: newAttrs = [] } = trpc.attributes.getProductAttributes.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: !!product?.id }
  );

  // Collect all selected value IDs for stock query
  const selectedValueIds = useMemo(() => Object.values(attrSelections), [attrSelections]);
  const allValueIds = useMemo(() => {
    const ids: number[] = [];
    for (const pa of (newAttrs as any[])) {
      for (const v of getProductVisibleAttributeValues(pa)) ids.push(v.id);
    }
    return ids;
  }, [newAttrs]);

  const { data: valueStocks = [] } = trpc.attributes.getValueStock.useQuery(
    { valueIds: allValueIds },
    { enabled: allValueIds.length > 0 }
  );

  const stockMap = useMemo(() => {
    const m: Record<number, { onlineQty: number; posQty: number; isBundle: boolean }> = {};
    for (const s of (valueStocks as any[])) m[s.valueId] = s;
    return m;
  }, [valueStocks]);

  // Determine if new-system attributes exist
  const hasNewAttrs = (newAttrs as any[]).length > 0;

  // For new-system: find selected value objects
  const selectedNewValues = useMemo(() => {
    const vals: any[] = [];
    for (const pa of (newAttrs as any[])) {
      const valueId = attrSelections[pa.attributeId];
      if (valueId) {
        const v = getProductVisibleAttributeValues(pa).find((v: any) => v.id === valueId);
        if (v) vals.push(v);
      }
    }
    return vals;
  }, [newAttrs, attrSelections]);

  // All required attributes selected?
  const allNewAttrsSelected = hasNewAttrs && (newAttrs as any[]).every((pa: any) => !!attrSelections[pa.attributeId]);

  // Map new-system selections back to the legacy variant attribute names/labels used by
  // imported WooCommerce rows, so selected legacy variants can still drive price/images.
  const newAttrVariantSelections = useMemo(() => {
    const mapped: Record<string, string> = {};
    for (const pa of (newAttrs as any[])) {
      const valueId = attrSelections[pa.attributeId];
      if (!valueId) continue;
      const attr = pa.attribute ?? {};
      const attrName = attr.name ?? attr.labelEn ?? attr.nameEn ?? pa.name ?? pa.labelEn;
      const value = getProductVisibleAttributeValues(pa).find((v: any) => v.id === valueId);
      const option = value?.labelEn ?? value?.name ?? value?.label;
      if (attrName && option) mapped[String(attrName)] = String(option);
    }
    return mapped;
  }, [newAttrs, attrSelections]);

  // Price override from selected new-system values (use last selected value that has a price)
  const newValuePrice = useMemo(() => {
    for (const v of [...selectedNewValues].reverse()) {
      if (v.price) return parseFloat(String(v.price));
    }
    return null;
  }, [selectedNewValues]);
  const newValueSalePrice = useMemo(() => {
    for (const v of [...selectedNewValues].reverse()) {
      if (v.salePrice) return parseFloat(String(v.salePrice));
    }
    return null;
  }, [selectedNewValues]);

  // Stock status for new-system: check online warehouse
  const newSystemStockStatus = useMemo((): 'in-stock' | 'out-of-stock' | 'showroom-only' | 'unchecked' => {
    if (!allNewAttrsSelected) return 'unchecked';
    let anyOutOnline = false;
    let anyInPos = false;
    for (const v of selectedNewValues) {
      const s = stockMap[v.id];
      if (!s) continue;
      if (s.onlineQty === 0) anyOutOnline = true;
      if (s.posQty > 0) anyInPos = true;
    }
    if (!anyOutOnline) return 'in-stock';
    if (anyInPos) return 'showroom-only';
    return 'out-of-stock';
  }, [allNewAttrsSelected, selectedNewValues, stockMap]);

  // Build attribute groups
  const { fixed, selectable } = useMemo(() => buildAttrGroups(liveVariants), [liveVariants]);

  // Find the currently selected variant. Products migrated from WooCommerce may expose
  // the new attribute selector UI while the commercial variant rows still carry the
  // authoritative imported prices/images, so use mapped new-system selections first.
  const selectedVariant = useMemo(
    () => findMatchingVariant(liveVariants, hasNewAttrs ? newAttrVariantSelections : selections),
    [liveVariants, hasNewAttrs, newAttrVariantSelections, selections]
  );

  // Images: use selected variant gallery if available, else product images
  const productImages = useMemo(() => {
    const rawImages = (product as any)?.images;
    const imgs: string[] = Array.isArray(rawImages)
      ? rawImages
      : (typeof rawImages === 'string' ? (() => { try { return JSON.parse(rawImages || '[]'); } catch { return []; } })() : []);
    return imgs.length > 0 ? imgs : [PLACEHOLDER_IMG];
  }, [product]);

  const variantImages = useMemo(() => {
    if (!selectedVariant) return null;
    const gallery: string[] = (() => {
      const g = selectedVariant.galleryImages;
      if (!g) return [];
      return typeof g === 'string' ? (() => { try { return JSON.parse(g); } catch { return []; } })() : (Array.isArray(g) ? g : []);
    })();
    const imgs: string[] = [];
    if (selectedVariant.image) imgs.push(selectedVariant.image);
    imgs.push(...gallery);
    return imgs.length > 0 ? imgs : null;
  }, [selectedVariant]);

  const displayImages = variantImages || productImages;

  // Price precedence: selected legacy/imported variants are the commercial source of truth
  // for migrated WooCommerce products. New-system attribute value prices remain a fallback
  // for products that do not resolve to a legacy variant row.
  const basePrice = parseFloat(String((product as any)?.price || 0));
  const baseSalePrice = (product as any)?.salePrice ? parseFloat(String((product as any).salePrice)) : null;
  const variantPrice = selectedVariant?.price ? parseFloat(String(selectedVariant.price)) : null;
  const variantSalePrice = selectedVariant?.salePrice ? parseFloat(String(selectedVariant.salePrice)) : null;
  const legacyDisplayPrice = variantSalePrice ?? variantPrice;
  const newSystemDisplayPrice = newValueSalePrice ?? newValuePrice;
  const displayPrice = legacyDisplayPrice ?? newSystemDisplayPrice ?? baseSalePrice ?? basePrice;
  const strikePrice = (variantSalePrice && variantPrice)
    ? variantPrice
    : (newValueSalePrice && newValuePrice ? newValuePrice : (baseSalePrice ? basePrice : null));

  // Custom box product type
  const isCustomBox = (product as any)?.type === 'custom_box';
  const { data: boxData } = trpc.customBox.getBoxItems.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: !!product?.id && isCustomBox }
  );
  const boxConfig = boxData?.config ?? null;
  const boxItems: any[] = boxData?.items ?? [];
  const boxTotalSelected = Object.values(boxSelections).reduce((sum, q) => sum + q, 0);
  const boxMax = boxConfig?.maxItems ?? 0;
  const boxMin = boxConfig?.minItems ?? 1;
  const boxReady = boxTotalSelected >= boxMin && boxTotalSelected <= boxMax;

  const handleAddBoxToCart = () => {
    if (!product || !boxReady) return;
    // Add the box as a single cart item with the box product price
    addItem({
      productId: product.id,
      name: cleanName(product.name),
      slug: product.slug,
      image: displayImages[0],
      price: displayPrice,
      quantity: 1,
      qtyValue: 1,
      measurementType: 'unit',
      variantId: undefined,
      shippingClassId: (selectedVariant as any)?.shippingClassId ?? (product as any).shippingClassId ?? null,
      kuwaitOnly: (selectedVariant as any)?.kuwaitOnly ?? (product as any).kuwaitOnly ?? false,
      customBoxSelections: Object.entries(boxSelections)
        .filter(([, q]) => q > 0)
        .map(([variantId, qty]) => {
          const item = boxItems.find((i: any) => i.variantId === Number(variantId));
          return {
            variantId: Number(variantId),
            qty,
            variantName: item?.variantName ?? '',
            productName: item?.productName ?? '',
            variantImage: item?.variantImage ?? null,
          };
        }),
    } as any);
    setBoxAddedToCart(true);
    toast.success(`${cleanName(product.name)} added to cart`);
    setTimeout(() => { setBoxAddedToCart(false); setBoxSelections({}); }, 2000);
  };

  // Stock — for bundle products use bundleStock (min of component stocks), otherwise use variant/product stock
  const isBundle = (product as any)?.type === 'bundle';
  const bundleStock = selectedVariant?.bundleStock ?? null;
  // stock === -1 means no inventory record exists yet (treat as in-stock)
  const rawStock = isBundle
    ? (bundleStock !== null ? bundleStock : 0)
    : (selectedVariant ? (selectedVariant.stock ?? -1) : ((product as any)?.stockQuantity ?? -1));
  const variantStock = rawStock; // -1 = unconfigured (show as in-stock), 0 = out of stock, >0 = in stock
  const isOutOfStock = variantStock === 0; // only show OOS when explicitly 0
  // P7: Pre-order availability (variant must have preOrderEnabled=true and preOrderUsed < preOrderLimit)
  const isPreOrderAvailable = !!(selectedVariant as any)?.isPreOrderAvailable;
  const bundleComponents: Array<{
    componentVariantId: number;
    qty: number;
    stock: number;
    availableUnits: number;
    variantName?: string | null;
    variantSku?: string | null;
    variantImage?: string | null;
    productName?: string | null;
    productSlug?: string | null;
  }> = selectedVariant?.bundleComponents ?? [];

  const handleSelect = (attrName: string, option: string) => {
    setSelections(prev => ({ ...prev, [attrName]: option }));
    setCurrentImage(0);
  };

  const measurementType: string = (product as any)?.measurementType || 'unit';
  const isUnitBased = measurementType === 'unit';
  const effectiveQtyValue = isUnitBased ? quantity : qtyValue;
  const totalDisplayPrice = parseFloat((displayPrice * effectiveQtyValue).toFixed(3));

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      name: cleanName(product.name),
      slug: product.slug,
      image: displayImages[0],
      price: displayPrice,
      quantity: isUnitBased ? quantity : 1,
      qtyValue: effectiveQtyValue,
      measurementType: measurementType as any,
      variantId: selectedVariant?.id || undefined,
      shippingClassId: (selectedVariant as any)?.shippingClassId ?? (product as any).shippingClassId ?? null,
      kuwaitOnly: (selectedVariant as any)?.kuwaitOnly ?? (product as any).kuwaitOnly ?? false,
    });
    setAddedToCart(true);
    toast.success(`${cleanName(product.name)} added to cart`);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const prevImage = () => setCurrentImage(i => (i === 0 ? displayImages.length - 1 : i - 1));
  const nextImage = () => setCurrentImage(i => (i === displayImages.length - 1 ? 0 : i + 1));

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
          <h1 className="text-3xl font-light mb-4" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            Product Not Found
          </h1>
          <p className="text-sm mb-8" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
            The product you are looking for does not exist or has been removed.
          </p>
          <Link href="/shop" className="btn-obsidian inline-block">Back to Shop</Link>
        </div>
      </Layout>
    );
  }

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
            <span style={{ color: '#242424' }}>{cleanName(product.name)}</span>
          </nav>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20">

          {/* ── Image Gallery ─────────────────────────────────────────── */}
          <div>
            <div className="relative overflow-hidden mb-4 bg-gray-50" style={{ aspectRatio: '4/5' }}>
              <img
                src={displayImages[currentImage] || PLACEHOLDER_IMG}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {displayImages.length > 1 && (
                <>
                  <button onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white transition-colors shadow-sm">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white transition-colors shadow-sm">
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
              {strikePrice && (
                <span className="absolute top-4 left-4 text-[10px] font-semibold tracking-widest uppercase px-2 py-1"
                  style={{ backgroundColor: '#C0392B', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>Sale</span>
              )}
            </div>
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
            {(product as any).sku && (
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-2"
                style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                SKU: {(product as any).sku}
              </p>
            )}
            <h1 className="text-3xl md:text-4xl font-light mb-4"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              {cleanName(product.name)}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-4 mb-6">
              <span className="text-2xl font-medium italic"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                {displayPrice.toFixed(3)} KWD
              </span>
              {strikePrice && (
                <span className="text-lg line-through"
                  style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                  {strikePrice.toFixed(3)} KWD
                </span>
              )}
            </div>

            <div className="w-12 mb-6" style={{ height: '1px', backgroundColor: '#E8E4DC' }} />

            {/* Fixed attributes (single-value) — shown as labels — legacy fallback */}
            {!hasNewAttrs && fixed.map(({ name, value }) => (
              <div key={name} className="mb-4">
                <p className="text-xs font-semibold tracking-widest uppercase mb-1"
                  style={{ fontFamily: 'Montserrat, sans-serif', color: '#8A8A82' }}>
                  {name}
                </p>
                <p className="text-sm" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                  {value}
                </p>
              </div>
            ))}

            {/* ── NEW-SYSTEM attribute selectors ─────────────────────────── */}
            {hasNewAttrs && (newAttrs as any[]).map((pa: any) => {
              const attr = pa.attribute;
              const values: any[] = getProductVisibleAttributeValues(pa);
              const selectedValueId = attrSelections[pa.attributeId];
              const displayType: 'button' | 'color' | 'image' = attr?.displayType ?? 'button';

              return (
                <div key={pa.attributeId} className="mb-6">
                  <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                    style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                    {attr?.name ?? `Attribute #${pa.attributeId}`}
                    {selectedValueId && (() => {
                      const sv = values.find((v: any) => v.id === selectedValueId);
                      return sv ? (
                        <span className="ml-2 font-normal normal-case text-[11px]" style={{ color: '#9D7D39' }}>
                          — {sv.labelEn}
                        </span>
                      ) : null;
                    })()}
                  </p>

                  <div className="flex flex-row flex-wrap items-start gap-2">
                    {values.filter((v: any) => v.isEnabled !== false).map((v: any) => {
                      const isSelected = selectedValueId === v.id;
                      const stock = stockMap[v.id];
                      const valueOutOfStock = stock ? stock.onlineQty === 0 : false;
                      const showroomOnly = valueOutOfStock && stock && stock.posQty > 0;

                      const imageSwatchUrl = getAttributeValueImage(v);
                      if (displayType === 'image' && imageSwatchUrl) {
                        return (
                          <button key={v.id}
                            onClick={() => !valueOutOfStock && setAttrSelections(prev => ({ ...prev, [pa.attributeId]: v.id }))}
                            title={v.labelEn}
                            disabled={valueOutOfStock && !showroomOnly}
                            className="relative flex-shrink-0 overflow-hidden transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              width: 56, height: 56,
                              border: isSelected ? '2px solid #9D7D39' : '2px solid transparent',
                              outline: isSelected ? '1px solid #9D7D39' : '1px solid #D4C9B8',
                              outlineOffset: isSelected ? 2 : 0,
                            }}>
                            <img src={imageSwatchUrl} alt={v.labelEn} className="w-full h-full object-cover" />
                            {valueOutOfStock && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                                <div className="w-full h-px bg-gray-400 rotate-45" />
                              </div>
                            )}
                          </button>
                        );
                      }

                      if (displayType === 'color' && v.swatch) {
                        return (
                          <button key={v.id}
                            onClick={() => !valueOutOfStock && setAttrSelections(prev => ({ ...prev, [pa.attributeId]: v.id }))}
                            title={v.labelEn}
                            disabled={valueOutOfStock && !showroomOnly}
                            className="relative flex-shrink-0 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              width: 32, height: 32,
                              backgroundColor: v.swatch,
                              border: isSelected ? '3px solid #9D7D39' : '3px solid transparent',
                              outline: '1px solid #D4C9B8',
                              outlineOffset: isSelected ? 2 : 0,
                            }}>
                            {valueOutOfStock && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-full h-px bg-gray-400 rotate-45" />
                              </div>
                            )}
                          </button>
                        );
                      }

                      // Button type (default)
                      return (
                        <button key={v.id}
                          onClick={() => !valueOutOfStock && setAttrSelections(prev => ({ ...prev, [pa.attributeId]: v.id }))}
                          disabled={valueOutOfStock && !showroomOnly}
                          className="px-4 py-2 text-xs border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            borderColor: isSelected ? '#9D7D39' : '#D4C9B8',
                            backgroundColor: isSelected ? '#9D7D39' : 'transparent',
                            color: isSelected ? '#FAFAF8' : '#242424',
                            fontFamily: 'Montserrat, sans-serif',
                          }}>
                          {v.labelEn}
                          {valueOutOfStock && !showroomOnly && ' — Out of stock'}
                          {showroomOnly && ' — Showroom only'}
                        </button>
                      );
                    })}
                  </div>

                  {/* Attribute description (HTML) shown when a value is selected */}
                  {selectedValueId && attr?.descriptionEn && (
                    <div className="mt-3 text-sm leading-relaxed p-3 rounded"
                      style={{ backgroundColor: '#F5F2EC', color: '#4A4A48', fontFamily: 'Montserrat, sans-serif' }}
                      dangerouslySetInnerHTML={{ __html: attr.descriptionEn }} />
                  )}
                </div>
              );
            })}

            {/* ── Legacy fallback selectors (only when no new-system attrs) ── */}
            {!hasNewAttrs && selectable.map(({ name, options }) => {
              const selectedOption = selections[name];
              return (
                <div key={name} className="mb-6">
                  <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                    style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                    {name}
                    {selectedOption && (
                      <span className="ml-2 font-normal normal-case text-[11px]"
                        style={{ color: '#9D7D39' }}>
                        — {selectedOption}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-row flex-wrap items-start gap-2">
                    {options.map(option => {
                      const optionImg = getOptionImage(liveVariants, name, option);
                      const isSelected = selectedOption === option;
                      const matchVariant = liveVariants.find(v => {
                        const attrs = parseAttrs(v.attributes);
                        return attrs.some(a => a.name === name && a.option === option);
                      });
                      const isOutOfStock = matchVariant && (
                        isBundle
                          ? (matchVariant.bundleStock !== null && matchVariant.bundleStock !== undefined ? matchVariant.bundleStock === 0 : false)
                          : (matchVariant.stock !== undefined && matchVariant.stock !== null && matchVariant.stock !== -1 ? matchVariant.stock === 0 : false)
                      );

                      if (optionImg) {
                        return (
                          <button key={option}
                            onClick={() => !isOutOfStock && handleSelect(name, option)}
                            title={option}
                            disabled={isOutOfStock}
                            className="relative flex-shrink-0 overflow-hidden transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              width: 56, height: 56,
                              border: isSelected ? '2px solid #9D7D39' : '2px solid transparent',
                              outline: isSelected ? '1px solid #9D7D39' : '1px solid #D4C9B8',
                              outlineOffset: isSelected ? 2 : 0,
                            }}>
                            <img src={optionImg} alt={option} className="w-full h-full object-cover" />
                            {isOutOfStock && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                                <div className="w-full h-px bg-gray-400 rotate-45" />
                              </div>
                            )}
                          </button>
                        );
                      }

                      return (
                        <button key={option}
                          onClick={() => !isOutOfStock && handleSelect(name, option)}
                          disabled={isOutOfStock}
                          className="px-4 py-2 text-xs border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            borderColor: isSelected ? '#9D7D39' : '#D4C9B8',
                            backgroundColor: isSelected ? '#9D7D39' : 'transparent',
                            color: isSelected ? '#FAFAF8' : '#242424',
                            fontFamily: 'Montserrat, sans-serif',
                          }}>
                          {option}
                          {isOutOfStock && ' — Out of stock'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {selectedVariant?.htmlBlockEnabled && selectedVariant?.htmlBlockContent?.trim() && (
              <div
                className="mb-3 text-sm leading-relaxed"
                style={{ color: '#4A4A48', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: selectedVariant.htmlBlockContent }}
              />
            )}

            {/* Quantity / Measurement input */}
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                {isUnitBased ? 'Quantity' : `Quantity (${measurementType})`}
              </p>
              {isUnitBased ? (
                <div className="flex items-center border w-32" style={{ borderColor: '#D4C9B8' }}>
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors">
                    <Minus size={14} />
                  </button>
                  <span className="flex-1 text-center text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {quantity}
                  </span>
                  <button onClick={() => setQuantity(q => q + 1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors">
                    <Plus size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center border" style={{ borderColor: '#D4C9B8' }}>
                    <input
                      type="number"
                      min="0.001"
                      step="0.5"
                      value={qtyValue}
                      onChange={e => setQtyValue(Math.max(0.001, parseFloat(e.target.value) || 0.001))}
                      className="w-24 h-10 text-center text-sm outline-none bg-transparent"
                      style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                    />
                    <span className="pr-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                      {measurementType}
                    </span>
                  </div>
                  <span className="text-sm" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                    = {totalDisplayPrice.toFixed(3)} KWD
                  </span>
                </div>
              )}
            </div>

            {/* Showroom-only message for new-system attributes */}
            {hasNewAttrs && newSystemStockStatus === 'showroom-only' && (
              <div className="mb-5 flex items-start gap-3 p-4 rounded"
                style={{ backgroundColor: '#FDF8F0', border: '1px solid #E8D9B8' }}>
                <MapPin size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#9D7D39' }} />
                <p className="text-xs leading-relaxed" style={{ color: '#4A4A48', fontFamily: 'Montserrat, sans-serif' }}>
                  This product is currently available at our showroom. You are welcome to visit us — we would love to assist you in person.
                </p>
              </div>
            )}

            {/* ── Custom Box Builder UI ─────────────────────────────── */}
            {isCustomBox && (
              <div className="mb-8">
                {/* Progress counter */}
                <div className="flex items-center justify-between mb-4 p-3 rounded"
                  style={{ backgroundColor: boxReady ? '#F0F7F0' : '#F5F2EC', border: `1px solid ${boxReady ? '#A8D5A2' : '#E8E4DC'}` }}>
                  <span className="text-xs font-semibold tracking-widest uppercase"
                    style={{ fontFamily: 'Montserrat, sans-serif', color: boxReady ? '#2E7D32' : '#8A8A82' }}>
                    {boxTotalSelected} / {boxMax} items selected
                  </span>
                  {boxMin > 0 && (
                    <span className="text-[10px]" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                      Min {boxMin} · Max {boxMax}
                    </span>
                  )}
                </div>

                {/* Items grid */}
                {boxItems.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                    No items configured for this box yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {boxItems.map((item: any) => {
                      const qty = boxSelections[item.variantId] ?? 0;
                      const img = item.variantImage || (Array.isArray(item.productImages) ? item.productImages[0] : null) || PLACEHOLDER_IMG;
                      const isOos = item.stock === 0;
                      return (
                        <div key={item.variantId}
                          className="relative border rounded overflow-hidden transition-all duration-200"
                          style={{ borderColor: qty > 0 ? '#9D7D39' : '#E8E4DC', opacity: isOos ? 0.5 : 1 }}>
                          <img src={img} alt={item.variantName || item.productName}
                            className="w-full object-cover" style={{ aspectRatio: '1/1' }} />
                          {qty > 0 && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                              style={{ backgroundColor: '#9D7D39', color: '#FAFAF8' }}>{qty}</div>
                          )}
                          {isOos && (
                            <div className="absolute inset-0 flex items-center justify-center"
                              style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}>
                              <span className="text-[10px] font-semibold" style={{ color: '#C0392B', fontFamily: 'Montserrat, sans-serif' }}>Out of Stock</span>
                            </div>
                          )}
                          <div className="p-2">
                            <p className="text-[10px] font-medium truncate mb-1" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                              {item.productName}
                            </p>
                            {item.variantName && (
                              <p className="text-[10px] truncate mb-2" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                                {item.variantName}
                              </p>
                            )}
                            {/* Qty controls */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setBoxSelections(prev => {
                                  const newQty = Math.max(0, (prev[item.variantId] ?? 0) - 1);
                                  const next = { ...prev };
                                  if (newQty === 0) delete next[item.variantId]; else next[item.variantId] = newQty;
                                  return next;
                                })}
                                disabled={qty === 0}
                                className="w-6 h-6 flex items-center justify-center border transition-colors disabled:opacity-30"
                                style={{ borderColor: '#D4C9B8', color: '#242424' }}>
                                <Minus size={10} />
                              </button>
                              <span className="flex-1 text-center text-xs" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>{qty}</span>
                              <button
                                onClick={() => {
                                  if (isOos) return;
                                  if (boxTotalSelected >= boxMax) { toast.error(`Box is full (max ${boxMax} items)`); return; }
                                  setBoxSelections(prev => ({ ...prev, [item.variantId]: (prev[item.variantId] ?? 0) + 1 }));
                                }}
                                disabled={isOos || boxTotalSelected >= boxMax}
                                className="w-6 h-6 flex items-center justify-center border transition-colors disabled:opacity-30"
                                style={{ borderColor: '#D4C9B8', color: '#242424' }}>
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Box to Cart button */}
                <div className="flex gap-3">
                  <button
                    onClick={handleAddBoxToCart}
                    disabled={!boxReady}
                    className="flex-1 py-4 text-xs font-semibold tracking-widest uppercase flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: boxAddedToCart ? '#2E7D32' : boxReady ? '#111110' : '#8A8A82',
                      color: '#FAFAF8',
                      fontFamily: 'Montserrat, sans-serif',
                    }}>
                    {boxAddedToCart
                      ? <><Check size={14} /> Added!</>
                      : !boxReady
                        ? `Select ${boxMin - boxTotalSelected > 0 ? boxMin - boxTotalSelected + ' more' : 'items'}`
                        : 'Add Box to Cart'}
                  </button>
                  <button
                    onClick={() => { setWishlisted(w => !w); toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist'); }}
                    className="w-14 flex items-center justify-center border transition-all duration-200"
                    style={{ borderColor: wishlisted ? '#9D7D39' : '#D4C9B8', color: wishlisted ? '#9D7D39' : '#242424' }}>
                    <Heart size={18} fill={wishlisted ? '#9D7D39' : 'none'} />
                  </button>
                </div>
              </div>
            )}

            {/* CTA buttons — hidden for custom_box products */}
            {!isCustomBox && (
            <div className="flex gap-3 mb-8">
              <button
                onClick={handleAddToCart}
                disabled={
                  hasNewAttrs
                    ? (!allNewAttrsSelected || newSystemStockStatus === 'out-of-stock' || newSystemStockStatus === 'showroom-only')
                    : ((selectable.length > 0 && !selectedVariant) || (isOutOfStock && !isPreOrderAvailable))
                }
                className="flex-1 py-4 text-xs font-semibold tracking-widest uppercase flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: addedToCart
                    ? '#2E7D32'
                    : (hasNewAttrs ? newSystemStockStatus === 'out-of-stock' || newSystemStockStatus === 'showroom-only' : (isOutOfStock && !isPreOrderAvailable))
                      ? '#8A8A82'
                      : isPreOrderAvailable && isOutOfStock ? '#9D7D39' : '#111110',
                  color: '#FAFAF8',
                  fontFamily: 'Montserrat, sans-serif',
                }}>
                {addedToCart
                  ? <><Check size={14} /> Added!</>
                  : hasNewAttrs
                    ? newSystemStockStatus === 'out-of-stock'
                      ? 'Out of Stock'
                      : newSystemStockStatus === 'showroom-only'
                        ? 'Visit Our Showroom'
                        : !allNewAttrsSelected
                          ? 'Select Options'
                          : 'Add to Cart'
                    : isOutOfStock && isPreOrderAvailable
                      ? 'Pre-Order Now'
                      : isOutOfStock
                        ? 'Out of Stock'
                        : selectable.length > 0 && !selectedVariant
                          ? 'Select Options'
                          : 'Add to Cart'}
              </button>
              <button
                onClick={() => { setWishlisted(w => !w); toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist'); }}
                className="w-14 flex items-center justify-center border transition-all duration-200"
                style={{ borderColor: wishlisted ? '#9D7D39' : '#D4C9B8', color: wishlisted ? '#9D7D39' : '#242424' }}>
                <Heart size={18} fill={wishlisted ? '#9D7D39' : 'none'} />
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}
                className="w-14 flex items-center justify-center border transition-all duration-200 hover:border-[#9D7D39]"
                style={{ borderColor: '#D4C9B8', color: '#242424' }}>
                <Share2 size={18} />
              </button>
            </div>
            )}
            {/* Stock status */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isOutOfStock && !isPreOrderAvailable ? '#C0392B' : isPreOrderAvailable && isOutOfStock ? '#9D7D39' : '#2E7D32' }} />
              <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                {isBundle
                  ? (bundleStock === null
                    ? 'Bundle stock not configured'
                    : bundleStock > 0
                      ? `In stock (${bundleStock} sets available)`
                      : 'Out of stock')
                  : isOutOfStock && isPreOrderAvailable
                    ? 'Pre-order available'
                    : (isOutOfStock ? 'Out of stock' : variantStock > 0 ? `In stock (${variantStock} available)` : 'In stock')}
              </span>
            </div>

            {/* Bundle components — shown when a bundle variant is selected */}
            {isBundle && selectedVariant && bundleComponents.length > 0 && (
              <div className="mb-8 border rounded-lg overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
                <div className="px-4 py-2.5 border-b" style={{ borderColor: '#E8E4DC', backgroundColor: '#F5F2EC' }}>
                  <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                    Bundle Includes
                  </p>
                </div>
                <div className="divide-y" style={{ borderColor: '#E8E4DC' }}>
                  {bundleComponents.map((comp) => (
                    <div key={comp.componentVariantId} className="flex items-center gap-3 px-4 py-2.5">
                      {/* Component image */}
                      {comp.variantImage ? (
                        <img src={comp.variantImage} alt={comp.variantName || ''}
                          className="w-9 h-9 object-cover flex-shrink-0"
                          style={{ border: '1px solid #E8E4DC' }} />
                      ) : (
                        <div className="w-9 h-9 flex-shrink-0" style={{ backgroundColor: '#F0EDE8', border: '1px solid #E8E4DC' }} />
                      )}
                      {/* Component name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                          {comp.productName || `Component #${comp.componentVariantId}`}
                        </p>
                        {comp.variantName && (
                          <p className="text-[10px] truncate" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            {comp.variantName}
                          </p>
                        )}
                      </div>
                      {/* Qty badge */}
                      <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                        ×{comp.qty}
                      </span>
                      {/* Stock indicator */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: comp.stock > 0 ? '#2E7D32' : '#C0392B' }} />
                        <span className="text-[10px]" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                          {comp.stock > 0 ? `${comp.stock}` : 'OOS'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="border-t pt-6" style={{ borderColor: '#E8E4DC' }}>
              <div className="flex gap-6 mb-4">
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
                  <div dangerouslySetInnerHTML={{ __html: cleanDescription((product as any).description || 'No description available.') }} />
                )}
                {activeTab === 'details' && (
                  <div>
                    {(product as any).weight && <p className="mb-2"><strong>Weight:</strong> {(product as any).weight} kg</p>}
                    {(product as any).dimensions && (
                      <p className="mb-2">
                        <strong>Dimensions:</strong>{' '}
                        {typeof (product as any).dimensions === 'string'
                          ? (product as any).dimensions
                          : JSON.stringify((product as any).dimensions)}
                      </p>
                    )}
                    {(product as any).sku && <p className="mb-2"><strong>SKU:</strong> {(product as any).sku}</p>}
                    {!(product as any).weight && !(product as any).dimensions && <p>No additional details available.</p>}
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
