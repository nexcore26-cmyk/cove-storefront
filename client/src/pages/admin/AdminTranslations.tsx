/**
 * Admin Translations — System Labels
 * Manage the Arabic translations for storefront UI strings.
 * Product and category translations are handled directly on their respective edit pages.
 */
import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Globe, Loader2, Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ─── Label groups for display ────────────────────────────────────────────────
const GROUP_LABELS: Record<string, string> = {
  product: 'Product Page',
  product_page: 'Product Page',
};

// ─── Single editable row ─────────────────────────────────────────────────────
function LabelRow({ label, onSaved }: { label: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [labelEn, setLabelEn] = useState(label.labelEn);
  const [labelAr, setLabelAr] = useState(label.labelAr || '');

  const upsert = trpc.translations.upsertSystemLabel.useMutation({
    onSuccess: () => {
      toast.success('Label saved');
      setEditing(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!labelEn.trim()) { toast.error('English label is required'); return; }
    upsert.mutate({ key: label.key, labelEn: labelEn.trim(), labelAr: labelAr.trim() });
  };

  const handleCancel = () => {
    setLabelEn(label.labelEn);
    setLabelAr(label.labelAr || '');
    setEditing(false);
  };

  const hasArabic = (label.labelAr || '').trim().length > 0;

  return (
    <div className="border rounded-lg p-4 bg-white" style={{ borderColor: '#E8E4DC' }}>
      <div className="flex items-start justify-between gap-4">
        {/* Key + status */}
        <div className="flex items-center gap-3 min-w-0">
          <code className="text-xs px-2 py-1 rounded font-mono" style={{ backgroundColor: '#F5F2EC', color: '#6B6B63' }}>
            {label.key}
          </code>
          {hasArabic ? (
            <Badge className="text-xs" style={{ backgroundColor: '#D4EDDA', color: '#155724', border: 'none' }}>
              <Check className="w-3 h-3 mr-1" /> Translated
            </Badge>
          ) : (
            <Badge className="text-xs" style={{ backgroundColor: '#FFF3CD', color: '#856404', border: 'none' }}>
              Missing Arabic
            </Badge>
          )}
        </div>
        {/* Edit toggle */}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border transition-colors"
            style={{ borderColor: '#9D7D39', color: '#9D7D39' }}>
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        /* Read-only view */
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>ENGLISH</p>
            <p className="text-sm" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>{label.labelEn}</p>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>ARABIC</p>
            <p className="text-sm text-right" dir="rtl" style={{ color: hasArabic ? '#242424' : '#AAAAAA', fontFamily: 'Montserrat, sans-serif' }}>
              {hasArabic ? label.labelAr : '— not set —'}
            </p>
          </div>
        </div>
      ) : (
        /* Edit form */
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#8A8A82' }}>ENGLISH</label>
              <Input
                value={labelEn}
                onChange={e => setLabelEn(e.target.value)}
                className="text-sm"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#8A8A82' }}>ARABIC</label>
              <Input
                value={labelAr}
                onChange={e => setLabelAr(e.target.value)}
                dir="rtl"
                className="text-sm text-right"
                placeholder="أدخل الترجمة العربية"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border"
              style={{ borderColor: '#D4C9B8', color: '#6B6B63' }}>
              <X className="w-3 h-3" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="flex items-center gap-1 text-xs px-4 py-1.5 rounded text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#9D7D39' }}>
              {upsert.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminTranslations() {
  const utils = trpc.useUtils();
  const { data: labels = [], isLoading } = trpc.translations.getSystemLabels.useQuery();

  const handleSaved = () => {
    utils.translations.getSystemLabels.invalidate();
  };

  // Group labels by their group field
  const grouped = labels.reduce((acc: Record<string, any[]>, label: any) => {
    const g = label.group || 'product';
    if (!acc[g]) acc[g] = [];
    acc[g].push(label);
    return acc;
  }, {});

  const translatedCount = labels.filter((l: any) => (l.labelAr || '').trim().length > 0).length;
  const totalCount = labels.length;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Globe className="w-6 h-6" style={{ color: '#9D7D39' }} />
            <div>
              <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
                Translations
              </h1>
              <p className="text-sm mt-0.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Manage Arabic translations for storefront UI labels
              </p>
            </div>
          </div>
          {/* Progress badge */}
          {!isLoading && totalCount > 0 && (
            <div className="text-sm px-4 py-2 rounded-full" style={{ backgroundColor: '#F5F2EC', color: '#6B6B63', fontFamily: 'Montserrat, sans-serif' }}>
              {translatedCount} / {totalCount} translated
            </div>
          )}
        </div>

        {/* Info note */}
        <div className="mb-6 p-4 rounded-lg text-sm" style={{ backgroundColor: '#F5F2EC', color: '#6B6B63', fontFamily: 'Montserrat, sans-serif', borderLeft: '3px solid #9D7D39' }}>
          <strong>Note:</strong> Product names, descriptions, and category names are translated directly from their respective edit pages in the admin panel. This page manages the storefront UI labels that appear on every product page.
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#9D7D39' }} />
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([group, groupLabels]) => (
              <div key={group}>
                <h2 className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                  {GROUP_LABELS[group] || group}
                </h2>
                <div className="space-y-3">
                  {(groupLabels as any[]).map((label: any) => (
                    <LabelRow key={label.key} label={label} onSaved={handleSaved} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
