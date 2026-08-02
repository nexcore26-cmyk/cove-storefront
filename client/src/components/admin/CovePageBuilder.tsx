import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Trash2, ChevronUp, ChevronDown, GripVertical, Plus, Globe } from 'lucide-react';
import { toast } from 'sonner';

// ─── Rich Text Editor (same as product editor) ────────────────────────────────
const EDITOR_TEXT_COLORS = [
  { label: 'Black', value: '#111827' },
  { label: 'Gold', value: '#a8873f' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Gray', value: '#475569' },
  { label: 'White', value: '#ffffff' },
];

type RichEditorProps = { value: string; onChange: (v: string) => void; dir?: 'ltr' | 'rtl' };

function RichEditor({ value, onChange, dir = 'ltr' }: RichEditorProps) {
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const isRTL = dir === 'rtl';

  useEffect(() => {
    if (mode !== 'visual') return;
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;
    if (editor.innerHTML !== (value || '')) editor.innerHTML = value || '';
  }, [value, mode]);

  const saveSelection = () => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0 || !sel.anchorNode) return;
    if (editor.contains(sel.anchorNode)) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const editor = editorRef.current;
    const range = savedRangeRef.current;
    if (!editor || !range) return;
    const sel = window.getSelection();
    if (!sel) return;
    editor.focus();
    sel.removeAllRanges();
    sel.addRange(range);
  };
  const syncValue = () => { const html = editorRef.current?.innerHTML ?? ''; onChange(html); saveSelection(); };
  const run = (cmd: string, val?: string) => { restoreSelection(); document.execCommand(cmd, false, val); syncValue(); };
  const addLink = () => { const href = window.prompt('Paste the link URL'); if (href) run('createLink', href); };

  const toolbarBtn = 'min-w-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100';
  const editorClass = `min-h-32 bg-white px-4 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/20 [&_a]:text-primary [&_a]:underline ${
    isRTL ? 'text-right [&_ul]:pr-6 [&_ol]:pr-6' : 'text-left [&_ul]:pl-6 [&_ol]:pl-6'
  }`;

  return (
    <div className="rounded border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-1">
        <div className="flex flex-wrap items-center gap-1">
          <select className="h-7 rounded border border-slate-300 bg-white px-1 text-xs" defaultValue="P"
            onChange={(e) => { run('formatBlock', e.target.value); e.currentTarget.value = 'P'; }}>
            <option value="P">Paragraph</option>
            <option value="H2">Heading 2</option>
            <option value="H3">Heading 3</option>
            <option value="BLOCKQUOTE">Quote</option>
          </select>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); run('bold'); }}><strong>B</strong></button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); run('italic'); }}><em>I</em></button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); run('underline'); }}><span className="underline">U</span></button>
          <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1 py-0.5">
            <span className="text-[11px] font-semibold text-slate-600">Color</span>
            {EDITOR_TEXT_COLORS.map((c) => (
              <button key={c.value} type="button" className="h-5 w-5 rounded border border-slate-300"
                style={{ backgroundColor: c.value }} title={c.label}
                onMouseDown={(e) => { e.preventDefault(); run('foreColor', c.value); }} />
            ))}
            <input type="color" className="h-5 w-6 cursor-pointer rounded border border-slate-300 p-0"
              defaultValue="#111827" onMouseDown={saveSelection} onChange={(e) => run('foreColor', e.target.value)} />
          </div>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); run('insertUnorderedList'); }}>• List</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); run('insertOrderedList'); }}>1. List</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); run('justifyLeft'); }}>Left</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); run('justifyCenter'); }}>Center</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); run('justifyRight'); }}>Right</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); addLink(); }}>Link</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); run('unlink'); }}>Unlink</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); run('removeFormat'); }}>Clear</button>
        </div>
        <div className="flex gap-1 ml-2">
          <button type="button" className={`${toolbarBtn} ${mode === 'visual' ? 'bg-primary text-white' : ''}`} onClick={() => setMode('visual')}>Visual</button>
          <button type="button" className={`${toolbarBtn} ${mode === 'code' ? 'bg-primary text-white' : ''}`} onClick={() => setMode('code')}>Code</button>
        </div>
      </div>
      {mode === 'visual' ? (
        <>
          <div ref={editorRef} contentEditable suppressContentEditableWarning dir={dir}
            className={editorClass} onInput={syncValue} onMouseUp={saveSelection} onKeyUp={saveSelection} onBlur={syncValue} />
          <div className="border-t border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-muted-foreground">Visual editor. Use Code mode for exact HTML markup.</div>
        </>
      ) : (
        <Textarea value={value || ''} onChange={(e) => onChange(e.target.value)}
          className="min-h-40 rounded-none border-0 font-mono text-xs focus-visible:ring-0"
          placeholder="<p>Your HTML here...</p>" />
      )}
    </div>
  );
}

// ─── EN/AR Tab wrapper ─────────────────────────────────────────────────────────
function BilingualRichEditor({ valueEn, valueAr, onChangeEn, onChangeAr }: {
  valueEn: string; valueAr: string; onChangeEn: (v: string) => void; onChangeAr: (v: string) => void;
}) {
  const [tab, setTab] = useState<'en' | 'ar'>('en');
  return (
    <div>
      <div className="flex border-b border-slate-200 mb-3">
        <button type="button" onClick={() => setTab('en')}
          className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'en' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          English
        </button>
        <button type="button" onClick={() => setTab('ar')}
          className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'ar' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Arabic
        </button>
      </div>
      {tab === 'en' ? <RichEditor value={valueEn} onChange={onChangeEn} dir="ltr" /> : <RichEditor value={valueAr} onChange={onChangeAr} dir="rtl" />}
    </div>
  );
}

// ─── Block type registry ───────────────────────────────────────────────────────
export type BlockType =
  | 'text_section'
  | 'hero_section'
  | 'image_grid'
  | 'faq_accordion'
  | 'video_embed'
  | 'map_embed'
  | 'contact_form'
  | 'split_banner'
  | 'product_rail'
  | 'category_tiles'
  | 'spacer'
  | 'row_layout';

// Column split options for Row Layout
export const ROW_SPLITS = [
  { label: 'Full (12/12)', value: '12', cols: ['12'] },
  { label: 'Half / Half (6+6)', value: '6-6', cols: ['6', '6'] },
  { label: '1/3 + 2/3', value: '4-8', cols: ['4', '8'] },
  { label: '2/3 + 1/3', value: '8-4', cols: ['8', '4'] },
  { label: '1/4 + 3/4', value: '3-9', cols: ['3', '9'] },
  { label: '3/4 + 1/4', value: '9-3', cols: ['9', '3'] },
  { label: '1/3 + 1/3 + 1/3', value: '4-4-4', cols: ['4', '4', '4'] },
  { label: '1/4 + 1/4 + 1/2', value: '3-3-6', cols: ['3', '3', '6'] },
  { label: '1/4 × 4', value: '3-3-3-3', cols: ['3', '3', '3', '3'] },
];

export const BLOCK_REGISTRY: { type: BlockType; label: string; icon: string; defaultProps: Record<string, any> }[] = [
  { type: 'row_layout', label: 'Row / Columns', icon: '▦', defaultProps: { split: '6-6', columns: [{ blocks: [] }, { blocks: [] }] } },
  { type: 'text_section', label: 'Text Section', icon: '¶', defaultProps: { eyebrowEn: '', eyebrowAr: '', contentEn: '', contentAr: '', bgColor: '', bgImage: '', width: 'default' } },
  { type: 'hero_section', label: 'Hero Section', icon: '▣', defaultProps: { slides: [{ image: '', titleEn: 'Welcome', titleAr: 'أهلاً', subtitleEn: '', subtitleAr: '', ctaTextEn: 'Shop Now', ctaTextAr: 'تسوق الآن', ctaLink: '/shop' }], autoplay: true, interval: 5000 } },
  { type: 'image_grid', label: 'Image Grid', icon: '⊞', defaultProps: { titleEn: '', titleAr: '', columns: 3, items: [{ image: '', link: '' }, { image: '', link: '' }, { image: '', link: '' }] } },
  { type: 'faq_accordion', label: 'FAQ / Accordion', icon: '≡', defaultProps: { titleEn: '', titleAr: '', items: [{ questionEn: '', questionAr: '', answerEn: '', answerAr: '' }] } },
  { type: 'video_embed', label: 'Video Embed', icon: '▶', defaultProps: { titleEn: '', titleAr: '', videoUrl: '', bgColor: '' } },
  { type: 'map_embed', label: 'Map Embed', icon: '⊕', defaultProps: { titleEn: '', titleAr: '', embedUrl: '' } },
  { type: 'contact_form', label: 'Contact Form', icon: '✉', defaultProps: { titleEn: 'Contact Us', titleAr: 'تواصل معنا', bgColor: '' } },
  { type: 'split_banner', label: 'Split Banner', icon: '⊟', defaultProps: { image: '', titleEn: '', titleAr: '', bodyEn: '', bodyAr: '', ctaTextEn: '', ctaTextAr: '', ctaLink: '', flip: false } },
  { type: 'product_rail', label: 'Product Rail', icon: '⊡', defaultProps: { titleEn: 'Featured Products', titleAr: 'منتجات مميزة', categoryId: '', limit: 8, columns: 4 } },
  { type: 'category_tiles', label: 'Category Tiles', icon: '⊠', defaultProps: { titleEn: '', titleAr: '', items: [{ image: '', titleEn: '', titleAr: '', link: '' }] } },
  { type: 'spacer', label: 'Spacer', icon: '↕', defaultProps: { height: 60 } },
];

export interface PageBlock {
  id: string;
  type: BlockType;
  props: Record<string, any>;
}

// ─── Row column inner editor ──────────────────────────────────────────────────
function RowColumnEditor({ rowBlock, onUpdateRow }: { rowBlock: PageBlock; onUpdateRow: (props: any) => void }) {
  const p = rowBlock.props;
  const splitDef = ROW_SPLITS.find((s) => s.value === p.split) || ROW_SPLITS[1];
  const [addingToCol, setAddingToCol] = useState<number | null>(null);
  const [editingColBlock, setEditingColBlock] = useState<{ colIdx: number; block: PageBlock } | null>(null);

  const generateId = () => `block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const getColumns = (): { blocks: PageBlock[] }[] => {
    const cols = p.columns || [];
    return splitDef.cols.map((_, ci) => ({ blocks: cols[ci]?.blocks || [] }));
  };

  const saveColumns = (cols: { blocks: PageBlock[] }[]) => {
    onUpdateRow({ ...p, columns: cols });
  };

  const addBlockToCol = (colIdx: number, type: BlockType) => {
    const reg = BLOCK_REGISTRY.find((r) => r.type === type)!;
    const newBlock: PageBlock = { id: generateId(), type, props: { ...reg.defaultProps } };
    const cols = getColumns();
    cols[colIdx] = { blocks: [...cols[colIdx].blocks, newBlock] };
    saveColumns(cols);
    setAddingToCol(null);
  };

  const deleteColBlock = (colIdx: number, blockId: string) => {
    const cols = getColumns();
    cols[colIdx] = { blocks: cols[colIdx].blocks.filter((b) => b.id !== blockId) };
    saveColumns(cols);
  };

  const moveColBlock = (colIdx: number, blockIdx: number, dir: 'up' | 'down') => {
    const cols = getColumns();
    const arr = [...cols[colIdx].blocks];
    const swap = dir === 'up' ? blockIdx - 1 : blockIdx + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[blockIdx], arr[swap]] = [arr[swap], arr[blockIdx]];
    cols[colIdx] = { blocks: arr };
    saveColumns(cols);
  };

  const updateColBlock = (colIdx: number, blockId: string, props: any) => {
    const cols = getColumns();
    cols[colIdx] = { blocks: cols[colIdx].blocks.map((b) => b.id === blockId ? { ...b, props } : b) };
    saveColumns(cols);
  };

  const columns = getColumns();
  // Exclude row_layout from inner palette to avoid infinite nesting
  const innerRegistry = BLOCK_REGISTRY.filter((r) => r.type !== 'row_layout');

  return (
    <div className="w-full py-3 px-3 bg-slate-50">
      <div className="flex items-center gap-1 mb-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Row —</span>
        <span className="text-[11px] text-muted-foreground">{splitDef.label}</span>
      </div>
      <div className="flex gap-2">
        {splitDef.cols.map((col, ci) => (
          <div key={ci} className="border-2 border-dashed border-slate-300 rounded bg-white min-h-20 flex flex-col"
            style={{ flex: parseInt(col) }}>
            {/* Blocks inside this column */}
            {columns[ci].blocks.map((colBlock, bi) => (
              <div key={colBlock.id} className="group/inner relative border-b border-slate-100 last:border-b-0">
                <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 opacity-0 group-hover/inner:opacity-100 transition-opacity">
                  <div className="flex items-center gap-0.5 bg-white/95 rounded border shadow-sm px-0.5 py-0.5">
                    <button type="button" className="p-0.5 rounded hover:bg-slate-100" title="Move up" onClick={() => moveColBlock(ci, bi, 'up')} disabled={bi === 0}><ChevronUp className="h-3 w-3" /></button>
                    <button type="button" className="p-0.5 rounded hover:bg-slate-100" title="Move down" onClick={() => moveColBlock(ci, bi, 'down')} disabled={bi === columns[ci].blocks.length - 1}><ChevronDown className="h-3 w-3" /></button>
                    <button type="button" className="p-0.5 rounded hover:bg-blue-50 text-blue-600" title="Edit" onClick={() => setEditingColBlock({ colIdx: ci, block: colBlock })}><Pencil className="h-3 w-3" /></button>
                    <button type="button" className="p-0.5 rounded hover:bg-red-50 text-red-500" title="Delete" onClick={() => deleteColBlock(ci, colBlock.id)}><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
                <div className="scale-[0.85] origin-top-left w-[117%] overflow-hidden pointer-events-none">
                  <BlockPreview block={colBlock} />
                </div>
              </div>
            ))}
            {/* Add block button */}
            <button type="button"
              className="flex items-center justify-center gap-1 py-2 text-xs text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors mt-auto"
              onClick={() => setAddingToCol(ci)}>
              <Plus className="h-3.5 w-3.5" /> Add block
            </button>
          </div>
        ))}
      </div>

      {/* Block picker dialog for adding to a column */}
      {addingToCol !== null && (
        <Dialog open={true} onOpenChange={() => setAddingToCol(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add block to Column {addingToCol + 1}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-2 py-2">
              {innerRegistry.map((reg) => (
                <button key={reg.type} type="button"
                  className="flex items-center gap-2 px-3 py-2 rounded border text-sm text-left hover:bg-primary/5 hover:border-primary/40 transition-colors"
                  onClick={() => addBlockToCol(addingToCol, reg.type)}>
                  <span className="text-base w-5 text-center shrink-0">{reg.icon}</span>
                  <span>{reg.label}</span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Editor dialog for a block inside a column */}
      {editingColBlock && (
        <Dialog open={true} onOpenChange={() => setEditingColBlock(null)}>
          <BlockEditor
            block={editingColBlock.block}
            onSave={(props) => { updateColBlock(editingColBlock.colIdx, editingColBlock.block.id, props); setEditingColBlock(null); }}
            onClose={() => setEditingColBlock(null)}
          />
        </Dialog>
      )}
    </div>
  );
}

// ─── Block canvas preview renderers ───────────────────────────────────────────
function BlockPreview({ block, onUpdate }: { block: PageBlock; onUpdate?: (props: any) => void }) {
  const p = block.props;
  switch (block.type) {
    case 'row_layout': {
      if (onUpdate) {
        return <RowColumnEditor rowBlock={block} onUpdateRow={onUpdate} />;
      }
      // Fallback static preview (used inside nested column previews)
      const splitDef = ROW_SPLITS.find((s) => s.value === p.split) || ROW_SPLITS[1];
      return (
        <div className="w-full py-3 px-3 bg-slate-50">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Row —</span>
            <span className="text-[11px] text-muted-foreground">{splitDef.label}</span>
          </div>
          <div className="flex gap-2">
            {splitDef.cols.map((col, ci) => (
              <div key={ci} className="border-2 border-dashed border-slate-300 rounded bg-white flex items-center justify-center min-h-16 text-slate-400 text-xs"
                style={{ flex: parseInt(col) }}>
                {(p.columns?.[ci]?.blocks?.length || 0) > 0
                  ? `${p.columns[ci].blocks.length} block(s)`
                  : `Col ${ci + 1} (${col}/12)`}
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'text_section':
      return (
        <div className="w-full py-8 px-6" style={{ backgroundColor: p.bgColor || 'transparent', backgroundImage: p.bgImage ? `url(${p.bgImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className={`mx-auto ${p.width === 'narrow' ? 'max-w-xl' : p.width === 'wide' ? 'max-w-5xl' : 'max-w-3xl'}`}>
            {p.eyebrowEn && <p className="text-base font-semibold tracking-widest uppercase text-primary mb-2">{p.eyebrowEn}</p>}
            {p.contentEn ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: p.contentEn }} /> : <p className="text-muted-foreground text-sm italic">...Enter your content here</p>}
          </div>
        </div>
      );
    case 'hero_section':
      const slide = p.slides?.[0];
      return (
        <div className="w-full h-48 relative bg-slate-800 flex items-center justify-center overflow-hidden">
          {slide?.image && <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
          <div className="relative text-center text-white px-4">
            <p className="text-lg font-serif">{slide?.titleEn || 'Hero Section'}</p>
            {slide?.subtitleEn && <p className="text-sm opacity-80 mt-1">{slide.subtitleEn}</p>}
            {slide?.ctaTextEn && <span className="mt-2 inline-block border border-white px-4 py-1 text-xs">{slide.ctaTextEn}</span>}
          </div>
          {p.slides?.length > 1 && <span className="absolute bottom-2 right-3 text-white/60 text-xs">{p.slides.length} slides</span>}
        </div>
      );
    case 'image_grid':
      return (
        <div className="w-full py-6 px-4">
          {p.titleEn && <p className="text-center font-semibold mb-4">{p.titleEn}</p>}
          <div className={`grid gap-2 grid-cols-${Math.min(p.columns || 3, 4)}`}>
            {(p.items || []).map((item: any, i: number) => (
              <div key={i} className="aspect-square bg-slate-100 rounded overflow-hidden">
                {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">Image {i + 1}</div>}
              </div>
            ))}
          </div>
        </div>
      );
    case 'faq_accordion':
      return (
        <div className="w-full py-6 px-6">
          {p.titleEn && <p className="font-semibold mb-3">{p.titleEn}</p>}
          {(p.items || []).map((item: any, i: number) => (
            <div key={i} className="border-b border-slate-200 py-3 flex items-center justify-between">
              <p className="font-medium text-sm">{item.questionEn || `Question ${i + 1}`}</p>
              <span className="text-lg text-slate-400 ml-4">+</span>
            </div>
          ))}
        </div>
      );
    case 'video_embed':
      return (
        <div className="w-full py-8 px-6 text-center" style={{ backgroundColor: p.bgColor || '#f8f8f8' }}>
          {p.titleEn && <p className="font-semibold mb-3">{p.titleEn}</p>}
          <div className="mx-auto max-w-2xl aspect-video bg-slate-800 rounded flex items-center justify-center">
            {p.videoUrl ? <span className="text-white text-xs opacity-60 break-all px-4">{p.videoUrl}</span> : <span className="text-white/40 text-2xl">▶</span>}
          </div>
        </div>
      );
    case 'map_embed':
      return (
        <div className="w-full py-6 px-6">
          {p.titleEn && <p className="font-semibold mb-3">{p.titleEn}</p>}
          <div className="w-full h-40 bg-slate-100 rounded flex items-center justify-center">
            {p.embedUrl ? <span className="text-xs text-muted-foreground">Map embedded</span> : <span className="text-slate-400 text-sm">⊕ Map embed URL not set</span>}
          </div>
        </div>
      );
    case 'contact_form':
      return (
        <div className="w-full py-8 px-6" style={{ backgroundColor: p.bgColor || 'transparent' }}>
          <p className="font-semibold mb-4">{p.titleEn || 'Contact Us'}</p>
          <div className="grid grid-cols-2 gap-3 max-w-lg">
            <div className="h-9 rounded border border-slate-200 bg-slate-50" />
            <div className="h-9 rounded border border-slate-200 bg-slate-50" />
            <div className="h-9 rounded border border-slate-200 bg-slate-50 col-span-2" />
            <div className="h-20 rounded border border-slate-200 bg-slate-50 col-span-2" />
            <div className="h-9 rounded bg-primary/80 col-span-2" />
          </div>
        </div>
      );
    case 'split_banner':
      return (
        <div className={`w-full flex ${p.flip ? 'flex-row-reverse' : 'flex-row'} min-h-32`}>
          <div className="w-1/2 bg-slate-200 flex items-center justify-center text-slate-400 text-xs">
            {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : 'Image'}
          </div>
          <div className="w-1/2 p-4 flex flex-col justify-center">
            {p.titleEn && <p className="font-semibold text-sm mb-1">{p.titleEn}</p>}
            {p.bodyEn && <div className="text-xs text-muted-foreground line-clamp-3" dangerouslySetInnerHTML={{ __html: p.bodyEn }} />}
            {p.ctaTextEn && <span className="mt-2 inline-block bg-primary text-white text-xs px-3 py-1 self-start">{p.ctaTextEn}</span>}
          </div>
        </div>
      );
    case 'product_rail':
      return (
        <div className="w-full py-6 px-4">
          <p className="font-semibold mb-3 text-center">{p.titleEn || 'Product Rail'}</p>
          <div className={`grid gap-3 grid-cols-${Math.min(p.columns || 4, 4)}`}>
            {Array.from({ length: Math.min(p.limit || 4, 4) }).map((_, i) => (
              <div key={i} className="aspect-square bg-slate-100 rounded" />
            ))}
          </div>
        </div>
      );
    case 'category_tiles':
      return (
        <div className="w-full py-6 px-4">
          {p.titleEn && <p className="text-center font-semibold mb-4">{p.titleEn}</p>}
          <div className="grid grid-cols-3 gap-2">
            {(p.items || []).map((item: any, i: number) => (
              <div key={i} className="aspect-video bg-slate-100 rounded relative overflow-hidden">
                {item.image && <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <span className="text-xs font-medium">{item.titleEn || `Tile ${i + 1}`}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'spacer':
      return <div style={{ height: `${p.height || 60}px` }} className="w-full bg-slate-50/50 flex items-center justify-center"><span className="text-xs text-slate-300">Spacer — {p.height || 60}px</span></div>;
    default:
      return <div className="w-full py-4 px-6 bg-slate-50 text-sm text-muted-foreground">{block.type}</div>;
  }
}

// ─── Component popup editors ───────────────────────────────────────────────────

// ── Row Layout Editor ──────────────────────────────────────────────────────────
function RowLayoutEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [split, setSplit] = useState(props.split || '6-6');

  const handleSplitChange = (newSplit: string) => {
    setSplit(newSplit);
  };

  const handleSave = () => {
    const splitDef = ROW_SPLITS.find((s) => s.value === split) || ROW_SPLITS[1];
    const existingCols = props.columns || [];
    // Preserve existing column blocks when possible
    const newColumns = splitDef.cols.map((_, ci) => ({
      blocks: existingCols[ci]?.blocks || [],
    }));
    onSave({ split, columns: newColumns });
    onClose();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Edit Row / Columns</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <label className="text-sm font-medium block mb-2">Column Split</label>
          <div className="grid grid-cols-1 gap-2">
            {ROW_SPLITS.map((s) => {
              const isSelected = split === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => handleSplitChange(s.value)}
                  className={`flex items-center gap-3 px-3 py-2 rounded border text-sm text-left transition-colors ${isSelected ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-slate-200 hover:border-primary/40'}`}
                >
                  {/* Visual column preview */}
                  <div className="flex gap-0.5 shrink-0" style={{ width: 80 }}>
                    {s.cols.map((col, ci) => (
                      <div key={ci} className={`h-6 rounded-sm ${isSelected ? 'bg-primary/30' : 'bg-slate-200'}`} style={{ flex: parseInt(col) }} />
                    ))}
                  </div>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">After saving, click the pencil icon on each column to add blocks inside it. Columns inherit the page background.</p>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function TextSectionEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [p, setP] = useState({ ...props });
  const set = (k: string, v: any) => setP((prev: any) => ({ ...prev, [k]: v }));
  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit Text Section</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Eyebrow (EN)</label><Input value={p.eyebrowEn || ''} onChange={(e) => set('eyebrowEn', e.target.value)} placeholder="e.g. Introduction" /></div>
          <div><label className="text-sm font-medium">Eyebrow (AR)</label><Input value={p.eyebrowAr || ''} onChange={(e) => set('eyebrowAr', e.target.value)} placeholder="مثال: مقدمة" dir="rtl" /></div>
        </div>
        <div><label className="text-sm font-medium mb-2 block">Content</label>
          <BilingualRichEditor valueEn={p.contentEn || ''} valueAr={p.contentAr || ''} onChangeEn={(v) => set('contentEn', v)} onChangeAr={(v) => set('contentAr', v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Section Background Color</label>
            <div className="flex gap-2 mt-1"><input type="color" value={p.bgColor || '#ffffff'} onChange={(e) => set('bgColor', e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
              <Input value={p.bgColor || ''} onChange={(e) => set('bgColor', e.target.value)} placeholder="#ffffff or transparent" />
              {p.bgColor && <Button variant="ghost" size="sm" onClick={() => set('bgColor', '')}>Clear</Button>}
            </div>
          </div>
          <div><label className="text-sm font-medium">Section Background Image URL</label><Input value={p.bgImage || ''} onChange={(e) => set('bgImage', e.target.value)} placeholder="https://..." /></div>
        </div>
        <div><label className="text-sm font-medium">Content Width</label>
          <div className="flex gap-2 mt-1">
            {['narrow', 'default', 'wide'].map((w) => (
              <Button key={w} variant={p.width === w ? 'default' : 'outline'} size="sm" onClick={() => set('width', w)}>{w.charAt(0).toUpperCase() + w.slice(1)}</Button>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(p); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function HeroSectionEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [p, setP] = useState({ slides: props.slides || [{ image: '', titleEn: '', titleAr: '', subtitleEn: '', subtitleAr: '', ctaTextEn: 'Shop Now', ctaTextAr: 'تسوق الآن', ctaLink: '/shop' }], autoplay: props.autoplay ?? true, interval: props.interval || 5000 });
  const setSlide = (i: number, k: string, v: any) => setP((prev) => { const slides = [...prev.slides]; slides[i] = { ...slides[i], [k]: v }; return { ...prev, slides }; });
  const addSlide = () => setP((prev) => ({ ...prev, slides: [...prev.slides, { image: '', titleEn: '', titleAr: '', subtitleEn: '', subtitleAr: '', ctaTextEn: 'Shop Now', ctaTextAr: 'تسوق الآن', ctaLink: '/shop' }] }));
  const removeSlide = (i: number) => setP((prev) => ({ ...prev, slides: prev.slides.filter((_: any, idx: number) => idx !== i) }));
  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit Hero Section</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        {p.slides.map((slide: any, i: number) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between"><span className="font-medium text-sm">Slide {i + 1}</span>{p.slides.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeSlide(i)}><Trash2 className="h-4 w-4" /></Button>}</div>
            <div><label className="text-sm font-medium">Image URL</label><Input value={slide.image || ''} onChange={(e) => setSlide(i, 'image', e.target.value)} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Title (EN)</label><Input value={slide.titleEn || ''} onChange={(e) => setSlide(i, 'titleEn', e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Title (AR)</label><Input value={slide.titleAr || ''} onChange={(e) => setSlide(i, 'titleAr', e.target.value)} dir="rtl" /></div>
              <div><label className="text-xs text-muted-foreground">Subtitle (EN)</label><Input value={slide.subtitleEn || ''} onChange={(e) => setSlide(i, 'subtitleEn', e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Subtitle (AR)</label><Input value={slide.subtitleAr || ''} onChange={(e) => setSlide(i, 'subtitleAr', e.target.value)} dir="rtl" /></div>
              <div><label className="text-xs text-muted-foreground">CTA Text (EN)</label><Input value={slide.ctaTextEn || ''} onChange={(e) => setSlide(i, 'ctaTextEn', e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">CTA Text (AR)</label><Input value={slide.ctaTextAr || ''} onChange={(e) => setSlide(i, 'ctaTextAr', e.target.value)} dir="rtl" /></div>
              <div className="col-span-2"><label className="text-xs text-muted-foreground">CTA Link</label><Input value={slide.ctaLink || ''} onChange={(e) => setSlide(i, 'ctaLink', e.target.value)} placeholder="/shop" /></div>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addSlide}><Plus className="h-4 w-4 mr-1" />Add Slide</Button>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.autoplay} onChange={(e) => setP((prev) => ({ ...prev, autoplay: e.target.checked }))} />Autoplay</label>
          {p.autoplay && <div className="flex items-center gap-2"><label className="text-sm">Interval (ms)</label><Input type="number" value={p.interval} onChange={(e) => setP((prev) => ({ ...prev, interval: Number(e.target.value) }))} className="w-28" /></div>}
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(p); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function ImageGridEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [p, setP] = useState({ titleEn: props.titleEn || '', titleAr: props.titleAr || '', columns: props.columns || 3, items: props.items || [{ image: '', link: '' }] });
  const setItem = (i: number, k: string, v: string) => setP((prev) => { const items = [...prev.items]; items[i] = { ...items[i], [k]: v }; return { ...prev, items }; });
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit Image Grid</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Title (EN)</label><Input value={p.titleEn} onChange={(e) => setP((prev) => ({ ...prev, titleEn: e.target.value }))} /></div>
          <div><label className="text-sm font-medium">Title (AR)</label><Input value={p.titleAr} onChange={(e) => setP((prev) => ({ ...prev, titleAr: e.target.value }))} dir="rtl" /></div>
        </div>
        <div><label className="text-sm font-medium">Columns</label>
          <div className="flex gap-2 mt-1">{[2, 3, 4].map((c) => <Button key={c} variant={p.columns === c ? 'default' : 'outline'} size="sm" onClick={() => setP((prev) => ({ ...prev, columns: c }))}>{c}</Button>)}</div>
        </div>
        {p.items.map((item: any, i: number) => (
          <div key={i} className="border rounded p-3 space-y-2">
            <div className="flex justify-between items-center"><span className="text-sm font-medium">Image {i + 1}</span>
              {p.items.length > 1 && <Button variant="ghost" size="sm" onClick={() => setP((prev) => ({ ...prev, items: prev.items.filter((_: any, idx: number) => idx !== i) }))}><Trash2 className="h-4 w-4" /></Button>}
            </div>
            <Input value={item.image} onChange={(e) => setItem(i, 'image', e.target.value)} placeholder="Image URL" />
            <Input value={item.link} onChange={(e) => setItem(i, 'link', e.target.value)} placeholder="Link URL (optional)" />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setP((prev) => ({ ...prev, items: [...prev.items, { image: '', link: '' }] }))}><Plus className="h-4 w-4 mr-1" />Add Image</Button>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(p); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

// ── FAQ Editor — answers upgraded to rich text ─────────────────────────────────
function FaqEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [p, setP] = useState({ titleEn: props.titleEn || '', titleAr: props.titleAr || '', items: props.items || [{ questionEn: '', questionAr: '', answerEn: '', answerAr: '' }] });
  const setItem = (i: number, k: string, v: string) => setP((prev) => { const items = [...prev.items]; items[i] = { ...items[i], [k]: v }; return { ...prev, items }; });
  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit FAQ / Accordion</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Section Title (EN)</label><Input value={p.titleEn} onChange={(e) => setP((prev) => ({ ...prev, titleEn: e.target.value }))} /></div>
          <div><label className="text-sm font-medium">Section Title (AR)</label><Input value={p.titleAr} onChange={(e) => setP((prev) => ({ ...prev, titleAr: e.target.value }))} dir="rtl" /></div>
        </div>
        {p.items.map((item: any, i: number) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center"><span className="font-medium text-sm">Item {i + 1}</span>
              {p.items.length > 1 && <Button variant="ghost" size="sm" onClick={() => setP((prev) => ({ ...prev, items: prev.items.filter((_: any, idx: number) => idx !== i) }))}><Trash2 className="h-4 w-4" /></Button>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Question (EN)</label><Input value={item.questionEn} onChange={(e) => setItem(i, 'questionEn', e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Question (AR)</label><Input value={item.questionAr} onChange={(e) => setItem(i, 'questionAr', e.target.value)} dir="rtl" /></div>
            </div>
            {/* Answer — rich text editor with EN/AR tabs */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Answer</label>
              <BilingualRichEditor
                valueEn={item.answerEn || ''}
                valueAr={item.answerAr || ''}
                onChangeEn={(v) => setItem(i, 'answerEn', v)}
                onChangeAr={(v) => setItem(i, 'answerAr', v)}
              />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setP((prev) => ({ ...prev, items: [...prev.items, { questionEn: '', questionAr: '', answerEn: '', answerAr: '' }] }))}><Plus className="h-4 w-4 mr-1" />Add Item</Button>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(p); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function VideoEmbedEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [p, setP] = useState({ titleEn: props.titleEn || '', titleAr: props.titleAr || '', videoUrl: props.videoUrl || '', bgColor: props.bgColor || '' });
  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>Edit Video Embed</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Title (EN)</label><Input value={p.titleEn} onChange={(e) => setP((prev) => ({ ...prev, titleEn: e.target.value }))} /></div>
          <div><label className="text-sm font-medium">Title (AR)</label><Input value={p.titleAr} onChange={(e) => setP((prev) => ({ ...prev, titleAr: e.target.value }))} dir="rtl" /></div>
        </div>
        <div><label className="text-sm font-medium">Video URL (YouTube or direct)</label><Input value={p.videoUrl} onChange={(e) => setP((prev) => ({ ...prev, videoUrl: e.target.value }))} placeholder="https://www.youtube.com/embed/..." /></div>
        <div><label className="text-sm font-medium">Background Color</label>
          <div className="flex gap-2 mt-1"><input type="color" value={p.bgColor || '#f8f8f8'} onChange={(e) => setP((prev) => ({ ...prev, bgColor: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer" />
            <Input value={p.bgColor} onChange={(e) => setP((prev) => ({ ...prev, bgColor: e.target.value }))} placeholder="#f8f8f8" />
          </div>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(p); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function MapEmbedEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [p, setP] = useState({ titleEn: props.titleEn || '', titleAr: props.titleAr || '', embedUrl: props.embedUrl || '' });
  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>Edit Map Embed</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Title (EN)</label><Input value={p.titleEn} onChange={(e) => setP((prev) => ({ ...prev, titleEn: e.target.value }))} /></div>
          <div><label className="text-sm font-medium">Title (AR)</label><Input value={p.titleAr} onChange={(e) => setP((prev) => ({ ...prev, titleAr: e.target.value }))} dir="rtl" /></div>
        </div>
        <div><label className="text-sm font-medium">Google Maps Embed URL</label>
          <p className="text-xs text-muted-foreground mb-1">Go to Google Maps → Share → Embed a map → copy the src URL from the iframe code</p>
          <Textarea value={p.embedUrl} onChange={(e) => setP((prev) => ({ ...prev, embedUrl: e.target.value }))} placeholder="https://www.google.com/maps/embed?pb=..." rows={3} />
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(p); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function ContactFormEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [p, setP] = useState({ titleEn: props.titleEn || 'Contact Us', titleAr: props.titleAr || 'تواصل معنا', bgColor: props.bgColor || '' });
  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>Edit Contact Form</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Section Title (EN)</label><Input value={p.titleEn} onChange={(e) => setP((prev) => ({ ...prev, titleEn: e.target.value }))} /></div>
          <div><label className="text-sm font-medium">Section Title (AR)</label><Input value={p.titleAr} onChange={(e) => setP((prev) => ({ ...prev, titleAr: e.target.value }))} dir="rtl" /></div>
        </div>
        <div><label className="text-sm font-medium">Background Color</label>
          <div className="flex gap-2 mt-1"><input type="color" value={p.bgColor || '#ffffff'} onChange={(e) => setP((prev) => ({ ...prev, bgColor: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer" />
            <Input value={p.bgColor} onChange={(e) => setP((prev) => ({ ...prev, bgColor: e.target.value }))} placeholder="transparent" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">The contact form includes: Name, Email, Phone, Message fields and a Submit button. Form submissions are sent to the store contact email.</p>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(p); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function SplitBannerEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [p, setP] = useState({ image: props.image || '', titleEn: props.titleEn || '', titleAr: props.titleAr || '', bodyEn: props.bodyEn || '', bodyAr: props.bodyAr || '', ctaTextEn: props.ctaTextEn || '', ctaTextAr: props.ctaTextAr || '', ctaLink: props.ctaLink || '', flip: props.flip || false });
  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit Split Banner</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div><label className="text-sm font-medium">Image URL</label><Input value={p.image} onChange={(e) => setP((prev) => ({ ...prev, image: e.target.value }))} placeholder="https://..." /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Title (EN)</label><Input value={p.titleEn} onChange={(e) => setP((prev) => ({ ...prev, titleEn: e.target.value }))} /></div>
          <div><label className="text-sm font-medium">Title (AR)</label><Input value={p.titleAr} onChange={(e) => setP((prev) => ({ ...prev, titleAr: e.target.value }))} dir="rtl" /></div>
        </div>
        <div><label className="text-sm font-medium mb-2 block">Body Text</label>
          <BilingualRichEditor valueEn={p.bodyEn} valueAr={p.bodyAr} onChangeEn={(v) => setP((prev) => ({ ...prev, bodyEn: v }))} onChangeAr={(v) => setP((prev) => ({ ...prev, bodyAr: v }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">CTA Text (EN)</label><Input value={p.ctaTextEn} onChange={(e) => setP((prev) => ({ ...prev, ctaTextEn: e.target.value }))} /></div>
          <div><label className="text-sm font-medium">CTA Text (AR)</label><Input value={p.ctaTextAr} onChange={(e) => setP((prev) => ({ ...prev, ctaTextAr: e.target.value }))} dir="rtl" /></div>
          <div className="col-span-2"><label className="text-sm font-medium">CTA Link</label><Input value={p.ctaLink} onChange={(e) => setP((prev) => ({ ...prev, ctaLink: e.target.value }))} placeholder="/shop" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.flip} onChange={(e) => setP((prev) => ({ ...prev, flip: e.target.checked }))} />Flip layout (image on right)</label>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(p); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function ProductRailEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [p, setP] = useState({ titleEn: props.titleEn || '', titleAr: props.titleAr || '', categoryId: props.categoryId || '', limit: props.limit || 8, columns: props.columns || 4 });
  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>Edit Product Rail</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Title (EN)</label><Input value={p.titleEn} onChange={(e) => setP((prev) => ({ ...prev, titleEn: e.target.value }))} /></div>
          <div><label className="text-sm font-medium">Title (AR)</label><Input value={p.titleAr} onChange={(e) => setP((prev) => ({ ...prev, titleAr: e.target.value }))} dir="rtl" /></div>
        </div>
        <div><label className="text-sm font-medium">Category ID (leave empty for all products)</label><Input value={p.categoryId} onChange={(e) => setP((prev) => ({ ...prev, categoryId: e.target.value }))} placeholder="e.g. 5" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Number of Products</label><Input type="number" value={p.limit} onChange={(e) => setP((prev) => ({ ...prev, limit: Number(e.target.value) }))} /></div>
          <div><label className="text-sm font-medium">Columns</label>
            <div className="flex gap-2 mt-1">{[2, 3, 4].map((c) => <Button key={c} variant={p.columns === c ? 'default' : 'outline'} size="sm" onClick={() => setP((prev) => ({ ...prev, columns: c }))}>{c}</Button>)}</div>
          </div>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(p); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function CategoryTilesEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [p, setP] = useState({ titleEn: props.titleEn || '', titleAr: props.titleAr || '', items: props.items || [{ image: '', titleEn: '', titleAr: '', link: '' }] });
  const setItem = (i: number, k: string, v: string) => setP((prev) => { const items = [...prev.items]; items[i] = { ...items[i], [k]: v }; return { ...prev, items }; });
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit Category Tiles</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Section Title (EN)</label><Input value={p.titleEn} onChange={(e) => setP((prev) => ({ ...prev, titleEn: e.target.value }))} /></div>
          <div><label className="text-sm font-medium">Section Title (AR)</label><Input value={p.titleAr} onChange={(e) => setP((prev) => ({ ...prev, titleAr: e.target.value }))} dir="rtl" /></div>
        </div>
        {p.items.map((item: any, i: number) => (
          <div key={i} className="border rounded p-3 space-y-2">
            <div className="flex justify-between items-center"><span className="text-sm font-medium">Tile {i + 1}</span>
              {p.items.length > 1 && <Button variant="ghost" size="sm" onClick={() => setP((prev) => ({ ...prev, items: prev.items.filter((_: any, idx: number) => idx !== i) }))}><Trash2 className="h-4 w-4" /></Button>}
            </div>
            <Input value={item.image} onChange={(e) => setItem(i, 'image', e.target.value)} placeholder="Image URL" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={item.titleEn} onChange={(e) => setItem(i, 'titleEn', e.target.value)} placeholder="Title (EN)" />
              <Input value={item.titleAr} onChange={(e) => setItem(i, 'titleAr', e.target.value)} placeholder="العنوان" dir="rtl" />
            </div>
            <Input value={item.link} onChange={(e) => setItem(i, 'link', e.target.value)} placeholder="Link URL" />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setP((prev) => ({ ...prev, items: [...prev.items, { image: '', titleEn: '', titleAr: '', link: '' }] }))}><Plus className="h-4 w-4 mr-1" />Add Tile</Button>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(p); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function SpacerEditor({ props, onSave, onClose }: { props: any; onSave: (p: any) => void; onClose: () => void }) {
  const [height, setHeight] = useState(props.height || 60);
  return (
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Edit Spacer</DialogTitle></DialogHeader>
      <div className="py-4">
        <label className="text-sm font-medium">Height (pixels)</label>
        <Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} min={10} max={400} className="mt-1" />
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave({ height }); onClose(); }}>Save Changes</Button></DialogFooter>
    </DialogContent>
  );
}

function BlockEditor({ block, onSave, onClose }: { block: PageBlock; onSave: (props: any) => void; onClose: () => void }) {
  switch (block.type) {
    case 'row_layout': return <RowLayoutEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'text_section': return <TextSectionEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'hero_section': return <HeroSectionEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'image_grid': return <ImageGridEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'faq_accordion': return <FaqEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'video_embed': return <VideoEmbedEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'map_embed': return <MapEmbedEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'contact_form': return <ContactFormEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'split_banner': return <SplitBannerEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'product_rail': return <ProductRailEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'category_tiles': return <CategoryTilesEditor props={block.props} onSave={onSave} onClose={onClose} />;
    case 'spacer': return <SpacerEditor props={block.props} onSave={onSave} onClose={onClose} />;
    default: return null;
  }
}

// ─── Main CovePageBuilder component ───────────────────────────────────────────
interface CovePageBuilderProps {
  initialBlocks: PageBlock[];
  onPublish: (blocks: PageBlock[]) => void;
  isSaving?: boolean;
}

export default function CovePageBuilder({ initialBlocks, onPublish, isSaving }: CovePageBuilderProps) {
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks);
  const [editingBlock, setEditingBlock] = useState<PageBlock | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => { setBlocks(initialBlocks); }, [JSON.stringify(initialBlocks)]);

  const generateId = () => `block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const addBlock = (type: BlockType) => {
    const reg = BLOCK_REGISTRY.find((r) => r.type === type)!;
    const newBlock: PageBlock = { id: generateId(), type, props: { ...reg.defaultProps } };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const updateBlock = (id: string, props: any) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, props } : b));
  };

  const deleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (index: number, dir: 'up' | 'down') => {
    setBlocks((prev) => {
      const arr = [...prev];
      const swap = dir === 'up' ? index - 1 : index + 1;
      if (swap < 0 || swap >= arr.length) return arr;
      [arr[index], arr[swap]] = [arr[swap], arr[index]];
      return arr;
    });
  };

  const handleDragStart = (index: number) => { dragIndexRef.current = index; };
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) { setDragOverIndex(null); return; }
    setBlocks((prev) => {
      const arr = [...prev];
      const [removed] = arr.splice(dragIndex, 1);
      arr.splice(dropIndex, 0, removed);
      return arr;
    });
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#f7f3ec]">
      {/* Left: component palette */}
      <div className="w-56 shrink-0 border-r bg-white flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Components</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Click to add to page</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {BLOCK_REGISTRY.map((reg) => (
            <button key={reg.type} type="button"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-primary/5 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
              onClick={() => addBlock(reg.type)}>
              <span className="text-base leading-none w-5 text-center shrink-0">{reg.icon}</span>
              <span>{reg.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Center: canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b shrink-0">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
          </div>
          <Button size="sm" onClick={() => onPublish(blocks)} disabled={isSaving} className="bg-primary hover:bg-primary/90">
            {isSaving ? 'Saving...' : '🌐 Publish'}
          </Button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto py-6 px-4 space-y-2">
            {blocks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground border-2 border-dashed border-slate-200 rounded-xl bg-white">
                <p className="text-lg font-medium mb-2">Start building your page</p>
                <p className="text-sm">Click any component on the left to add it to the canvas</p>
              </div>
            )}
            {blocks.map((block, index) => (
              <div key={block.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`group relative rounded-lg border-2 bg-white overflow-hidden transition-all ${dragOverIndex === index ? 'border-primary shadow-lg' : 'border-transparent hover:border-primary/30'}`}>
                {/* Block toolbar */}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur rounded-md border shadow-sm px-1 py-0.5">
                    <span className="text-xs text-muted-foreground px-1 font-medium">{BLOCK_REGISTRY.find((r) => r.type === block.type)?.label}</span>
                    <div className="w-px h-4 bg-slate-200 mx-0.5" />
                    <button type="button" className="p-1 rounded hover:bg-slate-100" title="Move up" onClick={() => moveBlock(index, 'up')} disabled={index === 0}><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className="p-1 rounded hover:bg-slate-100" title="Move down" onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1}><ChevronDown className="h-3.5 w-3.5" /></button>
                    <button type="button" className="p-1 rounded hover:bg-blue-50 text-blue-600" title="Edit" onClick={() => setEditingBlock(block)}><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" className="p-1 rounded hover:bg-red-50 text-red-500" title="Delete" onClick={() => deleteBlock(block.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    <GripVertical className="h-3.5 w-3.5 text-slate-400 cursor-grab ml-0.5" />
                  </div>
                </div>
                {/* Block preview */}
                <BlockPreview block={block} onUpdate={block.type === 'row_layout' ? (props) => updateBlock(block.id, props) : undefined} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Block editor dialog */}
      {editingBlock && (
        <Dialog open={true} onOpenChange={() => setEditingBlock(null)}>
          <BlockEditor
            block={editingBlock}
            onSave={(props) => { updateBlock(editingBlock.id, props); setEditingBlock(null); }}
            onClose={() => setEditingBlock(null)}
          />
        </Dialog>
      )}
    </div>
  );
}
