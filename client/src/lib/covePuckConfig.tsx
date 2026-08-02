import type { Config, Data } from '@measured/puck';
import React, { useState } from 'react';
import { TextSectionEditor, type TextSectionData } from '@/components/TextSectionEditor';
import { Pencil } from 'lucide-react';

type HeroProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaHref?: string;
  align?: 'left' | 'center';
};

type TextProps = {
  eyebrow?: string;
  eyebrowAr?: string;
  content?: string;
  contentAr?: string;
  bgColor?: string;
  bgImage?: string;
  width?: 'narrow' | 'default' | 'wide';
};

type ProductRailProps = {
  title?: string;
  subtitle?: string;
  categoryId?: string;
  limit?: number;
  columns?: number;
};

type CategoryTilesProps = {
  title?: string;
  subtitle?: string;
  columns?: number;
};

type BannerSplitProps = {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaHref?: string;
  imageSide?: 'left' | 'right';
};

type SpacerProps = {
  height?: number;
};
type ImageGridItem = { url: string; link?: string; alt?: string };
type ImageGridProps = {
  title?: string;
  images?: ImageGridItem[];
  columns?: number;
};
type FaqItem = { question: string; answer: string };
type FaqSectionProps = {
  title?: string;
  items?: FaqItem[];
};
type VideoEmbedProps = {
  title?: string;
  videoUrl?: string;
  caption?: string;
};
type MapEmbedProps = {
  title?: string;
  embedUrl?: string;
  height?: number;
};
type ContactFormProps = {
  title?: string;
  subtitle?: string;
  recipientEmail?: string;
};


type CovePuckComponents = {
  Hero: HeroProps;
  TextSection: TextProps;
  ProductRail: ProductRailProps;
  CategoryTiles: CategoryTilesProps;
  BannerSplit: BannerSplitProps;
  Spacer: SpacerProps;
  ImageGrid: ImageGridProps;
  FaqSection: FaqSectionProps;
  VideoEmbed: VideoEmbedProps;
  MapEmbed: MapEmbedProps;
  ContactForm: ContactFormProps;
};

const sectionClass = 'mx-auto w-full max-w-7xl px-6 lg:px-10';

export const emptyPuckData: Data = {
  content: [],
  root: { props: { title: 'Cove Page' } },
};

export function normalizePuckData(data: unknown): Data {
  if (!data || typeof data !== 'object') return emptyPuckData;
  const candidate = data as Partial<Data>;
  return {
    content: Array.isArray(candidate.content) ? candidate.content : [],
    root: candidate.root && typeof candidate.root === 'object' ? candidate.root : emptyPuckData.root,
  };
}

export const covePuckConfig: Config<CovePuckComponents> = {
  root: {
    fields: {
      title: { type: 'text', label: 'Page title' },
    },
    render: ({ children }) => <div className="bg-[#FAF8F4] text-[#242424]">{children}</div>,
  },
  components: {
    Hero: {
      label: 'Hero Section',
      fields: {
        eyebrow: { type: 'text', label: 'Eyebrow' },
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'textarea', label: 'Subtitle' },
        imageUrl: { type: 'text', label: 'Image URL' },
        ctaText: { type: 'text', label: 'CTA text' },
        ctaHref: { type: 'text', label: 'CTA link' },
        align: {
          type: 'select',
          label: 'Alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
          ],
        },
      },
      defaultProps: {
        eyebrow: 'Cove Interior',
        title: 'Curated pieces for refined interiors',
        subtitle: 'Build a storefront landing page with reusable, tenant-managed Cove sections.',
        imageUrl: '',
        ctaText: 'Shop now',
        ctaHref: '/shop',
        align: 'left',
      },
      render: ({ eyebrow, title, subtitle, imageUrl, ctaText, ctaHref, align }) => (
        <section className="relative overflow-hidden bg-[#242424] text-white">
          {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
          <div className={`relative ${sectionClass} flex min-h-[520px] items-center py-24 ${align === 'center' ? 'justify-center text-center' : ''}`}>
            <div className="max-w-3xl">
              {eyebrow && <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-[#D8B56D]">{eyebrow}</p>}
              <h1 className="font-serif text-5xl font-light leading-tight md:text-7xl">{title}</h1>
              {subtitle && <p className="mt-6 max-w-2xl text-base leading-8 text-white/75">{subtitle}</p>}
              {ctaText && ctaHref && <a href={ctaHref} className="mt-8 inline-flex rounded-full bg-white px-8 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#242424] transition hover:bg-[#D8B56D]">{ctaText}</a>}
            </div>
          </div>
        </section>
      ),
    },
    TextSection: {
      label: 'Text Section',
      fields: {
        eyebrow:   { type: 'text', label: 'Eyebrow (EN)' },
        eyebrowAr: { type: 'text', label: 'Eyebrow (AR)' },
        content:   { type: 'textarea', label: 'Content HTML (EN)' },
        contentAr: { type: 'textarea', label: 'Content HTML (AR)' },
        bgColor:   { type: 'text', label: 'Background color (hex)' },
        bgImage:   { type: 'text', label: 'Background image URL' },
        width: {
          type: 'select',
          label: 'Width',
          options: [
            { label: 'Narrow', value: 'narrow' },
            { label: 'Default', value: 'default' },
            { label: 'Wide', value: 'wide' },
          ],
        },
      },
      defaultProps: {
        eyebrow: '',
        eyebrowAr: '',
        content: '<p>Enter your content here...</p>',
        contentAr: '',
        bgColor: '',
        bgImage: '',
        width: 'default',
      },
      render: (props) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [editorOpen, setEditorOpen] = useState(false);
        const { eyebrow, content, bgColor, bgImage, width } = props;
        const maxWidth = width === 'narrow' ? 'max-w-3xl' : width === 'wide' ? 'max-w-6xl' : 'max-w-4xl';
        const sectionStyle: React.CSSProperties = {};
        if (bgImage) {
          sectionStyle.backgroundImage = `url(${bgImage})`;
          sectionStyle.backgroundSize = 'cover';
          sectionStyle.backgroundPosition = 'center';
        } else if (bgColor) {
          sectionStyle.backgroundColor = bgColor;
        }
        const initialData: TextSectionData = {
          eyebrow: props.eyebrow,
          eyebrowAr: props.eyebrowAr,
          content: props.content,
          contentAr: props.contentAr,
          bgColor: props.bgColor,
          bgImage: props.bgImage,
          width: props.width,
        };
        return (
          <>
            <section className="relative w-full py-20" style={sectionStyle}>
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-[#242424]/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-[#C9A84C] transition-colors"
                title="Edit Text Section"
              >
                <Pencil size={12} />
                Edit
              </button>
              <div className={`${sectionClass} ${maxWidth} mx-auto`}>
                {eyebrow && (
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#9D7D39]">{eyebrow}</p>
                )}
                {content ? (
                  <div
                    className="prose prose-sm max-w-none leading-8"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                ) : (
                  <p className="text-sm text-slate-400 italic">Click Edit to add content...</p>
                )}
              </div>
            </section>
            <TextSectionEditor
              open={editorOpen}
              initialData={initialData}
              onSave={(data) => {
                window.dispatchEvent(new CustomEvent('cove:puck:update-text-section', {
                  detail: { data },
                }));
              }}
              onClose={() => setEditorOpen(false)}
            />
          </>
        );
      },
    },
    ProductRail: {
      label: 'Product Rail',
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'textarea', label: 'Subtitle' },
        categoryId: { type: 'text', label: 'Optional category ID' },
        limit: { type: 'number', label: 'Product limit', min: 1, max: 24 },
        columns: { type: 'number', label: 'Desktop columns', min: 2, max: 5 },
      },
      defaultProps: {
        title: 'Featured selection',
        subtitle: 'A storefront-rendered product rail can resolve live products by category or curated product logic.',
        categoryId: '',
        limit: 8,
        columns: 4,
      },
      render: ({ title, subtitle, categoryId, limit, columns }) => (
        <section className={`${sectionClass} py-20`}>
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-serif text-4xl font-light text-[#242424]">{title}</h2>
              {subtitle && <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6F6A60]">{subtitle}</p>}
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#9D7D39]">{categoryId ? `Category ${categoryId}` : 'All products'} · {limit} items</p>
          </div>
          <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.max(2, Math.min(columns || 4, 5))}, minmax(0, 1fr))` }}>
            {Array.from({ length: Math.min(limit || 4, 8) }).map((_, index) => (
              <div key={index} className="rounded-xl border border-[#E4DED3] bg-white p-4 shadow-sm">
                <div className="aspect-[4/5] rounded-lg bg-[#EFE8DC]" />
                <p className="mt-4 text-sm font-medium text-[#242424]">Product placeholder</p>
                <p className="mt-1 text-xs text-[#8A8A82]">Resolved by storefront renderer</p>
              </div>
            ))}
          </div>
        </section>
      ),
    },
    CategoryTiles: {
      label: 'Category Tiles',
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'textarea', label: 'Subtitle' },
        columns: { type: 'number', label: 'Columns', min: 2, max: 5 },
      },
      defaultProps: {
        title: 'Shop by room',
        subtitle: 'Use storefront category data to render tenant-owned collection paths.',
        columns: 3,
      },
      render: ({ title, subtitle, columns }) => (
        <section className={`${sectionClass} py-20`}>
          <div className="mb-10 text-center">
            <h2 className="font-serif text-4xl font-light text-[#242424]">{title}</h2>
            {subtitle && <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#6F6A60]">{subtitle}</p>}
          </div>
          <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.max(2, Math.min(columns || 3, 5))}, minmax(0, 1fr))` }}>
            {['Living', 'Dining', 'Accessories', 'Lighting', 'Outdoor'].slice(0, columns || 3).map((name) => (
              <div key={name} className="group relative min-h-[260px] overflow-hidden rounded-xl bg-[#242424] p-6 text-white">
                <div className="absolute inset-0 bg-gradient-to-br from-[#9D7D39]/60 to-transparent opacity-70" />
                <div className="relative mt-auto flex h-full items-end">
                  <h3 className="font-serif text-3xl font-light">{name}</h3>
                </div>
              </div>
            ))}
          </div>
        </section>
      ),
    },
    BannerSplit: {
      label: 'Split Banner',
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'textarea', label: 'Subtitle' },
        imageUrl: { type: 'text', label: 'Image URL' },
        ctaText: { type: 'text', label: 'CTA text' },
        ctaHref: { type: 'text', label: 'CTA link' },
        imageSide: {
          type: 'select',
          label: 'Image side',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ],
        },
      },
      defaultProps: {
        title: 'Interior styling services',
        subtitle: 'Promote a campaign, service, or room edit with a flexible image and content layout.',
        imageUrl: '',
        ctaText: 'Explore',
        ctaHref: '/shop',
        imageSide: 'right',
      },
      render: ({ title, subtitle, imageUrl, ctaText, ctaHref, imageSide }) => (
        <section className={`${sectionClass} py-20`}>
          <div className="grid overflow-hidden rounded-2xl border border-[#E4DED3] bg-white shadow-sm md:grid-cols-2">
            <div className={`min-h-[360px] bg-[#EFE8DC] ${imageSide === 'right' ? 'md:order-2' : ''}`}>
              {imageUrl && <img src={imageUrl} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex flex-col justify-center p-10 md:p-14">
              <h2 className="font-serif text-4xl font-light text-[#242424]">{title}</h2>
              {subtitle && <p className="mt-5 text-sm leading-7 text-[#6F6A60]">{subtitle}</p>}
              {ctaText && ctaHref && <a href={ctaHref} className="mt-8 inline-flex w-fit rounded-full bg-[#242424] px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#9D7D39]">{ctaText}</a>}
            </div>
          </div>
        </section>
      ),
    },
    Spacer: {
      label: 'Spacer',
      fields: {
        height: { type: 'number', label: 'Height in pixels', min: 16, max: 240 },
      },
      defaultProps: { height: 64 },
      render: ({ height }) => <div style={{ height: `${height || 64}px` }} aria-hidden />,
    },
    ImageGrid: {
      label: 'Image Grid',
      fields: {
        title: { type: 'text', label: 'Section Title (optional)' },
        columns: { type: 'number', label: 'Columns (2-4)', min: 2, max: 4 },
        images: {
          type: 'array',
          label: 'Images',
          arrayFields: {
            url: { type: 'text', label: 'Image URL' },
            link: { type: 'text', label: 'Link URL (optional)' },
            alt: { type: 'text', label: 'Alt text' },
          },
          defaultItemProps: { url: '', link: '', alt: '' },
        },
      },
      defaultProps: {
        title: '',
        columns: 2,
        images: [
          { url: '', link: '', alt: 'Image 1' },
          { url: '', link: '', alt: 'Image 2' },
          { url: '', link: '', alt: 'Image 3' },
          { url: '', link: '', alt: 'Image 4' },
        ],
      },
      render: ({ title, images = [], columns = 2 }) => (
        <section className={`${sectionClass} py-16`}>
          {title && (
            <h2 className="font-serif text-3xl font-light text-[#242424] text-center mb-10">{title}</h2>
          )}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.max(2, Math.min(columns, 4))}, minmax(0, 1fr))` }}
          >
            {images.map((img, i) => {
              const imgEl = (
                <div key={i} className="overflow-hidden rounded-lg bg-gray-100 aspect-square group">
                  {img.url ? (
                    <img
                      src={img.url}
                      alt={img.alt || ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
                      No image
                    </div>
                  )}
                </div>
              );
              return img.link ? (
                <a key={i} href={img.link}>{imgEl}</a>
              ) : imgEl;
            })}
          </div>
        </section>
      ),
    },
    FaqSection: {
      label: 'FAQ / Accordion',
      fields: {
        title: { type: 'text', label: 'Section Title' },
        items: {
          type: 'array',
          label: 'FAQ Items',
          arrayFields: {
            question: { type: 'text', label: 'Question' },
            answer: { type: 'textarea', label: 'Answer' },
          },
          defaultItemProps: { question: 'Question?', answer: 'Answer here.' },
        },
      },
      defaultProps: {
        title: 'Frequently Asked Questions',
        items: [
          { question: 'What services do you offer?', answer: 'We offer interior design, furniture supply, and project management services.' },
          { question: 'Do you work on residential and commercial projects?', answer: 'Yes, we work on both residential and commercial projects across Kuwait.' },
        ],
      },
      render: ({ title, items = [] }) => {
        // Note: Puck renders are static — accordion state requires client-side JS
        // We render all answers visible in the builder; on the storefront, the FaqSection
        // component handles accordion state via the storefront renderer.
        return (
          <section className={`${sectionClass} py-16`}>
            {title && (
              <h2 className="font-serif text-3xl font-light text-[#242424] mb-10">{title}</h2>
            )}
            <div className="divide-y divide-[#E4DED3]">
              {items.map((item, i) => (
                <details key={i} className="group py-5">
                  <summary className="flex cursor-pointer items-center justify-between text-base font-medium text-[#242424] list-none">
                    {item.question}
                    <span className="ml-4 text-[#C9A84C] text-xl group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-[#6F6A60]">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        );
      },
    },
    VideoEmbed: {
      label: 'Video Embed',
      fields: {
        title: { type: 'text', label: 'Section Title (optional)' },
        videoUrl: { type: 'text', label: 'YouTube or video URL' },
        caption: { type: 'text', label: 'Caption (optional)' },
      },
      defaultProps: {
        title: '',
        videoUrl: '',
        caption: '',
      },
      render: ({ title, videoUrl, caption }) => {
        let embedUrl = videoUrl || '';
        if (embedUrl.includes('youtube.com/watch')) {
          try {
            const u = new URL(embedUrl);
            const v = u.searchParams.get('v');
            if (v) embedUrl = `https://www.youtube.com/embed/${v}`;
          } catch {}
        } else if (embedUrl.includes('youtu.be/')) {
          try {
            const u = new URL(embedUrl);
            embedUrl = `https://www.youtube.com/embed${u.pathname}`;
          } catch {}
        }
        const isYT = embedUrl.includes('youtube.com/embed');
        return (
          <section className={`${sectionClass} py-16`}>
            {title && <h2 className="font-serif text-3xl font-light text-[#242424] text-center mb-8">{title}</h2>}
            {embedUrl ? (
              isYT ? (
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={title || 'Video'}
                  />
                </div>
              ) : (
                <video controls className="w-full rounded-xl shadow-lg" src={embedUrl} />
              )
            ) : (
              <div className="aspect-video w-full rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                No video URL set
              </div>
            )}
            {caption && <p className="text-center text-sm text-[#6F6A60] mt-4">{caption}</p>}
          </section>
        );
      },
    },
    MapEmbed: {
      label: 'Map Embed',
      fields: {
        title: { type: 'text', label: 'Section Title (optional)' },
        embedUrl: { type: 'text', label: 'Google Maps Embed URL (iframe src)' },
        height: { type: 'number', label: 'Map height in pixels', min: 200, max: 800 },
      },
      defaultProps: {
        title: 'Find Us',
        embedUrl: '',
        height: 400,
      },
      render: ({ title, embedUrl, height = 400 }) => (
        <section className={`${sectionClass} py-16`}>
          {title && <h2 className="font-serif text-3xl font-light text-[#242424] text-center mb-8">{title}</h2>}
          {embedUrl ? (
            <div className="rounded-xl overflow-hidden shadow-lg" style={{ height: `${height}px` }}>
              <iframe
                src={embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={title || 'Map'}
              />
            </div>
          ) : (
            <div
              className="rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm"
              style={{ height: `${height}px` }}
            >
              Paste a Google Maps embed URL in the settings panel
            </div>
          )}
        </section>
      ),
    },
    ContactForm: {
      label: 'Contact Form',
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'textarea', label: 'Subtitle / description' },
        recipientEmail: { type: 'text', label: 'Recipient email (for display only)' },
      },
      defaultProps: {
        title: 'Get in Touch',
        subtitle: 'We would love to hear from you. Fill in the form below and our team will get back to you shortly.',
        recipientEmail: '',
      },
      render: ({ title, subtitle }) => (
        <section className={`${sectionClass} py-16`}>
          <div className="max-w-2xl mx-auto">
            {title && <h2 className="font-serif text-3xl font-light text-[#242424] text-center mb-3">{title}</h2>}
            {subtitle && <p className="text-center text-sm text-[#6F6A60] mb-10">{subtitle}</p>}
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#242424] mb-1.5">Full Name</label>
                  <input type="text" className="w-full border border-[#E4DED3] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]" placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#242424] mb-1.5">Email</label>
                  <input type="email" className="w-full border border-[#E4DED3] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]" placeholder="your@email.com" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#242424] mb-1.5">Phone</label>
                <input type="tel" className="w-full border border-[#E4DED3] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]" placeholder="+965 XXXX XXXX" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#242424] mb-1.5">Message</label>
                <textarea rows={5} className="w-full border border-[#E4DED3] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C] resize-none" placeholder="Tell us about your project..." />
              </div>
              <button type="submit" className="w-full bg-[#242424] text-white rounded-full py-3.5 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-[#C9A84C] transition-colors">
                Send Message
              </button>
            </form>
          </div>
        </section>
      ),
    },
  },
};
