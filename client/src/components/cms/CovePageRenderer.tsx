/**
 * CovePageRenderer — Storefront renderer for pages built with the custom CovePageBuilder.
 * Reads the saved blocks array and renders each block as a full-width section.
 */
import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

interface PageBlock {
  id: string;
  type: string;
  props: Record<string, any>;
}

// ─── Individual block renderers ────────────────────────────────────────────────

function TextSectionBlock({ props, locale }: { props: any; locale: string }) {
  const isAr = locale === 'ar';
  const eyebrow = isAr ? (props.eyebrowAr || props.eyebrowEn) : props.eyebrowEn;
  const content = isAr ? (props.contentAr || props.contentEn) : props.contentEn;
  const widthClass = props.width === 'narrow' ? 'max-w-2xl' : props.width === 'wide' ? 'max-w-6xl' : 'max-w-4xl';

  return (
    <section
      className="w-full py-12 px-6"
      style={{
        backgroundColor: props.bgColor || undefined,
        backgroundImage: props.bgImage ? `url(${props.bgImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className={`mx-auto ${widthClass}`}>
        {eyebrow && (
          <p className="text-base font-semibold tracking-widest uppercase text-primary mb-3">{eyebrow}</p>
        )}
        {content && (
          <div
            className="prose prose-stone max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>
    </section>
  );
}

function HeroSectionBlock({ props, locale }: { props: any; locale: string }) {
  const [current, setCurrent] = useState(0);
  const isAr = locale === 'ar';
  const slides = props.slides || [];
  if (slides.length === 0) return null;
  const slide = slides[current];

  return (
    <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden bg-stone-900" dir={isAr ? 'rtl' : 'ltr'}>
      {slide.image && (
        <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/50" />
      <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-6">
        {(isAr ? slide.subtitleAr : slide.subtitleEn) && (
          <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-4 opacity-80">
            {isAr ? slide.subtitleAr : slide.subtitleEn}
          </p>
        )}
        <h1 className="font-serif text-5xl md:text-7xl font-light leading-tight mb-6">
          {isAr ? (slide.titleAr || slide.titleEn) : slide.titleEn}
        </h1>
        {(isAr ? slide.ctaTextAr : slide.ctaTextEn) && (
          <a
            href={slide.ctaLink || '/shop'}
            className="mt-2 inline-block border border-white/80 text-white px-8 py-3 text-sm tracking-widest uppercase hover:bg-white hover:text-stone-900 transition-colors"
          >
            {isAr ? slide.ctaTextAr : slide.ctaTextEn}
          </a>
        )}
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white w-6' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ImageGridBlock({ props, locale }: { props: any; locale: string }) {
  const isAr = locale === 'ar';
  const title = isAr ? (props.titleAr || props.titleEn) : props.titleEn;
  const cols = props.columns || 3;
  const gridClass = cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3';

  return (
    <section className="w-full py-10 px-4" dir={isAr ? 'rtl' : 'ltr'}>
      {title && <h2 className="text-center font-serif text-2xl mb-6">{title}</h2>}
      <div className={`grid ${gridClass} gap-3 max-w-6xl mx-auto`}>
        {(props.items || []).map((item: any, i: number) => (
          <a key={i} href={item.link || '#'} className="block aspect-square overflow-hidden group">
            {item.image ? (
              <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-400 text-sm">Image {i + 1}</div>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}

// ── FAQ Accordion — answer rendered as HTML, +/- icon RTL-aware ───────────────
function FaqAccordionBlock({ props, locale }: { props: any; locale: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isAr = locale === 'ar';
  const title = isAr ? (props.titleAr || props.titleEn) : props.titleEn;

  return (
    <section className="w-full py-12 px-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto">
        {title && <h2 className="font-serif text-3xl mb-8 text-center">{title}</h2>}
        <div className="divide-y divide-stone-200">
          {(props.items || []).map((item: any, i: number) => {
            const q = isAr ? (item.questionAr || item.questionEn) : item.questionEn;
            const a = isAr ? (item.answerAr || item.answerEn) : item.answerEn;
            const isOpen = openIndex === i;
            return (
              <div key={i}>
                <button
                  className={`w-full flex items-center py-4 font-medium hover:text-primary transition-colors gap-4 ${isAr ? 'flex-row-reverse text-right' : 'text-left'}`}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                >
                  {/* Icon always on the "start" side — right in Arabic, left in English */}
                  <span className="text-xl shrink-0 leading-none" style={{ minWidth: '1.25rem', textAlign: 'center' }}>
                    {isOpen ? '−' : '+'}
                  </span>
                  <span className="flex-1">{q}</span>
                </button>
                {isOpen && (
                  <div
                    className={`pb-5 text-stone-600 text-sm leading-relaxed prose prose-stone max-w-none ${isAr ? 'pr-9 text-right' : 'pl-9'}`}
                    dangerouslySetInnerHTML={{ __html: a || '' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function VideoEmbedBlock({ props, locale }: { props: any; locale: string }) {
  const isAr = locale === 'ar';
  const title = isAr ? (props.titleAr || props.titleEn) : props.titleEn;
  let embedUrl = props.videoUrl || '';
  // Convert YouTube watch URL to embed URL
  const ytMatch = embedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;

  return (
    <section
      className="w-full py-12 px-6"
      style={{ backgroundColor: props.bgColor || '#f5f5f0' }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="max-w-4xl mx-auto">
        {title && <h2 className="font-serif text-3xl mb-6 text-center">{title}</h2>}
        {embedUrl ? (
          <div className="aspect-video w-full rounded-lg overflow-hidden shadow-lg">
            <iframe src={embedUrl} className="w-full h-full" allowFullScreen title={title || 'Video'} />
          </div>
        ) : (
          <div className="aspect-video w-full bg-stone-200 rounded-lg flex items-center justify-center text-stone-400">No video URL set</div>
        )}
      </div>
    </section>
  );
}

function MapEmbedBlock({ props, locale }: { props: any; locale: string }) {
  const isAr = locale === 'ar';
  const title = isAr ? (props.titleAr || props.titleEn) : props.titleEn;

  return (
    <section className="w-full py-12 px-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto">
        {title && <h2 className="font-serif text-3xl mb-6 text-center">{title}</h2>}
        {props.embedUrl ? (
          <div className="w-full h-96 rounded-lg overflow-hidden shadow-md">
            <iframe src={props.embedUrl} className="w-full h-full border-0" allowFullScreen title="Map" />
          </div>
        ) : (
          <div className="w-full h-64 bg-stone-100 rounded-lg flex items-center justify-center text-stone-400">Map embed URL not set</div>
        )}
      </div>
    </section>
  );
}

function ContactFormBlock({ props, locale }: { props: any; locale: string }) {
  const isAr = locale === 'ar';
  const title = isAr ? (props.titleAr || props.titleEn) : props.titleEn;
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);
  const sendContact = trpc.contact?.send?.useMutation?.({ onSuccess: () => setSent(true) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sendContact?.mutate) sendContact.mutate(form);
    else setSent(true);
  };

  return (
    <section
      className="w-full py-12 px-6"
      style={{ backgroundColor: props.bgColor || undefined }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="max-w-xl mx-auto">
        {title && <h2 className="font-serif text-3xl mb-8 text-center">{title}</h2>}
        {sent ? (
          <div className="text-center py-8">
            <p className="text-primary font-medium text-lg">
              {isAr ? 'شكراً! سنتواصل معك قريباً.' : 'Thank you! We will be in touch soon.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text" required placeholder={isAr ? 'الاسم' : 'Name'}
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border border-stone-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-primary"
            />
            <input
              type="email" required placeholder={isAr ? 'البريد الإلكتروني' : 'Email'}
              value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full border border-stone-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-primary"
            />
            <input
              type="tel" placeholder={isAr ? 'رقم الهاتف' : 'Phone'}
              value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className="w-full border border-stone-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-primary"
            />
            <textarea
              required rows={5} placeholder={isAr ? 'رسالتك' : 'Message'}
              value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              className="w-full border border-stone-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none"
            />
            <button
              type="submit"
              className="w-full bg-primary text-white py-3 text-sm font-medium tracking-widest uppercase hover:bg-primary/90 transition-colors rounded"
            >
              {isAr ? 'إرسال' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function SplitBannerBlock({ props, locale }: { props: any; locale: string }) {
  const isAr = locale === 'ar';
  const title = isAr ? (props.titleAr || props.titleEn) : props.titleEn;
  const body = isAr ? (props.bodyAr || props.bodyEn) : props.bodyEn;
  const ctaText = isAr ? (props.ctaTextAr || props.ctaTextEn) : props.ctaTextEn;
  const flip = props.flip;

  return (
    <section className={`w-full flex flex-col md:flex-row ${flip ? 'md:flex-row-reverse' : ''} min-h-[400px]`} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full md:w-1/2 min-h-64 bg-stone-100 overflow-hidden">
        {props.image ? (
          <img src={props.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">Image</div>
        )}
      </div>
      <div className="w-full md:w-1/2 flex flex-col justify-center px-10 py-12">
        {title && <h2 className="font-serif text-3xl mb-4">{title}</h2>}
        {body && <div className="prose prose-stone text-sm" dangerouslySetInnerHTML={{ __html: body }} />}
        {ctaText && (
          <a href={props.ctaLink || '#'} className="mt-6 inline-block bg-primary text-white px-8 py-3 text-sm tracking-widest uppercase hover:bg-primary/90 transition-colors">
            {ctaText}
          </a>
        )}
      </div>
    </section>
  );
}

function ProductRailBlock({ props, locale }: { props: any; locale: string }) {
  const isAr = locale === 'ar';
  const title = isAr ? (props.titleAr || props.titleEn) : props.titleEn;
  const { data: products } = trpc.products.list.useQuery({ categorySlug: props.categoryId || undefined, limit: props.limit || 8 });
  const cols = props.columns || 4;
  const gridClass = cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4';

  return (
    <section className="w-full py-12 px-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="font-serif text-3xl mb-8 text-center">{title}</h2>}
        <div className={`grid ${gridClass} gap-4`}>
          {(products?.items || []).slice(0, props.limit || 8).map((product: any) => (
            <a key={product.id} href={`/product/${product.slug}`} className="group block">
              <div className="aspect-square bg-stone-100 overflow-hidden mb-3">
                {product.images?.[0] && (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                )}
              </div>
              <p className="text-sm font-medium">{isAr ? (product.nameAr || product.name) : product.name}</p>
              <p className="text-sm text-primary mt-1">{product.price} KD</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryTilesBlock({ props, locale }: { props: any; locale: string }) {
  const isAr = locale === 'ar';
  const title = isAr ? (props.titleAr || props.titleEn) : props.titleEn;

  return (
    <section className="w-full py-10 px-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="font-serif text-3xl mb-6 text-center">{title}</h2>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(props.items || []).map((item: any, i: number) => {
            const tileTitle = isAr ? (item.titleAr || item.titleEn) : item.titleEn;
            return (
              <a key={i} href={item.link || '#'} className="group relative block aspect-video overflow-hidden bg-stone-100">
                {item.image && (
                  <img src={item.image} alt={tileTitle} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                )}
                {tileTitle && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <span className="text-white font-medium text-sm">{tileTitle}</span>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Row Layout Block — renders columns side by side ───────────────────────────
function RowLayoutBlock({ props, locale }: { props: any; locale: string }) {
  const isAr = locale === 'ar';
  // Determine flex ratios from split value e.g. "6-6" → [6,6], "4-8" → [4,8]
  const splitParts = (props.split || '6-6').split('-').map(Number);
  const columns: { blocks: PageBlock[] }[] = props.columns || splitParts.map(() => ({ blocks: [] }));

  return (
    <section className="w-full" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row w-full">
        {splitParts.map((flex, ci) => {
          const colBlocks: PageBlock[] = columns[ci]?.blocks || [];
          return (
            <div key={ci} style={{ flex }} className="min-w-0">
              {colBlocks.length > 0 ? (
                colBlocks.map((block) => (
                  <BlockRenderer key={block.id} block={block} locale={locale} />
                ))
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Main dispatcher ───────────────────────────────────────────────────────────
function BlockRenderer({ block, locale }: { block: PageBlock; locale: string }) {
  switch (block.type) {
    case 'row_layout': return <RowLayoutBlock props={block.props} locale={locale} />;
    case 'text_section': return <TextSectionBlock props={block.props} locale={locale} />;
    case 'hero_section': return <HeroSectionBlock props={block.props} locale={locale} />;
    case 'image_grid': return <ImageGridBlock props={block.props} locale={locale} />;
    case 'faq_accordion': return <FaqAccordionBlock props={block.props} locale={locale} />;
    case 'video_embed': return <VideoEmbedBlock props={block.props} locale={locale} />;
    case 'map_embed': return <MapEmbedBlock props={block.props} locale={locale} />;
    case 'contact_form': return <ContactFormBlock props={block.props} locale={locale} />;
    case 'split_banner': return <SplitBannerBlock props={block.props} locale={locale} />;
    case 'product_rail': return <ProductRailBlock props={block.props} locale={locale} />;
    case 'category_tiles': return <CategoryTilesBlock props={block.props} locale={locale} />;
    case 'spacer': return <div style={{ height: `${block.props.height || 60}px` }} />;
    default: return null;
  }
}

export default function CovePageRenderer({ blocks }: { blocks: PageBlock[] }) {
  const { locale } = useLanguage();
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="w-full">
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} locale={locale} />
      ))}
    </div>
  );
}
