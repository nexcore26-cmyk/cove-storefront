/**
 * TextSectionEditor
 *
 * Full-screen popup editor for the Text Section Puck component.
 * Opens when the user clicks the pencil (edit) icon on a Text Section block.
 *
 * Features:
 *  - English / Arabic tabs (same as product editor)
 *  - Rich text editor (CoveRichTextEditor) for content in each language
 *  - Eyebrow label field (EN + AR)
 *  - Section background: color picker OR image URL
 *  - Save button updates the Puck component props
 */
import React, { useState, useEffect } from 'react';
import { CoveRichTextEditor } from './CoveRichTextEditor';
import { X } from 'lucide-react';

export interface TextSectionData {
  eyebrow?: string;
  eyebrowAr?: string;
  content?: string;
  contentAr?: string;
  bgColor?: string;
  bgImage?: string;
  width?: 'narrow' | 'default' | 'wide';
}

interface TextSectionEditorProps {
  open: boolean;
  initialData: TextSectionData;
  onSave: (data: TextSectionData) => void;
  onClose: () => void;
}

export function TextSectionEditor({ open, initialData, onSave, onClose }: TextSectionEditorProps) {
  const [tab, setTab] = useState<'en' | 'ar'>('en');
  const [data, setData] = useState<TextSectionData>(initialData);

  // Reset state when popup opens with new data
  useEffect(() => {
    if (open) {
      setData(initialData);
      setTab('en');
    }
  }, [open, initialData]);

  if (!open) return null;

  const update = (patch: Partial<TextSectionData>) => setData((prev) => ({ ...prev, ...patch }));

  const handleSave = () => {
    onSave(data);
    onClose();
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
           style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#FAF8F4] px-6 py-4">
          <h2 className="font-serif text-lg font-medium text-[#242424]">Edit Text Section</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* EN / AR tabs */}
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm font-medium">
            <button
              type="button"
              onClick={() => setTab('en')}
              className={`flex-1 py-2.5 transition-colors ${tab === 'en' ? 'bg-[#242424] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setTab('ar')}
              className={`flex-1 border-l border-slate-200 py-2.5 transition-colors ${tab === 'ar' ? 'bg-[#242424] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Arabic
            </button>
          </div>

          {/* English tab */}
          {tab === 'en' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Eyebrow Label (English)
                </label>
                <input
                  type="text"
                  value={data.eyebrow || ''}
                  onChange={(e) => update({ eyebrow: e.target.value })}
                  placeholder="e.g. Introduction, About Cove"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Content (English)
                </label>
                <CoveRichTextEditor
                  value={data.content || ''}
                  onChange={(html) => update({ content: html })}
                  dir="ltr"
                  minHeight={200}
                />
              </div>
            </div>
          )}

          {/* Arabic tab */}
          {tab === 'ar' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Eyebrow Label (Arabic)
                </label>
                <input
                  type="text"
                  value={data.eyebrowAr || ''}
                  onChange={(e) => update({ eyebrowAr: e.target.value })}
                  placeholder="e.g. مقدمة"
                  dir="rtl"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Content (Arabic)
                </label>
                <CoveRichTextEditor
                  value={data.contentAr || ''}
                  onChange={(html) => update({ contentAr: html })}
                  dir="rtl"
                  minHeight={200}
                  placeholder="<p>أدخل المحتوى هنا...</p>"
                />
              </div>
            </div>
          )}

          {/* Section Background */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Section Background</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Color</label>
                <input
                  type="color"
                  value={data.bgColor || '#ffffff'}
                  onChange={(e) => update({ bgColor: e.target.value, bgImage: '' })}
                  className="h-9 w-14 cursor-pointer rounded border border-slate-300 p-0.5"
                  title="Section background color"
                />
                <button
                  type="button"
                  onClick={() => update({ bgColor: '' })}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Clear
                </button>
              </div>
              <span className="text-xs text-slate-400">or</span>
              <div className="flex flex-1 items-center gap-2">
                <label className="text-sm text-slate-600 whitespace-nowrap">Image URL</label>
                <input
                  type="text"
                  value={data.bgImage || ''}
                  onChange={(e) => update({ bgImage: e.target.value, bgColor: '' })}
                  placeholder="https://... or /media/..."
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-[#C9A84C] focus:outline-none"
                />
              </div>
            </div>
            {(data.bgColor || data.bgImage) && (
              <div
                className="h-12 w-full rounded-lg border border-slate-200"
                style={{
                  backgroundColor: data.bgColor || undefined,
                  backgroundImage: data.bgImage ? `url(${data.bgImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            )}
          </div>

          {/* Width */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Content Width
            </label>
            <div className="flex gap-2">
              {(['narrow', 'default', 'wide'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => update({ width: w })}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition-colors ${
                    (data.width || 'default') === w
                      ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#9D7D39]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-[#FAF8F4] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-[#242424] px-6 py-2 text-sm font-semibold text-white hover:bg-[#C9A84C] transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
