/**
 * PortfolioDetail — /portfolio/:slug
 *
 * Shows a single portfolio item:
 *  - Title (EN/AR), description (EN/AR)
 *  - Cover image (full-width hero)
 *  - Optional YouTube/video embed
 *  - Gallery grid with lightbox on click
 *  - Back link to parent category page (/cp/ or /events/)
 * Bilingual: EN/AR via useLanguage().
 */
import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/layout/Layout';
import { X, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    // Direct video URL — return as-is for <video> tag
    return url;
  } catch {
    return null;
  }
}

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

export default function PortfolioDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { locale, t } = useLanguage();
  const { data, isLoading, error } = trpc.portfolio.getItem.useQuery({ slug: slug || '' });

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900" />
        </div>
      </Layout>
    );
  }

  if (!data || error) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-3">404</h1>
            <p className="text-muted-foreground mb-6">{t('Project not found', 'المشروع غير موجود')}</p>
            <Link href="/cp"><button className="text-sm underline text-gray-600">{t('Back to Portfolio', 'العودة إلى المعرض')}</button></Link>
          </div>
        </div>
      </Layout>
    );
  }

  const title = locale === 'ar' && data.titleAr ? data.titleAr : data.title;
  const description = locale === 'ar' && data.descriptionAr ? data.descriptionAr : data.description;
  const backHref = data.category?.type === 'events' ? '/events' : '/cp';
  const backLabel = data.category?.type === 'events' ? t('Back to Events', 'العودة إلى الفعاليات') : t('Back to Portfolio', 'العودة إلى المعرض');
  const images = data.images ?? [];
  const videoUrl = data.videoUrl;
  const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;

  function openLightbox(index: number) { setLightboxIndex(index); }
  function closeLightbox() { setLightboxIndex(null); }
  function prevImage() { if (lightboxIndex === null) return; setLightboxIndex((lightboxIndex - 1 + images.length) % images.length); }
  function nextImage() { if (lightboxIndex === null) return; setLightboxIndex((lightboxIndex + 1) % images.length); }

  return (
    <Layout>
      <div className="min-h-screen bg-white" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {/* Hero / Cover Image */}
        {data.coverImage && (
          <div className="w-full aspect-[21/9] max-h-[520px] overflow-hidden bg-gray-100">
            <img src={data.coverImage} alt={title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Back link */}
          <Link href={backHref}>
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#C9A84C] transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              {backLabel}
            </button>
          </Link>

          {/* Title + gold divider */}
          <h1 className="text-3xl md:text-4xl font-serif text-gray-900 mb-4">{title}</h1>
          <div className="w-12 h-0.5 bg-[#C9A84C] mb-6" />

          {/* Description */}
          {description && (
            <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed mb-10 whitespace-pre-line">
              {description}
            </div>
          )}

          {/* Video Embed */}
          {embedUrl && (
            <div className="mb-10">
              {isYouTubeUrl(videoUrl!) ? (
                <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={embedUrl}
                    title={title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <video controls className="w-full rounded-lg" src={embedUrl}>
                  {t('Your browser does not support video.', 'متصفحك لا يدعم الفيديو.')}
                </video>
              )}
            </div>
          )}

          {/* Gallery Grid */}
          {images.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('Gallery', 'معرض الصور')}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, i) => (
                  <div
                    key={img.id}
                    className="aspect-[4/3] overflow-hidden rounded-lg bg-gray-100 cursor-pointer group"
                    onClick={() => openLightbox(i)}
                  >
                    <img
                      src={img.url}
                      alt={img.altText ?? title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            onClick={closeLightbox}
          >
            <X className="w-8 h-8" />
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              className="absolute left-4 text-white hover:text-gray-300 z-10 p-2"
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Image */}
          <div className="max-w-5xl max-h-[90vh] px-16" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[lightboxIndex].url}
              alt={images[lightboxIndex].altText ?? title}
              className="max-w-full max-h-[85vh] object-contain rounded"
            />
            <div className="text-center text-white/60 text-sm mt-3">
              {lightboxIndex + 1} / {images.length}
            </div>
          </div>

          {/* Next */}
          {images.length > 1 && (
            <button
              className="absolute right-4 text-white hover:text-gray-300 z-10 p-2"
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
        </div>
      )}
    </Layout>
  );
}
