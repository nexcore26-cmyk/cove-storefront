/**
 * Admin CMS — Homepage Sections Editor
 * Allows admin to edit hero, featured-categories, brand-story, and newsletter-banner
 * content (title, subtitle, CTA) in both English and Arabic.
 */
import { useState } from 'react';
import { Loader2, Globe, Save, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const SECTION_LABELS: Record<string, string> = {
  'hero': 'Hero Banner',
  'featured-categories': 'Featured Categories',
  'brand-story': 'Brand Story',
  'newsletter-banner': 'Newsletter Banner',
};

interface SectionForm {
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  ctaText: string;
  ctaTextAr: string;
  ctaUrl: string;
  imageUrl: string;
  isActive: boolean;
}

function SectionEditor({
  section,
  onSave,
  isSaving,
}: {
  section: any;
  onSave: (key: string, data: Partial<SectionForm>) => void;
  isSaving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<SectionForm>({
    title: section.title || '',
    titleAr: section.titleAr || '',
    subtitle: section.subtitle || '',
    subtitleAr: section.subtitleAr || '',
    ctaText: section.ctaText || '',
    ctaTextAr: section.ctaTextAr || '',
    ctaUrl: section.ctaUrl || '',
    imageUrl: section.imageUrl || '',
    isActive: section.isActive ?? true,
  });

  function set(key: keyof SectionForm, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave(section.sectionKey, {
      ...form,
      ctaUrl: form.ctaUrl || null as any,
      imageUrl: form.imageUrl || null as any,
    });
  }

  const label = SECTION_LABELS[section.sectionKey] || section.sectionKey;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ border: '1px solid #E8E4DC' }}>
      {/* Header row */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        style={{ borderBottom: expanded ? '1px solid #E8E4DC' : 'none' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: form.isActive ? '#10B981' : '#D4C9B8' }}
          />
          <p className="text-sm font-semibold" style={{ color: '#242420', fontFamily: 'Montserrat, sans-serif' }}>
            {label}
          </p>
          <span className="text-[10px] tracking-wider uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
            {section.sectionKey}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); set('isActive', !form.isActive); }}
            className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-1 border transition-colors"
            style={{
              borderColor: form.isActive ? '#10B981' : '#E8E4DC',
              color: form.isActive ? '#10B981' : '#8A8A82',
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            {form.isActive ? <Eye size={10} /> : <EyeOff size={10} />}
            {form.isActive ? 'Visible' : 'Hidden'}
          </button>
          {expanded ? <ChevronUp size={16} style={{ color: '#8A8A82' }} /> : <ChevronDown size={16} style={{ color: '#8A8A82' }} />}
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="px-5 py-5 flex flex-col gap-5">
          {/* Title row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Title (English)
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className="w-full px-3 py-2 text-sm border focus:outline-none focus:border-[#9D7D39]"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242420' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Title (Arabic) <Globe size={9} className="inline ml-1" />
              </label>
              <input
                type="text"
                value={form.titleAr}
                onChange={(e) => set('titleAr', e.target.value)}
                dir="rtl"
                className="w-full px-3 py-2 text-sm border focus:outline-none focus:border-[#9D7D39]"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242420' }}
              />
            </div>
          </div>

          {/* Subtitle row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Subtitle (English)
              </label>
              <textarea
                value={form.subtitle}
                onChange={(e) => set('subtitle', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border focus:outline-none focus:border-[#9D7D39] resize-none"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242420' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Subtitle (Arabic) <Globe size={9} className="inline ml-1" />
              </label>
              <textarea
                value={form.subtitleAr}
                onChange={(e) => set('subtitleAr', e.target.value)}
                dir="rtl"
                rows={3}
                className="w-full px-3 py-2 text-sm border focus:outline-none focus:border-[#9D7D39] resize-none"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242420' }}
              />
            </div>
          </div>

          {/* CTA row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                CTA Button Text (EN)
              </label>
              <input
                type="text"
                value={form.ctaText}
                onChange={(e) => set('ctaText', e.target.value)}
                className="w-full px-3 py-2 text-sm border focus:outline-none focus:border-[#9D7D39]"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242420' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                CTA Button Text (AR) <Globe size={9} className="inline ml-1" />
              </label>
              <input
                type="text"
                value={form.ctaTextAr}
                onChange={(e) => set('ctaTextAr', e.target.value)}
                dir="rtl"
                className="w-full px-3 py-2 text-sm border focus:outline-none focus:border-[#9D7D39]"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242420' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                CTA URL
              </label>
              <input
                type="text"
                value={form.ctaUrl}
                onChange={(e) => set('ctaUrl', e.target.value)}
                placeholder="/shop"
                className="w-full px-3 py-2 text-sm border focus:outline-none focus:border-[#9D7D39]"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242420' }}
              />
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Background / Hero Image URL <span style={{ color: '#D4C9B8' }}>(optional — leave blank to use default)</span>
            </label>
            <input
              type="text"
              value={form.imageUrl}
              onChange={(e) => set('imageUrl', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border focus:outline-none focus:border-[#9D7D39]"
              style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242420' }}
            />
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold tracking-[0.15em] uppercase transition-colors disabled:opacity-60"
              style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
            >
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCMS() {
  const utils = trpc.useUtils();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: sections, isLoading } = trpc.cms.getSections.useQuery();

  const updateMutation = trpc.cms.updateSection.useMutation({
    onSuccess: () => {
      utils.cms.getSections.invalidate();
      setSavingKey(null);
      toast.success('Section updated successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save section');
      setSavingKey(null);
    },
  });

  function handleSave(sectionKey: string, data: any) {
    setSavingKey(sectionKey);
    updateMutation.mutate({ sectionKey, ...data });
  }

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
            Content Management
          </p>
          <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            Homepage Sections
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
            Edit the text, CTA buttons, and visibility of each homepage section. Changes are reflected live.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin" size={28} style={{ color: '#9D7D39' }} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {(sections || []).map((section: any) => (
              <SectionEditor
                key={section.sectionKey}
                section={section}
                onSave={handleSave}
                isSaving={savingKey === section.sectionKey}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
