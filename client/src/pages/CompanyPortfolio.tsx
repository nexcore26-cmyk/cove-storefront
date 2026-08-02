/**
 * CompanyPortfolio — /cp/
 *
 * Displays portfolio categories as tabs. Each tab shows a grid of portfolio items.
 * Clicking an item navigates to /portfolio/[slug].
 * Categories with type='portfolio' are shown here.
 * Bilingual: EN/AR via useLanguage().
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/layout/Layout';

export default function CompanyPortfolio() {
  const { locale, t } = useLanguage();
  const { data: categories = [], isLoading: catsLoading } = trpc.portfolio.listCategories.useQuery({ type: 'portfolio' });
  const [activeTab, setActiveTab] = useState<number | null>(null);

  // Set first tab as default once loaded
  const resolvedTab = activeTab ?? (categories[0]?.id ?? null);

  const { data: items = [], isLoading: itemsLoading } = trpc.portfolio.listItems.useQuery(
    { categoryId: resolvedTab ?? undefined, visibleOnly: true },
    { enabled: resolvedTab !== null }
  );

  if (catsLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Page Header */}
        <div className="bg-[#1a1a1a] py-16 px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-serif text-white tracking-wide">
            {t('Company Portfolio', 'معرض الأعمال')}
          </h1>
          <div className="w-12 h-0.5 bg-[#C9A84C] mx-auto mt-4" />
        </div>

        {/* Tabs */}
        {categories.length > 0 && (
          <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
            <div className="max-w-6xl mx-auto px-6">
              <div className="flex gap-0 overflow-x-auto scrollbar-hide" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                {categories.map((cat) => {
                  const isActive = resolvedTab === cat.id;
                  const label = locale === 'ar' && cat.nameAr ? cat.nameAr : cat.name;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveTab(cat.id)}
                      className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                        isActive
                          ? 'border-[#C9A84C] text-[#C9A84C]'
                          : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Items Grid */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          {itemsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              {t('No projects in this category yet.', 'لا توجد مشاريع في هذه الفئة بعد.')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => {
                const title = locale === 'ar' && item.titleAr ? item.titleAr : item.title;
                return (
                  <Link key={item.id} href={`/portfolio/${item.slug}`}>
                    <div className="group cursor-pointer overflow-hidden rounded-lg bg-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="aspect-[4/3] overflow-hidden bg-gray-200">
                        {item.coverImage ? (
                          <img
                            src={item.coverImage}
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-medium text-gray-900 group-hover:text-[#C9A84C] transition-colors" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                          {title}
                        </h3>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
