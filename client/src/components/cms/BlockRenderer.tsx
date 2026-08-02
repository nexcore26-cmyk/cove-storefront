/**
 * Shared CMS block renderers used by both Home.tsx and DynamicPage.tsx
 * All block types supported by the page builder are rendered here.
 */
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { cleanName } from '@/lib/cleanName';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const PRODUCT_PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80';

function getProductGridImage(product: any): string {
  if (product?.image) return product.image;

  const images: string[] = Array.isArray(product?.images)
    ? product.images
    : (typeof product?.images === 'string' ? (() => {
        try { return JSON.parse(product.images || '[]'); } catch { return []; }
      })() : []);

  return images[0] || PRODUCT_PLACEHOLDER_IMG;
}

// ─── Individual block renderers ────────────────────────────────────────────

export function HeroSliderBlock({ config, locale }: { config: any; locale: string }) {
  const [current, setCurrent] = useState(0);
  const slides = config?.slides || [];
  if (slides.length === 0) return null;
  const isAr = locale === 'ar';
  const slide = slides[current];
  const slideTitle = isAr ? (slide.titleAr || slide.title || '') : (slide.titleEn || slide.title || '');
  const slideSubtitle = isAr ? (slide.subtitleAr || slide.subtitle || '') : (slide.subtitleEn || slide.subtitle || '');
  const slideCta = isAr ? (slide.ctaTextAr || slide.ctaText || '') : (slide.ctaTextEn || slide.ctaText || '');
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'calc(100svh - 60px)', minHeight: 480, maxHeight: 700 }}>
      {slide.image ? (
        <img src={slide.image} alt={slideTitle} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 to-stone-700" />
      )}
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 flex flex-col items-start justify-end h-full p-8 md:p-16 pb-16">
        {slideTitle && <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 max-w-2xl">{slideTitle}</h1>}
        {slideSubtitle && <p className="text-lg text-white/80 mb-6 max-w-xl">{slideSubtitle}</p>}
        {slideCta && slide.ctaLink && (
          <Link href={slide.ctaLink}>
            <Button size="lg" className="bg-[#9D7D39] hover:bg-[#8a6f32] text-white">{slideCta}</Button>
          </Link>
        )}
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {slides.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white w-6' : 'bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TextHtmlBlock({ config, locale }: { config: any; locale: string }) {
  const isAr = locale === 'ar';
  const title = isAr
    ? (config?.titleAr || config?.title || '')
    : (config?.titleEn || config?.title || '');
  const body = isAr
    ? (config?.bodyAr || config?.contentAr || config?.content || '')
    : (config?.bodyEn || config?.content || '');
  return (
    <div className="container py-10">
      <div className="max-w-3xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
        {title && (
          <h2 className="text-2xl font-serif font-semibold mb-5 text-foreground">{title}</h2>
        )}
        <div
          className="prose prose-stone"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
    </div>
  );
}

export function CategoryGridBlock({ config, locale }: { config: any; locale: string }) {
  const { data: allCats } = trpc.categories.list.useQuery({ locale: locale as 'en' | 'ar' });
  const ids: number[] = config?.categoryIds || [];
  const cats = ids.length > 0
    ? (allCats || []).filter((c: any) => ids.includes(c.id))
    : (allCats || []).filter((c: any) => c.channel === 'online' || c.channel === 'both');
  const cols = config?.columns || 4;
  const gridCols: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-5',
    6: 'grid-cols-3 md:grid-cols-6',
  };
  const title = locale === 'ar' && config?.titleAr ? config.titleAr : config?.title || '';
  return (
    <div className="container py-10">
      {title && <h2 className="text-2xl font-bold mb-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>{title}</h2>}
      <div className={`grid ${gridCols[cols] || 'grid-cols-2 md:grid-cols-4'} gap-4`}>
        {cats.map((cat: any) => (
          <Link key={cat.id} href={`/shop?category=${cat.slug}`}>
            <div className="group relative rounded-xl overflow-hidden aspect-square bg-stone-100 cursor-pointer">
              {cat.image && <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
              {config?.showName !== false && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                  <span className="text-white font-medium text-sm">{cleanName(cat.name)}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ProductGridBlock({ config, locale }: { config: any; locale: string }) {
  const { data } = trpc.products.list.useQuery({
    categoryId: config?.categoryId || undefined,
    warehouseType: 'online' as const,
    limit: config?.limit || 8,
    locale: locale as 'en' | 'ar',
  });
  const title = locale === 'ar' && config?.titleAr ? config.titleAr : config?.title || '';
  const cols = config?.columns || 4;
  const gridCols: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-5',
  };
  const products = data?.items || [];
  return (
    <div className="container py-10">
      {title && <h2 className="text-2xl font-bold mb-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>{title}</h2>}
      <div className={`grid ${gridCols[cols] || 'grid-cols-2 md:grid-cols-4'} gap-4`}>
        {products.map((product: any) => {
          const mainImage = getProductGridImage(product);
          return (
            <Link key={product.id} href={`/product/${product.slug}`}>
              <div className="group rounded-xl overflow-hidden border bg-card hover:shadow-md transition-shadow cursor-pointer">
                <div className="aspect-square bg-stone-100 overflow-hidden">
                  <img src={mainImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{cleanName(product.name)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {product.price ? `KWD ${Number(product.price).toFixed(3)}` : ''}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function BannerBlock({ config, locale }: { config: any; locale: string }) {
  const title = locale === 'ar' && config?.titleAr ? config.titleAr : config?.title || '';
  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: 300 }}>
      {config?.image ? (
        <img src={config.image} alt={title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-stone-800" />
      )}
      {config?.overlay !== false && <div className="absolute inset-0 bg-black/40" />}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center p-8 min-h-[300px]">
        {title && <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{title}</h2>}
        {config?.subtitle && <p className="text-lg text-white/80 mb-6">{config.subtitle}</p>}
        {config?.ctaText && config?.ctaLink && (
          <Link href={config.ctaLink}>
            <Button size="lg" className="bg-[#9D7D39] hover:bg-[#8a6f32] text-white">{config.ctaText}</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export function ButtonBlock({ config, locale }: { config: any; locale: string }) {
  const isAr = locale === 'ar';
  const label = isAr ? (config?.textAr || config?.text || '') : (config?.text || '');
  const href = config?.href || config?.ctaLink || '';
  if (!label || !href) return null;

  const align = config?.align || 'center';
  const justifyClass: Record<string, string> = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };
  const variant = config?.variant || 'primary';
  const variantClass: Record<string, string> = {
    primary: 'bg-[#9D7D39] hover:bg-[#8a6f32] text-white border-[#9D7D39]',
    outline: 'bg-transparent hover:bg-[#9D7D39]/10 text-[#9D7D39] border-[#9D7D39]',
    ghost: 'bg-transparent hover:bg-[#9D7D39]/10 text-[#9D7D39] border-transparent',
  };
  const buttonClass = `${config?.fullWidth ? 'w-full' : ''} ${variantClass[variant] || variantClass.primary}`;
  const isExternal = /^https?:\/\//i.test(href) || config?.openInNewTab;
  const paddingY = Number.isFinite(Number(config?.paddingY)) ? Number(config.paddingY) : 40;
  const content = (
    <Button size="lg" variant={variant === 'ghost' ? 'ghost' : 'outline'} className={buttonClass}>
      {label}
    </Button>
  );

  return (
    <div className="container" style={{ paddingTop: paddingY, paddingBottom: paddingY }} dir={isAr ? 'rtl' : 'ltr'}>
      <div className={`flex ${justifyClass[align] || justifyClass.center}`}>
        {isExternal ? (
          <a href={href} target={config?.openInNewTab ? '_blank' : undefined} rel={config?.openInNewTab ? 'noopener noreferrer' : undefined} className={config?.fullWidth ? 'w-full' : undefined}>
            {content}
          </a>
        ) : (
          <Link href={href}>{content}</Link>
        )}
      </div>
    </div>
  );
}

export function SpacerBlock({ config }: { config: any }) {
  return <div style={{ height: config?.height || 60 }} />;
}

export function ContactFormBlock({ config, locale }: { config: any; locale: string }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const fields: string[] = config?.fields || ['name', 'email', 'message'];
  const title = locale === 'ar' && config?.titleAr ? config.titleAr : config?.title || 'Contact Us';
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast.success('Message sent! We will get back to you soon.');
  };
  if (submitted) {
    return (
      <div className="container py-10 text-center">
        <div className="max-w-md mx-auto">
          <div className="text-4xl mb-3">✓</div>
          <h3 className="text-xl font-semibold mb-2">Message Sent!</h3>
          <p className="text-muted-foreground">We will get back to you as soon as possible.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="container py-10">
      <div className="max-w-lg mx-auto">
        <h2 className="text-2xl font-bold mb-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.includes('name') && (
            <div><Label>Name</Label><Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
          )}
          {fields.includes('email') && (
            <div><Label>Email</Label><Input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
          )}
          {fields.includes('phone') && (
            <div><Label>Phone</Label><Input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          )}
          {fields.includes('subject') && (
            <div><Label>Subject</Label><Input value={form.subject || ''} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
          )}
          {fields.includes('message') && (
            <div><Label>Message</Label><Textarea rows={5} value={form.message || ''} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required /></div>
          )}
          <Button type="submit" className="w-full">{config?.submitLabel || 'Send Message'}</Button>
        </form>
      </div>
    </div>
  );
}

export function ImageGalleryBlock({ config }: { config: any }) {
  const images: string[] = config?.images || [];
  const cols = config?.columns || 3;
  const gridCols: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-5',
  };
  if (images.length === 0) return null;
  return (
    <div className="container py-10">
      <div className={`grid ${gridCols[cols] || 'grid-cols-3'} gap-3`}>
        {images.map((img, i) => (
          <div key={i} className="aspect-square rounded-lg overflow-hidden bg-stone-100">
            <img src={img} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Intro Text Block ────────────────────────────────────────────────────────

export function IntroTextBlock({ config, locale }: { config: any; locale?: string }) {
  const isAr = locale === 'ar';
  const arabicFont = "'Noto Kufi Arabic', sans-serif";
  const latinFont = 'Montserrat, sans-serif';
  const font = isAr ? arabicFont : latinFont;

  const label = isAr
    ? (config?.labelAr || 'تصميم خالد، حياة متميزة.')
    : (config?.label || 'TIMELESS DESIGN, DISTINCTIVE LIVING.');
  const heading = isAr
    ? (config?.headingAr || 'اكتشف عالم كوف')
    : (config?.heading || 'Discover the World of Cove');
  const body1 = isAr
    ? (config?.body1Ar || 'ادخل إلى عالم من الديكورات الراقية، الحرفية المميزة والتصميم المنتقى بعناية. من أثاث النحاس الفاخر إلى الحلول الداخلية المتكاملة، كل تفصيل صُمّم ليمنح مساحتك الأناقة والطابع الفريد.')
    : (config?.body1 || 'Step into a world of refined interiors, distinctive craftsmanship and thoughtfully curated design. From signature brass furniture to complete interior solutions, every detail is created to bring elegance, character and individuality to your space.');
  const body2 = isAr
    ? (config?.body2Ar || 'تصميم خالد، مدروس بعناية، وفريد من نوعه — كوف.')
    : (config?.body2 || 'Timeless design, carefully considered and uniquely Cove.');

  return (
    <section style={{ backgroundColor: '#FAFAF8' }} className="w-full py-16 md:py-20" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto px-6 text-center">
        <p
          style={{ fontFamily: font, color: '#9D7D39', letterSpacing: isAr ? '0.05em' : '0.2em', fontSize: '11px', fontWeight: 600 }}
          className="uppercase mb-5"
        >
          {label}
        </p>
        <h2
          style={{ fontFamily: font, color: '#111110', fontWeight: 400, fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.3 }}
          className="mb-4"
        >
          {heading}
        </h2>
        {/* Golden underline */}
        <div style={{ width: 48, height: 2, backgroundColor: '#9D7D39', margin: '0 auto 24px' }} />
        <p
          style={{ fontFamily: font, color: '#6f6a60', fontSize: '15px', lineHeight: 1.85, fontWeight: 400 }}
          className="mb-5"
        >
          {body1}
        </p>
        <p
          style={{ fontFamily: font, color: '#9D7D39', fontSize: '14px', lineHeight: 1.7, fontWeight: 500, fontStyle: isAr ? 'normal' : 'italic' }}
        >
          {body2}
        </p>
      </div>
    </section>
  );
}

// ─── Nav Cards Block ──────────────────────────────────────────────────────────

const DEFAULT_CARDS = [
  { title: 'Signature Brass Furniture', titleAr: 'أثاث النحاس المميز', description: 'Distinctive brass pieces designed to bring warmth, character and timeless elegance.', descriptionAr: 'قطع نحاس فريدة صُمّمت لتضفي الدفء والشخصية والأناقة الخالدة.', cta: 'Explore Collection', ctaAr: 'استكشف المجموعة', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/signaturebrassfurniture.png' },
  { title: 'Company Portfolio', titleAr: 'محفظة الشركة', description: 'Explore residential, commercial and bespoke interiors.', descriptionAr: 'استكشف مشاريعنا السكنية والتجارية والمصممة خصيصاً.', cta: 'View Portfolio', ctaAr: 'عرض المحفظة', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/companyportfolio.png' },
  { title: 'Client Services', titleAr: 'خدمات العملاء', description: 'Concept, design and execution tailored to your space.', descriptionAr: 'تصور وتصميم وتنفيذ مصمّم خصيصاً لمساحتك.', cta: 'Explore Services', ctaAr: 'استكشف الخدمات', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/clientservices.png' },
  { title: 'About Cove', titleAr: 'عن كوف', description: 'The story, the craft and the people behind Cove Interior.', descriptionAr: 'القصة والحرفة والأشخاص خلف كوف إنتيريور.', cta: 'Discover Cove', ctaAr: 'اكتشف كوف', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/aboutcove.png' },
  { title: 'Cove Events', titleAr: 'فعاليات كوف', description: 'Curated gatherings and exclusive Cove experiences.', descriptionAr: 'تجمعات منتقاة وتجارب حصرية مع كوف.', cta: 'View Events', ctaAr: 'عرض الفعاليات', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/coveevents.png' },
  { title: 'Visit & Contact Cove', titleAr: 'زورنا وتواصل معنا', description: 'Find us, reach out and begin your journey with Cove.', descriptionAr: 'اعثر علينا، تواصل معنا وابدأ رحلتك مع كوف.', cta: 'Contact Us', ctaAr: 'تواصل معنا', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/visitcontactcove.png' },
];

export function NavCardsBlock({ config, locale }: { config: any; locale?: string }) {
  const isAr = locale === 'ar';
  const arabicFont = "'Noto Kufi Arabic', sans-serif";
  const latinFont = 'Montserrat, sans-serif';
  const font = isAr ? arabicFont : latinFont;
  const cards = (config?.cards && config.cards.length === 6) ? config.cards : DEFAULT_CARDS;
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const [c0, c1, c2, c3, c4, c5] = cards;

  const CardInner = ({ card }: { card: any }) => {
    const title = isAr ? (card.titleAr || card.title) : card.title;
    const description = isAr ? (card.descriptionAr || card.description) : card.description;
    const cta = isAr ? (card.ctaAr || card.cta) : card.cta;
    return (
      <a
        href={card.link || '#'}
        className="group overflow-hidden"
        style={{ textDecoration: 'none', display: 'block', position: 'relative', width: '100%', height: '100%' }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {card.image && (
          <img
            src={card.image}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.10) 100%)' }} />
        {/* Text content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-7" style={{ textAlign: isAr ? 'right' : 'left' }}>
          <h3
            style={{ fontFamily: font, color: '#fff', fontWeight: 500, fontSize: 'clamp(18px, 2.2vw, 26px)', lineHeight: 1.2, marginBottom: 8 }}
          >
            {title}
          </h3>
          {description && (
            <p style={{ fontFamily: font, color: 'rgba(255,255,255,0.80)', fontSize: '13px', lineHeight: 1.55, marginBottom: 14 }}>
              {description}
            </p>
          )}
          {cta && (
            <span
              style={{ fontFamily: font, color: '#9D7D39', fontSize: '12px', fontWeight: 600, letterSpacing: isAr ? '0.02em' : '0.08em', textTransform: 'uppercase' }}
            >
              {isAr ? <>← {cta}</> : <>{cta} &rarr;</>}
            </span>
          )}
        </div>
      </a>
    );
  };

  if (isMobile) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 40 }}>
        {cards.map((card: any, i: number) => (
          <div key={i} style={{ height: 300, position: 'relative' }}>
            <CardInner card={card} />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section style={{ paddingBottom: 40 }}>
      {/* Desktop mosaic grid — top 3 cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '600px 320px',
        gap: 4,
      }}>
        {/* Left tall card — spans both rows */}
        <div style={{ gridRow: '1 / 3', position: 'relative' }}>
          <CardInner card={c0} />
        </div>
        {/* Right top card */}
        <div style={{ position: 'relative' }}>
          <CardInner card={c1} />
        </div>
        {/* Right bottom card */}
        <div style={{ position: 'relative' }}>
          <CardInner card={c2} />
        </div>
      </div>
      {/* Desktop bottom row — 3 equal cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        height: 320,
        gap: 4,
        marginTop: 4,
      }}>
        <div style={{ height: '100%', position: 'relative' }}>
          <CardInner card={c3} />
        </div>
        <div style={{ height: '100%', position: 'relative' }}>
          <CardInner card={c4} />
        </div>
        <div style={{ height: '100%', position: 'relative' }}>
          <CardInner card={c5} />
        </div>
      </div>
    </section>
  );
}

// ─── Main block dispatcher ─────────────────────────────────────────────────

export default function BlockRenderer({ block, locale }: { block: any; locale: string }) {
  if (!block.isVisible) return null;
  const config = block.config || {};
  switch (block.blockType) {
    case 'hero_slider':
    case 'hero': return <HeroSliderBlock config={config} locale={locale} />;
    case 'text_html':
    case 'html_block': return <TextHtmlBlock config={config} locale={locale} />;
    case 'category_grid': return <CategoryGridBlock config={config} locale={locale} />;
    case 'product_grid': return <ProductGridBlock config={config} locale={locale} />;
    case 'banner': return <BannerBlock config={config} locale={locale} />;
    case 'button': return <ButtonBlock config={config} locale={locale} />;
    case 'spacer': return <SpacerBlock config={config} />;
    case 'contact_form': return <ContactFormBlock config={config} locale={locale} />;
    case 'image_gallery': return <ImageGalleryBlock config={config} />;
    case 'intro_text': return <IntroTextBlock config={config} locale={locale} />;
    case 'nav_cards': return <NavCardsBlock config={config} locale={locale} />;
    default: return null;
  }
}
