import { useParams, Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import BlockRenderer from '@/components/cms/BlockRenderer';
import CovePageRenderer from '@/components/cms/CovePageRenderer';

export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useLanguage();
  const { data: page, isLoading, error } = trpc.pageBuilder.getPage.useQuery({ slug: slug || '' });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900" />
      </div>
    );
  }

  if (!page || error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-3">404</h1>
          <p className="text-muted-foreground mb-6">Page not found</p>
          <Link href="/"><Button>Go Home</Button></Link>
        </div>
      </div>
    );
  }

  if (!page.isPublished) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-3">Coming Soon</h1>
          <p className="text-muted-foreground">This page is not yet published.</p>
        </div>
      </div>
    );
  }

  // Check if page was built with the new CovePageBuilder
  const puckData = page.puckData as any;
  const isCoveBuilder = puckData?._coveBuilder === true;
  const coveBlocks = isCoveBuilder ? (puckData?.content || []) : [];

  // Legacy blocks (for pages not yet migrated to new builder)
  const legacyBlocks = (page.blocks || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  return (
    <Layout>
      {isCoveBuilder ? (
        <CovePageRenderer blocks={coveBlocks} />
      ) : (
        <div>
          {legacyBlocks.map((block: any) => (
            <BlockRenderer key={block.id} block={block} locale={locale} />
          ))}
        </div>
      )}
    </Layout>
  );
}
