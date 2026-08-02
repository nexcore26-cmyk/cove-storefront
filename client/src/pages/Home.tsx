/**
 * Home — Cove Interior Luxury Storefront Homepage
 * Renders the homepage via Legacy Blocks (BlockRenderer).
 * The homepage is managed via Page Builder > Homepage > Legacy Blocks.
 */
import { Loader2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import BlockRenderer from '@/components/cms/BlockRenderer';

export default function Home() {
  const { locale } = useLanguage();
  const { data: homePage, isLoading, error } = trpc.pageBuilder.getPage.useQuery({ slug: 'home' });

  const cmsBlocks = (homePage?.blocks || [])
    .filter((block: any) => block.isVisible)
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading homepage content" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <section className="container py-24 text-center">
          <p className="text-sm text-muted-foreground">Homepage content is temporarily unavailable.</p>
        </section>
      </Layout>
    );
  }

  if (!homePage || cmsBlocks.length === 0) {
    return (
      <Layout>
        <section className="container py-24 text-center">
          <p className="text-sm text-muted-foreground">Homepage content is not configured yet.</p>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        {cmsBlocks.map((block: any) => (
          <BlockRenderer key={block.id} block={block} locale={locale} />
        ))}
      </div>
    </Layout>
  );
}
