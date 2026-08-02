/**
 * ProductDetail — Full product page
 * Design: Obsidian Editorial — Live data from tRPC
 * Variants grouped by attribute: fixed attributes shown as labels,
 * selectable attributes shown as image swatches or text buttons.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
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

// Parse a JSON array/string safely for gallery fields that can arrive either as JSON text or native arrays.
function parseGalleryImages(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Restrict storefront selectors to the values assigned to this product. The API also returns
// all global values for admin editing, so ProductDetail must honor productAttributes.activeValueIds.
function getActiveAttributeValues(productAttribute: any): any[] {
  const allValues: any[] = productAttribute?.allValues ?? [];
  const activeIds = Array.isArray(productAttribute?.activeValueIds)
    ? productAttribute.activeValueIds.map(Number).filter(Number.isFinite)
    : [];
  if (activeIds.length === 0) return [];
  const activeSet = new Set(activeIds);
  return allValues.filter((value: any) => activeSet.has(Number(value.id)));
}

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

function variantMatchesSelections(variant: any, selections: Record<string, string>): boolean {
  const selEntries = Object.entries(selections).filter(([, option]) => String(option || '').trim().length > 0);
  if (selEntries.length === 0) return false;
  const attrs = parseAttrs(variant?.attributes);
  return selEntries.every(([name, option]) =>
    attrs.some(a =>
      normalizeAttributeToken(a.name) === normalizeAttributeToken(name)
      && normalizeOptionToken(a.option) === normalizeOptionToken(option)
    )
  );
}

function findExactMatchingVariant(variants: any[], selections: Record<string, string>, requiredAttributeNames: string[]): any | null {
  const requiredNames = requiredAttributeNames.filter(Boolean);
  const selectedKeys = Object.keys(selections).filter((key) => String(selections[key] || '').trim().length > 0);
  if (requiredNames.length === 0 || selectedKeys.length < requiredNames.length) return null;

  return variants.find(v => {
    const attrs = parseAttrs(v.attributes);
    return requiredNames.every((requiredName) => {
      const selectedEntry = Object.entries(selections).find(([name]) => normalizeAttributeToken(name) === normalizeAttributeToken(requiredName));
      if (!selectedEntry) return false;
      const [, selectedOption] = selectedEntry;
      return attrs.some(a =>
        normalizeAttributeToken(a.name) === normalizeAttributeToken(requiredName)
        && normalizeOptionToken(a.option) === normalizeOptionToken(selectedOption)
      );
    });
  }) || null;
}

function getVariantAttributeMap(variant: any): Map<string, string> {
  const map = new Map<string, string>();
  for (const attr of parseAttrs(variant?.attributes)) {
    const name = normalizeAttributeToken(attr.name);
    const option = normalizeOptionToken(attr.option);
    if (name && option) map.set(name, option);
  }
  return map;
}

function variantCoversSelections(variant: any, selections: Record<string, string>): boolean {
  const entries = Object.entries(selections).filter(([, option]) => String(option || '').trim().length > 0);
  if (entries.length === 0) return false;
  const attrs = getVariantAttributeMap(variant);
  return entries.every(([name, option]) => {
    const normalizedName = normalizeAttributeToken(name);
    const normalizedOption = normalizeOptionToken(option);
    const variantOption = attrs.get(normalizedName);
    // Missing attribute on a variation row means WooCommerce-style "Any" for that attribute.
    return !variantOption || variantOption === normalizedOption;
  });
}

function variantSpecificityForSelections(variant: any, selections: Record<string, string>): number {
  const attrs = getVariantAttributeMap(variant);
  return Object.keys(selections).reduce((score, name) => score + (attrs.has(normalizeAttributeToken(name)) ? 1 : 0), 0);
}

function findResolvedMatchingVariant(variants: any[], selections: Record<string, string>, requiredAttributeNames: string[]): any | null {
  const requiredNames = requiredAttributeNames.filter(Boolean);
  const selectedKeys = Object.keys(selections).filter((key) => String(selections[key] || '').trim().length > 0);
  if (selectedKeys.length === 0) return null;

  const exact = requiredNames.length > 0 && selectedKeys.length >= requiredNames.length
    ? findExactMatchingVariant(variants, selections, requiredNames)
    : null;
  if (exact) return exact;

  const candidates = variants.filter((variant) => variantCoversSelections(variant, selections));
  candidates.sort((a, b) => variantSpecificityForSelections(b, selections) - variantSpecificityForSelections(a, selections));
  return candidates[0] ?? null;
}

function normalizeAttributeToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^select\s+/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeOptionToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isImageSource(value: any): boolean {
  const src = String(value || '').trim();
  if (!src || src.startsWith('#')) return false;
  return /^(https?:)?\/\//i.test(src)
    || src.startsWith('/')
    || src.startsWith('data:image/')
    || /\.(avif|webp|png|jpe?g|gif|svg)(\?|#|$)/i.test(src);
}

function getAttributeValueImage(value: any): string | null {
  if (isImageSource(value?.image)) return String(value.image).trim();
  if (isImageSource(value?.swatch)) return String(value.swatch).trim();
  return null;
}

// Get a product-specific image for an option from imported WooCommerce variants.
// This is required when the same global attribute value label is reused across products
// but WordPress assigned a different product/variation image on each product page.
function getVariantOptionImage(variants: any[], attrName: string, option: string): string | null {
  const targetAttr = normalizeAttributeToken(attrName);
  const targetOption = normalizeOptionToken(option);
  if (!targetOption) return null;

  const exact = variants.find(v => {
    const attrs = parseAttrs(v.attributes);
    return attrs.some(a =>
      normalizeAttributeToken(a.name) === targetAttr
      && normalizeOptionToken(a.option) === targetOption
    );
  });
  if (exact?.image) return String(exact.image);

  const optionOnly = variants.find(v => {
    const attrs = parseAttrs(v.attributes);
    return attrs.some(a => normalizeOptionToken(a.option) === targetOption);
  });
  return optionOnly?.image ? String(optionOnly.image) : null;
}

function getVariantWebsiteQty(variant: any): number | null {
  if (!variant) return null;
  const raw = variant.stock ?? variant.onlineQty ?? variant.websiteQty ?? null;
  if (raw === null || raw === undefined || raw === -1) return null;
  const qty = Number(raw);
  return Number.isFinite(qty) ? qty : null;
}

function hasPositiveWebsiteStock(variant: any): boolean {
  const qty = getVariantWebsiteQty(variant);
  return qty !== null && qty > 0;
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem, items: cartItems } = useCart();

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
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const userTouchedVariationRef = useRef(false);
  const lastScrolledVariantRef = useRef<string>('');

  const { locale } = useLanguage();

  const getAttributeValueLabel = (value: any): string => {
    if (!value) return '';
    const englishLabel = typeof value.labelEn === 'string' ? value.labelEn.trim() : (value.labelEn || '');
    const arabicLabel = typeof value.labelAr === 'string' ? value.labelAr.trim() : (value.labelAr || '');
    return locale === 'ar'
      ? (arabicLabel || englishLabel)
      : (englishLabel || arabicLabel);
  };

  const getAttributeDescription = (attribute: any): string => {
    if (!attribute) return '';
    const englishDescription = typeof attribute.descriptionEn === 'string' ? attribute.descriptionEn.trim() : (attribute.descriptionEn || '');
    const arabicDescription = typeof attribute.descriptionAr === 'string' ? attribute.descriptionAr.trim() : (attribute.descriptionAr || '');
    return locale === 'ar'
      ? (arabicDescription || englishDescription)
      : (englishDescription || arabicDescription);
  };

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

  const visibleNewAttrs = useMemo(
    () => (newAttrs as any[]).filter((pa: any) => getActiveAttributeValues(pa).some((v: any) => v.isEnabled !== false)),
    [newAttrs]
  );

  // Collect all selected value IDs for stock query
  const selectedValueIds = useMemo(() => Object.values(attrSelections), [attrSelections]);
  const allValueIds = useMemo(() => {
    const ids: number[] = [];
    for (const pa of visibleNewAttrs) {
      for (const v of getActiveAttributeValues(pa)) ids.push(v.id);
    }
    return ids;
  }, [visibleNewAttrs]);

  const { data: valueStocks = [] } = trpc.attributes.getValueStock.useQuery(
    { valueIds: allValueIds },
    { enabled: allValueIds.length > 0 }
  );

  const stockMap = useMemo(() => {
    const m: Record<number, { onlineQty: number; posQty: number; isBundle: boolean; manageStock?: boolean }> = {};
    for (const s of (valueStocks as any[])) m[s.valueId] = s;
    return m;
  }, [valueStocks]);

  // Determine if new-system attributes exist
  const hasNewAttrs = visibleNewAttrs.length > 0;

  // WooCommerce-compatible single-value rule: one-value attributes, especially Size,
  // are selected internally so the customer is not forced to click a fixed option.
  useEffect(() => {
    if (!hasNewAttrs) return;
    setAttrSelections(prev => {
      let changed = false;
      const next = { ...prev };
      for (const pa of visibleNewAttrs) {
        const enabledValues = getActiveAttributeValues(pa).filter((v: any) => v.isEnabled !== false);
        if (enabledValues.length === 1 && !next[pa.attributeId]) {
          next[pa.attributeId] = enabledValues[0].id;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [hasNewAttrs, visibleNewAttrs]);

  // For new-system: find selected value objects
  const selectedNewValues = useMemo(() => {
    const vals: any[] = [];
    for (const pa of visibleNewAttrs) {
      const valueId = attrSelections[pa.attributeId];
      if (valueId) {
        const v = getActiveAttributeValues(pa).find((v: any) => v.id === valueId);
        if (v) vals.push(v);
      }
    }
    return vals;
  }, [visibleNewAttrs, attrSelections]);

  // All required attributes selected?
  const allNewAttrsSelected = hasNewAttrs && visibleNewAttrs.every((pa: any) => !!attrSelections[pa.attributeId]);

  const getAttributeVariantName = (pa: any): string => {
    const attr = pa?.attribute ?? {};
    return String(attr.name ?? attr.labelEn ?? attr.nameEn ?? pa.name ?? pa.labelEn ?? `Attribute #${pa.attributeId}`);
  };

  // Map new-system selections back to the legacy variant attribute names/labels used by
  // imported WooCommerce rows, so selected legacy variants can still drive price/images.
  const newAttrVariantSelections = useMemo(() => {
    const mapped: Record<string, string> = {};
    for (const pa of visibleNewAttrs) {
      const valueId = attrSelections[pa.attributeId];
      if (!valueId) continue;
      const attr = pa.attribute ?? {};
      const attrName = attr.name ?? attr.labelEn ?? attr.nameEn ?? pa.name ?? pa.labelEn;
      const value = getActiveAttributeValues(pa).find((v: any) => v.id === valueId);
      const option = value?.labelEn ?? value?.name ?? value?.label;
      if (attrName && option) mapped[String(attrName)] = String(option);
    }
    return mapped;
  }, [visibleNewAttrs, attrSelections]);

  const requiredNewAttributeNames = useMemo(
    () => visibleNewAttrs.map((pa: any) => getAttributeVariantName(pa)),
    [visibleNewAttrs]
  );

  const galleryControllerAttribute = useMemo(() => {
    const explicit = visibleNewAttrs.find((pa: any) => pa.galleryControlling === true || pa.isImageMaster === true);
    if (explicit) return explicit;
    // Safe fallback for products not yet marked in admin: Color is the WooCommerce media controller
    // for Classic 225-style products. This is only a fallback; product_attributes.galleryControlling wins.
    return visibleNewAttrs.find((pa: any) => /color|colour/i.test(getAttributeVariantName(pa))) ?? null;
  }, [visibleNewAttrs]);

  const galleryControllerVariantSelections = useMemo(() => {
    if (!galleryControllerAttribute) return {};
    const valueId = attrSelections[galleryControllerAttribute.attributeId];
    if (!valueId) return {};
    const value = getActiveAttributeValues(galleryControllerAttribute).find((v: any) => v.id === valueId);
    const label = value ? getAttributeValueLabel(value) : '';
    const attrName = getAttributeVariantName(galleryControllerAttribute);
    return attrName && label ? { [attrName]: label } : {};
  }, [galleryControllerAttribute, attrSelections, locale]);

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

  // Stock status for new-system: resolved variation website stock is the commercial source of truth.
  const newSystemStockStatus = useMemo((): 'in-stock' | 'out-of-stock' | 'showroom-only' | 'unchecked' => {
    if (!allNewAttrsSelected) return 'unchecked';
    const resolvedVariant = findResolvedMatchingVariant(liveVariants, newAttrVariantSelections, requiredNewAttributeNames);
    return hasPositiveWebsiteStock(resolvedVariant) ? 'in-stock' : 'out-of-stock';
  }, [allNewAttrsSelected, liveVariants, newAttrVariantSelections, requiredNewAttributeNames]);

  // Build attribute groups
  const { fixed, selectable } = useMemo(() => buildAttrGroups(liveVariants), [liveVariants]);

  // Find the currently selected variant. Products migrated from WooCommerce may expose
  // the new attribute selector UI while the commercial variant rows still carry the
  // authoritative imported prices/images, so use mapped new-system selections first.
  const selectedVariant = useMemo(
    () => hasNewAttrs
      ? findResolvedMatchingVariant(liveVariants, newAttrVariantSelections, requiredNewAttributeNames)
      : findMatchingVariant(liveVariants, selections),
    [liveVariants, hasNewAttrs, newAttrVariantSelections, requiredNewAttributeNames, selections]
  );

  const galleryControllerVariant = useMemo(
    () => hasNewAttrs ? findMatchingVariant(liveVariants, galleryControllerVariantSelections) : null,
    [liveVariants, hasNewAttrs, galleryControllerVariantSelections]
  );

  const mediaVariant = hasNewAttrs ? (galleryControllerVariant || selectedVariant) : selectedVariant;

  // Images follow WooCommerce semantics: product media before selection; selected product-variation media after selection.
  const productImages = useMemo(() => {
    const rawImages = (product as any)?.images;
    const imgs: string[] = Array.isArray(rawImages)
      ? rawImages
      : (typeof rawImages === 'string' ? (() => { try { return JSON.parse(rawImages || '[]'); } catch { return []; } })() : []);
    return imgs.length > 0 ? imgs : [PLACEHOLDER_IMG];
  }, [product]);

  const variantImages = useMemo(() => {
    if (!mediaVariant) return null;
    const gallery = parseGalleryImages(mediaVariant.galleryImages);
    const imgs: string[] = [];
    if (mediaVariant.image) imgs.push(String(mediaVariant.image));
    imgs.push(...gallery);
    return imgs.length > 0 ? imgs : null;
  }, [mediaVariant]);

  const displayImages = variantImages || productImages;

  const displayImageKey = displayImages.join('|');
  useEffect(() => {
    setCurrentImage(0);
  }, [displayImageKey]);

  useEffect(() => {
    if (!hasNewAttrs || !userTouchedVariationRef.current || !allNewAttrsSelected || !selectedVariant) return;
    const signature = `${selectedVariant.id}:${Object.entries(attrSelections).sort(([a], [b]) => Number(a) - Number(b)).map(([a, v]) => `${a}=${v}`).join('|')}`;
    if (signature === lastScrolledVariantRef.current) return;
    lastScrolledVariantRef.current = signature;
    window.requestAnimationFrame(() => {
      galleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [hasNewAttrs, allNewAttrsSelected, selectedVariant?.id, attrSelections]);

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
      shippingClassId: (product as any).shippingClassId ?? null,
      kuwaitOnly: (product as any).kuwaitOnly ?? false,
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

  const measurementType: string = (product as any)?.measurementType || 'unit';
  const isUnitBased = measurementType === 'unit';

  // Stock — for bundle products use bundleStock (min of component stocks), otherwise use variant/product stock
  const isBundle = (product as any)?.type === 'bundle';
  const bundleStock = selectedVariant?.bundleStock ?? null;
  // stock === -1 means no inventory record exists yet (treat as in-stock)
  const rawStock = isBundle
    ? (bundleStock !== null ? bundleStock : 0)
    : (selectedVariant ? (selectedVariant.stock ?? -1) : ((product as any)?.stockQuantity ?? -1));
  const variantStock = rawStock; // -1 = unconfigured (show as in-stock), 0 = out of stock, >0 = in stock
  const maxPurchasableQty = isUnitBased && Number.isFinite(Number(variantStock)) && Number(variantStock) > 0 ? Number(variantStock) : null;
  const existingCartQty = useMemo(() => {
    if (!product || !isUnitBased) return 0;
    return cartItems
      .filter((item: any) => item.productId === product.id && item.variantId === (selectedVariant?.id || undefined))
      .reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  }, [cartItems, product?.id, selectedVariant?.id, isUnitBased]);
  const remainingPurchasableQty = maxPurchasableQty === null ? null : Math.max(0, maxPurchasableQty - existingCartQty);
  const isSelectedQuantityUnavailable = maxPurchasableQty !== null && quantity > remainingPurchasableQty;

  useEffect(() => {
    if (!isUnitBased || remainingPurchasableQty === null) return;
    setQuantity((q) => Math.max(1, Math.min(q, Math.max(1, remainingPurchasableQty))));
  }, [isUnitBased, remainingPurchasableQty]);

  const isOutOfStock = variantStock === 0 || remainingPurchasableQty === 0; // only show OOS when explicitly 0 or cart already reached the stock ceiling
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
    userTouchedVariationRef.current = true;
    setSelections(prev => {
      const next = { ...prev };
      if (next[attrName] === option) delete next[attrName];
      else next[attrName] = option;
      return next;
    });
    setCurrentImage(0);
  };

  const toggleAttributeSelection = (attributeId: number, valueId: number) => {
    userTouchedVariationRef.current = true;
    setAttrSelections(prev => {
      const next = { ...prev };
      if (next[attributeId] === valueId) delete next[attributeId];
      else next[attributeId] = valueId;
      return next;
    });
    setCurrentImage(0);
  };


  const resolveNewAttributeCandidateVariant = (pa: any, value: any): any | null => {
    const attrName = getAttributeVariantName(pa);
    const valueLabel = getAttributeValueLabel(value);
    const candidateSelections = { ...newAttrVariantSelections, [attrName]: valueLabel };
    return findResolvedMatchingVariant(liveVariants, candidateSelections, requiredNewAttributeNames);
  };

  const isNewAttributeValueAvailable = (pa: any, value: any): boolean => {
    if (!hasNewAttrs || liveVariants.length === 0) return true;
    const displayType = String(pa?.attribute?.displayType ?? 'button');
    const controlsGallery = pa?.galleryControlling === true || pa?.isImageMaster === true;
    const attrName = getAttributeVariantName(pa);
    const valueLabel = getAttributeValueLabel(value);
    const candidateSelections = { ...newAttrVariantSelections, [attrName]: valueLabel };

    if (displayType === 'image') {
      const resolvedVariant = findResolvedMatchingVariant(liveVariants, candidateSelections, requiredNewAttributeNames);
      return hasPositiveWebsiteStock(resolvedVariant);
    }

    return liveVariants.some((variant) => variantMatchesSelections(variant, candidateSelections));
  };

  const effectiveQtyValue = isUnitBased ? quantity : qtyValue;
  const totalDisplayPrice = parseFloat((displayPrice * effectiveQtyValue).toFixed(3));

  const handleAddToCart = () => {
    if (!product) return;
    if (isUnitBased && remainingPurchasableQty !== null && remainingPurchasableQty <= 0) {
      toast.error(`Only ${maxPurchasableQty} available for this selection`);
      return;
    }
    addItem({
      productId: product.id,
      name: cleanName(product.name),
      slug: product.slug,
      image: displayImages[0],
      price: displayPrice,
      quantity: isUnitBased ? (remainingPurchasableQty === null ? quantity : Math.min(quantity, remainingPurchasableQty)) : 1,
      qtyValue: isUnitBased ? (remainingPurchasableQty === null ? quantity : Math.min(quantity, remainingPurchasableQty)) : effectiveQtyValue,
      measurementType: measurementType as any,
      variantId: selectedVariant?.id || undefined,
      shippingClassId: (product as any).shippingClassId ?? null,
      kuwaitOnly: (product as any).kuwaitOnly ?? false,
      maxStock: maxPurchasableQty ?? undefined,
    } as any);
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
          <div ref={galleryRef}>
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
            {hasNewAttrs && visibleNewAttrs.map((pa: any) => {
              const attr = pa.attribute;
              const values: any[] = getActiveAttributeValues(pa);
              const enabledValues = values.filter((v: any) => v.isEnabled !== false);
              const selectedValueId = attrSelections[pa.attributeId];
              const displayType = String(attr?.displayType ?? 'button') as 'button' | 'color' | 'image' | 'radio' | 'default';
              const attrNameForVariant = getAttributeVariantName(pa);
              const isSingleInformational = enabledValues.length === 1 && /size|dimension/i.test(attrNameForVariant);

              return (
                <div key={pa.attributeId} className="mb-6">
                  <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                    style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                    {attrNameForVariant}
                    {selectedValueId && (() => {
                      const sv = values.find((v: any) => v.id === selectedValueId);
                      return sv ? (
                        <span className="ml-2 font-normal normal-case text-[11px]" style={{ color: '#9D7D39' }}>
                          — {getAttributeValueLabel(sv)}
                        </span>
                      ) : null;
                    })()}
                  </p>

                  {isSingleInformational && selectedValueId ? (
                    <p className="text-sm" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                      {getAttributeValueLabel(enabledValues[0])}
                    </p>
                  ) : (
                  <div className="flex flex-wrap gap-2">
                    {enabledValues.map((v: any) => {
                      const isSelected = selectedValueId === v.id;
                      const stock = stockMap[v.id];
                      const valueLabel = getAttributeValueLabel(v);
                      const isStockManagedImageChoice = displayType === 'image';
                      const resolvedVariantForChoice = isStockManagedImageChoice ? resolveNewAttributeCandidateVariant(pa, v) : null;
                      const resolvedWebsiteQty = getVariantWebsiteQty(resolvedVariantForChoice);
                      const valueOutOfStock = isStockManagedImageChoice
                        ? !hasPositiveWebsiteStock(resolvedVariantForChoice)
                        : (stock ? stock.onlineQty === 0 : false);
                      const showroomOnly = !isStockManagedImageChoice && valueOutOfStock && stock && stock.posQty > 0;
                      const combinationUnavailable = isStockManagedImageChoice
                        ? !resolvedVariantForChoice
                        : !isNewAttributeValueAvailable(pa, v);
                      const isDisabled = valueOutOfStock || combinationUnavailable;
                      const attrName = attrNameForVariant;
                      const optionImage = displayType === 'image'
                        ? (getAttributeValueImage(v) || getVariantOptionImage(liveVariants, attrName, valueLabel))
                        : null;

                      if (displayType === 'image') {
                        return (
                          <button key={v.id}
                            onClick={() => !isDisabled && toggleAttributeSelection(pa.attributeId, v.id)}
                            title={valueLabel}
                            disabled={isDisabled}
                            className="relative flex-shrink-0 overflow-hidden transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              width: 56, height: 56,
                              border: isSelected ? '2px solid #9D7D39' : '2px solid transparent',
                              outline: isSelected ? '1px solid #9D7D39' : '1px solid #D4C9B8',
                              outlineOffset: isSelected ? 2 : 0,
                              backgroundColor: '#F5F2EC',
                            }}>
                            {optionImage ? (
                              <img src={optionImage} alt={valueLabel} className="w-full h-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] leading-tight" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                                {valueLabel}
                              </span>
                            )}
                            {isDisabled && (
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
                            onClick={() => !isDisabled && toggleAttributeSelection(pa.attributeId, v.id)}
                            title={valueLabel}
                            disabled={isDisabled}
                            className="relative flex-shrink-0 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              width: 32, height: 32,
                              backgroundColor: v.swatch,
                              border: isSelected ? '3px solid #9D7D39' : '3px solid transparent',
                              outline: '1px solid #D4C9B8',
                              outlineOffset: isSelected ? 2 : 0,
                            }}>
                            {isDisabled && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-full h-px bg-gray-400 rotate-45" />
                              </div>
                            )}
                          </button>
                        );
                      }

                      if (displayType === 'radio') {
                        return (
                          <label key={v.id}
                            className="flex items-center gap-2 px-3 py-2 text-xs border transition-all duration-200 cursor-pointer has-[:disabled]:opacity-40 has-[:disabled]:cursor-not-allowed"
                            style={{
                              borderColor: isSelected ? '#9D7D39' : '#D4C9B8',
                              backgroundColor: isSelected ? '#F5F2EC' : 'transparent',
                              color: '#242424',
                              fontFamily: 'Montserrat, sans-serif',
                            }}>
                            <input
                              type="radio"
                              name={`attr-${pa.attributeId}`}
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={() => !isDisabled && toggleAttributeSelection(pa.attributeId, v.id)}
                            />
                            <span>{valueLabel}{combinationUnavailable ? ' — Unavailable' : valueOutOfStock && !showroomOnly ? ' — Out of stock' : showroomOnly ? ' — Showroom only' : ''}</span>
                          </label>
                        );
                      }

                      // Button/default text type
                      return (
                        <button key={v.id}
                          onClick={() => !isDisabled && toggleAttributeSelection(pa.attributeId, v.id)}
                          disabled={isDisabled}
                          className="px-4 py-2 text-xs border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            borderColor: isSelected ? '#9D7D39' : '#D4C9B8',
                            backgroundColor: isSelected ? '#9D7D39' : 'transparent',
                            color: isSelected ? '#FAFAF8' : '#242424',
                            fontFamily: 'Montserrat, sans-serif',
                          }}>
                          {valueLabel}
                          {combinationUnavailable && ' — Unavailable'}
                          {!combinationUnavailable && valueOutOfStock && !showroomOnly && ' — Out of stock'}
                          {!combinationUnavailable && showroomOnly && ' — Showroom only'}
                        </button>
                      );
                    })}
                  </div>
                  )}

                  {/* Attribute description (HTML) shown when a value is selected */}
                  {selectedValueId && getAttributeDescription(attr) && (
                    <div className="mt-3 text-sm leading-relaxed p-3 rounded"
                      style={{ backgroundColor: '#F5F2EC', color: '#4A4A48', fontFamily: 'Montserrat, sans-serif' }}
                      dangerouslySetInnerHTML={{ __html: getAttributeDescription(attr) }} />
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
                  <div className="flex flex-wrap gap-2">
                    {options.map(option => {
                      const optionImg = getVariantOptionImage(liveVariants, name, option);
                      const isSelected = selectedOption === option;
                      const candidateSelections = { ...selections, [name]: option };
                      const matchVariant = findResolvedMatchingVariant(liveVariants, candidateSelections, selectable.map((group) => group.name));
                      const isOutOfStock = isBundle
                        ? !!matchVariant && matchVariant.bundleStock !== null && matchVariant.bundleStock !== undefined && matchVariant.bundleStock === 0
                        : !hasPositiveWebsiteStock(matchVariant);

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
                  <button onClick={() => setQuantity(q => remainingPurchasableQty === null ? q + 1 : Math.min(remainingPurchasableQty, q + 1))}
                    disabled={remainingPurchasableQty !== null && quantity >= remainingPurchasableQty}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
                    ? (!allNewAttrsSelected || newSystemStockStatus === 'out-of-stock' || newSystemStockStatus === 'showroom-only' || isSelectedQuantityUnavailable)
                    : ((selectable.length > 0 && !selectedVariant) || (isOutOfStock && !isPreOrderAvailable) || isSelectedQuantityUnavailable)
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
                          : isSelectedQuantityUnavailable
                            ? `Only ${remainingPurchasableQty} Available`
                            : 'Add to Cart'
                    : isOutOfStock && isPreOrderAvailable
                      ? 'Pre-Order Now'
                      : isOutOfStock
                        ? 'Out of Stock'
                        : selectable.length > 0 && !selectedVariant
                          ? 'Select Options'
                          : isSelectedQuantityUnavailable
                            ? `Only ${remainingPurchasableQty} Available`
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
