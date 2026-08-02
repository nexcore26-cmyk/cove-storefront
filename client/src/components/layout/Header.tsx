/**
 * Header — tenant-controlled JSON header renderer.
 * Menu Builder remains the navigation data source; Header Builder controls layout.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { ShoppingBag, Search, User, Menu, X, ChevronDown, ChevronRight, Heart, MapPin, Globe, Mail, Phone } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

type PublicNavLink = {
  id?: number;
  parentId?: number | null;
  label: string;
  labelAr?: string | null;
  href: string;
  target?: 'self' | 'blank' | string;
  sortOrder?: number;
  isVisible?: boolean;
  children?: PublicNavLink[];
};

type HeaderElementType =
  | 'logo' | 'mainMenu' | 'secondaryMenu' | 'mobileMenu' | 'mobileMenuIcon' | 'search' | 'cart' | 'wishlist'
  | 'account' | 'categoriesMenu' | 'textHtml' | 'button' | 'socialIcons' | 'languageSwitcher' | 'divider' | 'space';

export type HeaderElement = { id: string; type: HeaderElementType; label?: string; html?: string; href?: string; menuKey?: string; width?: number; logoSrc?: string; settings?: Record<string, any> };
export type HeaderRow = { enabled: boolean; height: number; backgroundColor: string; backgroundImage?: string; textColor: string; activeTextColor?: string; borderBottom: boolean; borderBottomColor?: string; borderBottomHeight?: number; columns: { left: HeaderElement[]; center: HeaderElement[]; right: HeaderElement[] } };
export type HeaderSettings = { desktop: Record<'topBar' | 'mainHeader' | 'bottomHeader', HeaderRow>; mobile: Record<'topBar' | 'mainHeader' | 'bottomHeader', HeaderRow> };

const fallbackNavLinks: PublicNavLink[] = [
  { id: -1, parentId: null, label: 'Collections', labelAr: 'المجموعات', href: '/pages/collections', sortOrder: 0 },
  { id: -2, parentId: null, label: 'Company Portfolio', labelAr: 'معرض الأعمال', href: '/pages/projects', sortOrder: 10 },
  { id: -3, parentId: null, label: 'Client Services', labelAr: 'خدمات العملاء', href: '/pages/client-services', sortOrder: 20 },
  { id: -4, parentId: null, label: 'About', labelAr: 'عن كوف', href: '/pages/about', sortOrder: 30 },
  { id: -5, parentId: null, label: 'Events', labelAr: 'الفعاليات', href: '/pages/events', sortOrder: 40 },
  { id: -6, parentId: null, label: 'Contact', labelAr: 'اتصل بنا', href: '/pages/contact', sortOrder: 50 },
];

const rowKeys = ['topBar', 'mainHeader', 'bottomHeader'] as const;

const makeRow = (overrides: Partial<HeaderRow> = {}): HeaderRow => {
  const { columns, ...rest } = overrides;
  return {
    enabled: true,
    height: 64,
    backgroundColor: '#111110',
    textColor: '#FAFAF8',
    borderBottom: false,
    ...rest,
    columns: { left: [], center: [], right: [], ...(columns || {}) },
  };
};

const fallbackHeaderSettings = (): HeaderSettings => ({
  desktop: {
    topBar: makeRow({ height: 32, backgroundColor: '#9D7D39', textColor: '#FAFAF8', columns: { left: [], center: [{ id: 'desktop-shipping-text', type: 'textHtml', html: 'Free shipping on orders over 50 KWD — Kuwait & GCC' }], right: [] } }),
    mainHeader: makeRow({ height: 64, backgroundColor: '#111110', textColor: '#FAFAF8', columns: { left: [{ id: 'desktop-logo', type: 'logo' }], center: [{ id: 'desktop-main-menu', type: 'mainMenu', menuKey: 'header' }], right: [{ id: 'desktop-language', type: 'languageSwitcher' }, { id: 'desktop-search', type: 'search' }, { id: 'desktop-account', type: 'account' }, { id: 'desktop-wishlist', type: 'wishlist' }, { id: 'desktop-cart', type: 'cart' }] } }),
    bottomHeader: makeRow({ enabled: false, height: 44, backgroundColor: '#111110', textColor: '#FAFAF8', borderBottom: true }),
  },
  mobile: {
    topBar: makeRow({ enabled: false, height: 30, backgroundColor: '#9D7D39', textColor: '#FAFAF8', columns: { left: [], center: [{ id: 'mobile-top-text', type: 'textHtml', html: 'Free shipping over 50 KWD' }], right: [] } }),
    mainHeader: makeRow({ height: 58, backgroundColor: '#111110', textColor: '#FAFAF8', columns: { left: [{ id: 'mobile-menu-icon', type: 'mobileMenuIcon' }], center: [{ id: 'mobile-logo', type: 'logo' }], right: [{ id: 'mobile-search', type: 'search' }, { id: 'mobile-cart', type: 'cart' }] } }),
    bottomHeader: makeRow({ enabled: false, height: 44, backgroundColor: '#111110', textColor: '#FAFAF8' }),
  },
});

export function normalizeHeaderSettings(value: any): HeaderSettings {
  const defaults = fallbackHeaderSettings();
  if (!value) return defaults;
  (['desktop', 'mobile'] as const).forEach((device) => rowKeys.forEach((rowKey) => {
    const row = value?.[device]?.[rowKey] || {};
    defaults[device][rowKey] = makeRow({ ...defaults[device][rowKey], ...row, columns: { ...defaults[device][rowKey].columns, ...(row.columns || {}) } });
  }));
  return defaults;
}

export function getHeaderDeviceHeight(settings: HeaderSettings, device: 'desktop' | 'mobile') {
  return rowKeys.reduce((total, rowKey) => {
    const row = settings[device][rowKey];
    return total + (row.enabled ? Number(row.height || 0) : 0);
  }, 0);
}

function buildNavTree(items: PublicNavLink[]) {
  const visibleItems = items.filter((item) => item.isVisible !== false);
  const byParent = new Map<number | null, PublicNavLink[]>();
  visibleItems.forEach((item) => {
    const parentId = item.parentId ?? null;
    const siblings = byParent.get(parentId) || [];
    siblings.push({ ...item, children: [] });
    byParent.set(parentId, siblings);
  });
  byParent.forEach((siblings) => siblings.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0)));
  const attachChildren = (parentId: number | null): PublicNavLink[] => (byParent.get(parentId) || []).map((item) => ({ ...item, children: attachChildren(item.id ?? 0) }));
  return attachChildren(null);
}

function linkLabel(link: PublicNavLink, locale: string) { return locale === 'en' ? link.label : (link.labelAr || link.label); }
function linkProps(link: PublicNavLink) { return link.target === 'blank' ? { target: '_blank', rel: 'noopener noreferrer' } : {}; }

function uniqueMenuKeys(settings: HeaderSettings) {
  const keys = new Set<string>();
  (['desktop', 'mobile'] as const).forEach((device) => rowKeys.forEach((rowKey) => {
    const row = settings[device][rowKey];
    (['left', 'center', 'right'] as const).forEach((column) => row.columns[column].forEach((el) => {
      if (['mainMenu', 'secondaryMenu', 'mobileMenu', 'categoriesMenu'].includes(el.type)) keys.add(el.menuKey || 'header');
    }));
  }));
  if (!keys.size) keys.add('header');
  return Array.from(keys);
}

// ─── Social icon SVGs (inline, no external dependency) ────────────────────────


function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

// ─── Mobile Menu Drawer (Loro Piana style) ────────────────────────────────────
function MobileMenuDrawer({
  navTree,
  locale,
  mobileHeaderHeight,
  onClose,
  onLangToggle,
}: {
  navTree: PublicNavLink[];
  locale: string;
  mobileHeaderHeight: number;
  onClose: () => void;
  onLangToggle: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isAr = locale === 'ar';
  const fontFamily = isAr ? "'Noto Kufi Arabic', sans-serif" : "'Cormorant Garamond', 'Cormorant', Georgia, serif";
  const fontFamilyUI = isAr ? "'Noto Kufi Arabic', sans-serif" : 'Montserrat, sans-serif';

  return (
    <>
      {/* Backdrop — blocks touch/scroll on the page behind */}
      <div
        className="lg:hidden fixed inset-0"
        style={{ top: mobileHeaderHeight, zIndex: 39 }}
        onTouchMove={(e) => e.preventDefault()}
      />
      <div
        className="lg:hidden fixed left-0 right-0 bottom-0 z-40 flex flex-col"
        style={{
          top: mobileHeaderHeight,
          backgroundColor: '#111110',
          overflowY: 'auto',
          overflowX: 'hidden',
          animation: 'menuSlideDown 0.38s cubic-bezier(0.4, 0, 0.2, 1) both',
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
      {/* ── Main nav items ── */}
      <nav className="flex-1 px-6 pt-6 pb-4">
        {navTree.map((link) => {
          const hasChildren = Boolean(link.children?.length);
          const isExpanded = expandedId === String(link.id);
          const label = linkLabel(link, locale);

          return (
            <div key={`${link.href}-${link.label}`}>
              {/* Top-level item row */}
              <div
                className="flex items-center justify-between py-3 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                {hasChildren ? (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : String(link.id))}
                    className="flex-1 text-left text-2xl font-light transition-colors duration-200"
                    style={{ fontFamily, fontSize: isAr ? '14px' : undefined, color: isExpanded ? '#9D7D39' : '#FAFAF8', letterSpacing: '0.01em' }}
                  >
                    {label}
                  </button>
                ) : (
                  <Link
                    href={link.href}
                    {...linkProps(link)}
                    onClick={onClose}
                    className="flex-1 text-2xl font-light transition-colors duration-200 hover:text-[#9D7D39]"
                    style={{ fontFamily, fontSize: isAr ? '14px' : undefined, color: '#FAFAF8', letterSpacing: '0.01em' }}
                  >
                    {label}
                  </Link>
                )}
                {hasChildren && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : String(link.id))}
                    className="ml-3 transition-transform duration-200"
                    style={{ color: 'rgba(255,255,255,0.4)', transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>

              {/* Sub-items — expand inline */}
              {hasChildren && isExpanded && (
                <div className="py-2 pl-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {link.children!.map((child) => (
                    <Link
                      key={`${child.href}-${child.label}`}
                      href={child.href}
                      {...linkProps(child)}
                      onClick={onClose}
                      className="block py-3 text-sm transition-colors duration-200 hover:text-[#9D7D39]"
                      style={{ fontFamily: fontFamilyUI, color: 'rgba(250,250,248,0.65)', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '11px' }}
                    >
                      {linkLabel(child, locale)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Utility links row ── */}
      <div
        className="px-6 py-3 flex items-center justify-center gap-6 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.12)' }}
      >
        <Link
          href="/account"
          onClick={onClose}
          className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase transition-colors duration-200 hover:text-[#9D7D39]"
          style={{ fontFamily: fontFamilyUI, color: 'rgba(250,250,248,0.7)' }}
        >
          <User size={15} />
          {isAr ? 'حسابي' : 'My Account'}
        </Link>
        <Link
          href="/wishlist"
          onClick={onClose}
          className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase transition-colors duration-200 hover:text-[#9D7D39]"
          style={{ fontFamily: fontFamilyUI, color: 'rgba(250,250,248,0.7)' }}
        >
          <Heart size={15} />
          {isAr ? 'المفضلة' : 'Wishlist'}
        </Link>
      </div>

      {/* ── Social / contact icons row ── */}
      <div
        className="px-6 py-3 flex items-center justify-center gap-6 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.12)' }}
      >
        {/* Phone */}
        <a
          href="tel:+96522464414"
          className="transition-colors duration-200 hover:text-[#9D7D39]"
          style={{ color: 'rgba(250,250,248,0.6)' }}
          aria-label="Call us"
        >
          <Phone size={20} />
        </a>

        {/* Instagram — Brass */}
        <a
          href="https://www.instagram.com/brass.official/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-200 hover:text-[#9D7D39]"
          style={{ color: 'rgba(250,250,248,0.6)' }}
          aria-label="Brass on Instagram"
        >
          <InstagramIcon size={20} />
        </a>

        {/* Email */}
        <a
          href="mailto:cove@coveinterior.com"
          className="transition-colors duration-200 hover:text-[#9D7D39]"
          style={{ color: 'rgba(250,250,248,0.6)' }}
          aria-label="Email us"
        >
          <Mail size={20} />
        </a>

        {/* Google Maps */}
        <a
          href="https://maps.app.goo.gl/dfMyPhjT1eSz4tfG7"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-200 hover:text-[#9D7D39]"
          style={{ color: 'rgba(250,250,248,0.6)' }}
          aria-label="Find us on Google Maps"
        >
          <MapPin size={20} />
        </a>
      </div>

      {/* ── Locale toggle ── */}
      <div
        className="px-6 py-3 flex items-center justify-center gap-3 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.12)' }}
      >
        <Globe size={14} style={{ color: 'rgba(250,250,248,0.4)' }} />
        <button
          onClick={onLangToggle}
          className="text-xs font-semibold tracking-widest uppercase transition-colors duration-200"
          style={{
            fontFamily: fontFamilyUI,
            color: locale === 'en' ? '#FAFAF8' : 'rgba(250,250,248,0.4)',
          }}
        >
          English
        </button>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>/</span>
        <button
          onClick={onLangToggle}
          className="text-xs font-semibold tracking-widest transition-colors duration-200"
          style={{
            fontFamily: "'Noto Kufi Arabic', sans-serif",
            color: locale === 'ar' ? '#FAFAF8' : 'rgba(250,250,248,0.4)',
          }}
        >
          عربي
        </button>
      </div>
      </div>
    </>
  );
}

// ─── Search Bar Overlay (Millanova style) ────────────────────────────────────
function SearchBar({ onClose, locale }: { onClose: () => void; locale: string }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isAr = locale === 'ar';
  const fontFamilyUI = isAr ? "'Noto Kufi Arabic', sans-serif" : 'Montserrat, sans-serif';

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Escape key closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = trpc.products.list.useQuery(
    { search: debouncedQuery, limit: 8, locale: locale as any },
    { enabled: debouncedQuery.trim().length >= 2, staleTime: 30_000 }
  );

  const items = (results as any)?.items ?? [];
  const [, navigate] = useLocation();

  const handleSelect = (slug: string) => {
    navigate(`/products/${slug}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'rgba(17,17,16,0.97)' }}>
      {/* Search input row — same height as header */}
      <div className="flex items-center px-4 md:px-8" style={{ height: 64, borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
        <Search size={18} style={{ color: 'rgba(250,250,248,0.5)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? 'ابحث عن منتج...' : 'Search products...'}
          className="flex-1 bg-transparent outline-none mx-4 text-base"
          style={{
            fontFamily: fontFamilyUI,
            color: '#FAFAF8',
            fontSize: '15px',
            letterSpacing: '0.03em',
          }}
          dir={isAr ? 'rtl' : 'ltr'}
        />
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center transition-colors duration-200 hover:text-[#9D7D39]"
          style={{ color: 'rgba(250,250,248,0.6)', flexShrink: 0 }}
          aria-label="Close search"
        >
          <X size={20} />
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {debouncedQuery.trim().length >= 2 && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            {isFetching && (
              <p className="text-xs tracking-widest uppercase" style={{ fontFamily: fontFamilyUI, color: 'rgba(250,250,248,0.4)' }}>
                {isAr ? 'جاري البحث...' : 'Searching...'}
              </p>
            )}
            {!isFetching && items.length === 0 && (
              <p className="text-xs tracking-widest uppercase" style={{ fontFamily: fontFamilyUI, color: 'rgba(250,250,248,0.4)' }}>
                {isAr ? 'لا توجد نتائج' : 'No results found'}
              </p>
            )}
            {items.length > 0 && (
              <ul className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {items.map((product: any) => {
                  const img = product.images?.[0] || product.mainImage || '';
                  const price = product.price ? `${Number(product.price).toFixed(3)} KWD` : '';
                  return (
                    <li key={product.id}>
                      <button
                        onClick={() => handleSelect(product.slug)}
                        className="w-full flex items-center gap-4 py-4 text-left transition-colors duration-150 hover:text-[#9D7D39]"
                        style={{ color: '#FAFAF8' }}
                      >
                        {img && (
                          <img
                            src={img}
                            alt={product.name}
                            className="object-cover rounded"
                            style={{ width: 48, height: 48, flexShrink: 0, backgroundColor: '#1A1A18' }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-light truncate" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '16px' }}>{product.name}</p>
                          {price && <p className="text-xs mt-0.5" style={{ fontFamily: fontFamilyUI, color: '#9D7D39', letterSpacing: '0.05em' }}>{price}</p>}
                        </div>
                        <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {debouncedQuery.trim().length < 2 && (
          <div className="max-w-2xl mx-auto px-4 py-10 text-center">
            <p className="text-xs tracking-widest uppercase" style={{ fontFamily: fontFamilyUI, color: 'rgba(250,250,248,0.25)' }}>
              {isAr ? 'اكتب للبحث عن المنتجات' : 'Type to search products'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Header() {
  const [location] = useLocation();
  const { itemCount, toggleCart } = useCart();
  const { locale, setLocale } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { data: savedHeader } = trpc.headerSettings.get.useQuery(undefined, { staleTime: 60_000, retry: false });
  const headerSettings = useMemo(() => normalizeHeaderSettings(savedHeader), [savedHeader]);
  const menuKeys = useMemo(() => uniqueMenuKeys(headerSettings), [headerSettings]);
  const { data: publicMenus } = trpc.menuBuilder.getPublicMenus.useQuery({ keys: menuKeys }, { staleTime: 60_000, retry: false });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleLangToggle = () => setLocale(locale === 'en' ? 'ar' : 'en');
  const isActiveLink = (link: PublicNavLink): boolean => location === link.href || location.startsWith(link.href + '/') || (link.children || []).some(isActiveLink);
  const getMenuTree = (key?: string) => buildNavTree((((publicMenus as any)?.[key || 'header']?.items || []) as PublicNavLink[]).length ? ((publicMenus as any)?.[key || 'header']?.items || []) as PublicNavLink[] : fallbackNavLinks);

  const renderMenu = (element: HeaderElement, mobile = false, activeTextColor = '#9D7D39') => {
    const navTree = getMenuTree(element.menuKey || (element.type === 'mobileMenu' ? 'mobile' : 'header'));
    if (mobile) {
      // Mobile menu is now handled by MobileMenuDrawer — this path is kept for compatibility
      return null;
    }
    return <nav className="hidden lg:flex items-center gap-8">{navTree.map((link) => { const active = isActiveLink(link); const hasChildren = Boolean(link.children?.length); const activeColor = activeTextColor; return <div key={`${link.href}-${link.label}`} className="relative group py-5"><Link href={link.href} {...linkProps(link)} className="gold-underline inline-flex items-center gap-1 text-xs font-semibold tracking-widest uppercase transition-colors duration-200 whitespace-nowrap" style={{ fontFamily: locale === 'ar' ? "'Noto Kufi Arabic', sans-serif" : 'Montserrat, sans-serif', fontSize: locale === 'ar' ? '14px' : undefined, color: active ? activeColor : 'currentColor' }}>{linkLabel(link, locale)}{hasChildren && <ChevronDown size={12} />}</Link>{hasChildren && <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute top-full left-0 min-w-56 py-3 shadow-xl transition-all duration-150" style={{ backgroundColor: '#1A1A18', color: '#FAFAF8' }}>{link.children!.map((child) => <Link key={`${child.href}-${child.label}`} href={child.href} {...linkProps(child)} className="block px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-colors duration-150" style={{ fontFamily: locale === 'ar' ? "'Noto Kufi Arabic', sans-serif" : 'Montserrat, sans-serif' }} onMouseEnter={(e) => (e.currentTarget.style.color = activeColor)} onMouseLeave={(e) => (e.currentTarget.style.color = '')}>{linkLabel(child, locale)}</Link>)}</div>}</div>; })}</nav>;
  };

  const renderElement = (element: HeaderElement, device: 'desktop' | 'mobile', activeTextColor = '#9D7D39') => {
    const iconButtonClass = `inline-flex items-center justify-center transition-colors duration-200`;
    switch (element.type) {
      case 'logo': {
        const logoSrc = element.logoSrc || element.settings?.logoSrc || '/brand/cove-logo.png';
        const logoWidth = Math.min(500, Math.max(10, Number(element.settings?.logoWidth || 104)));
        return <a href="/" className="inline-flex items-center" aria-label="Cove Interior home"><img src={logoSrc} alt={element.label || 'Cove Interior'} className="h-12 object-contain" style={{ width: `${logoWidth}px` }} /></a>;
      }
      case 'mainMenu': case 'secondaryMenu': case 'categoriesMenu': return renderMenu(element, false, activeTextColor);
      case 'mobileMenu': return renderMenu(element, true, activeTextColor);
      case 'mobileMenuIcon': return <button onClick={() => setMobileOpen(!mobileOpen)} className={`${iconButtonClass} lg:hidden`} onMouseEnter={(e) => (e.currentTarget.style.color = activeTextColor)} onMouseLeave={(e) => (e.currentTarget.style.color = '')} aria-label="Menu">{mobileOpen ? <X size={21} /> : <Menu size={21} />}</button>;
      case 'search': return <button onClick={() => setSearchOpen(true)} className={iconButtonClass} onMouseEnter={(e) => (e.currentTarget.style.color = activeTextColor)} onMouseLeave={(e) => (e.currentTarget.style.color = '')} aria-label="Search"><Search size={18} /></button>;
      case 'cart': return <button onClick={toggleCart} className={`relative ${iconButtonClass}`} onMouseEnter={(e) => (e.currentTarget.style.color = activeTextColor)} onMouseLeave={(e) => (e.currentTarget.style.color = '')} aria-label="Cart"><ShoppingBag size={18} />{itemCount > 0 && <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: activeTextColor, color: '#FAFAF8' }}>{itemCount > 9 ? '9+' : itemCount}</span>}</button>;
      case 'wishlist': return <Link href="/wishlist" className={iconButtonClass} onMouseEnter={(e) => (e.currentTarget.style.color = activeTextColor)} onMouseLeave={(e) => (e.currentTarget.style.color = '')} aria-label="Wishlist"><Heart size={18} /></Link>;
      case 'account': return <Link href="/account" className={iconButtonClass} onMouseEnter={(e) => (e.currentTarget.style.color = activeTextColor)} onMouseLeave={(e) => (e.currentTarget.style.color = '')} aria-label="Account"><User size={18} /></Link>;
      case 'languageSwitcher': return <button onClick={handleLangToggle} className="text-xs font-semibold tracking-wider uppercase transition-colors duration-200" style={{ fontFamily: 'Montserrat, sans-serif' }} onMouseEnter={(e) => (e.currentTarget.style.color = activeTextColor)} onMouseLeave={(e) => (e.currentTarget.style.color = '')} aria-label={locale === 'en' ? 'Switch to Arabic' : 'Switch to English'}>{locale === 'en' ? 'عربي' : 'EN'}</button>;
      case 'textHtml': return <div className="text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: locale === 'ar' ? "'Noto Kufi Arabic', sans-serif" : 'Montserrat, sans-serif' }} dangerouslySetInnerHTML={{ __html: element.html || '' }} />;
      case 'button': return <Link href={element.href || '/'} className="border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors" style={{ borderColor: 'currentColor', fontFamily: 'Montserrat, sans-serif' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = activeTextColor; (e.currentTarget as HTMLElement).style.borderColor = activeTextColor; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ''; (e.currentTarget as HTMLElement).style.borderColor = 'currentColor'; }}>{element.label || 'Button'}</Link>;
      case 'socialIcons': return <div className="flex items-center gap-3 text-xs uppercase tracking-wider"><span>Instagram</span></div>;
      case 'divider': return <span className="block h-5 w-px bg-current opacity-25" />;
      case 'space': return <span aria-hidden="true" style={{ display: 'inline-block', width: `${element.width || 24}px` }} />;
      default: return null;
    }
  };

  const renderColumn = (row: HeaderRow, column: 'left' | 'center' | 'right', device: 'desktop' | 'mobile') => {
    const justify = column === 'left' ? 'justify-start' : column === 'center' ? 'justify-center' : 'justify-end';
    // Add right padding on mobile so cart badge (-right-2) is not clipped by the container edge
    const extraClass = (column === 'right' && device === 'mobile') ? 'pr-3' : '';
    const activeTextColor = row.activeTextColor || '#9D7D39';
    return <div className={`flex min-w-0 flex-1 items-center gap-4 ${justify} ${extraClass}`}>{row.columns[column].map((element) => <div key={element.id} className="inline-flex items-center">{renderElement(element, device, activeTextColor)}</div>)}</div>;
  };

  const renderRow = (row: HeaderRow, key: string, device: 'desktop' | 'mobile') => {
    if (!row.enabled) return null;
    const borderBottomStyle = row.borderBottom
      ? `${row.borderBottomHeight ?? 1}px solid ${row.borderBottomColor ?? '#9D7D39'}`
      : 'none';
    return <div key={key} style={{ minHeight: row.height, backgroundColor: row.backgroundColor, backgroundImage: row.backgroundImage ? `url(${row.backgroundImage})` : undefined, backgroundSize: row.backgroundImage ? 'cover' : undefined, backgroundPosition: row.backgroundImage ? 'center' : undefined, backgroundRepeat: row.backgroundImage ? 'no-repeat' : undefined, color: row.textColor, borderBottom: borderBottomStyle }}><div className="container flex items-center" style={{ minHeight: row.height }}>{renderColumn(row, 'left', device)}{renderColumn(row, 'center', device)}{renderColumn(row, 'right', device)}</div></div>;
  };

  const mobileHeaderHeight = getHeaderDeviceHeight(headerSettings, 'mobile');
  const mobileNavTree = getMenuTree('mobile');

  return (
    <header
      style={{ backgroundColor: '#111110' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-shadow duration-300 ${scrolled ? 'shadow-[0_2px_20px_rgba(0,0,0,0.4)]' : ''}`}
    >
      <div className="hidden lg:block">{rowKeys.map((key) => renderRow(headerSettings.desktop[key], `desktop-${key}`, 'desktop'))}</div>
      <div className="lg:hidden">{rowKeys.map((key) => renderRow(headerSettings.mobile[key], `mobile-${key}`, 'mobile'))}</div>

      {/* Mobile menu drawer — Loro Piana style */}
      {mobileOpen && (
        <MobileMenuDrawer
          navTree={mobileNavTree}
          locale={locale}
          mobileHeaderHeight={mobileHeaderHeight}
          onClose={() => setMobileOpen(false)}
          onLangToggle={handleLangToggle}
        />
      )}

      {/* Search overlay — Millanova style */}
      {searchOpen && (
        <SearchBar onClose={() => setSearchOpen(false)} locale={locale} />
      )}
    </header>
  );
}
