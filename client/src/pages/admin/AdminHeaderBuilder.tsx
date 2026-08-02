import React, { useState, useRef, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import MediaPickerDialog from '@/components/admin/MediaPickerDialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { GripVertical, Plus, Save, Trash2, Monitor, Smartphone, ArrowUp, ArrowDown, Pencil, ImagePlus, X } from 'lucide-react';

type HeaderElementType =
  | 'logo' | 'mainMenu' | 'secondaryMenu' | 'mobileMenu' | 'mobileMenuIcon' | 'search' | 'cart' | 'wishlist'
  | 'account' | 'categoriesMenu' | 'textHtml' | 'button' | 'socialIcons' | 'languageSwitcher' | 'divider' | 'space';

type HeaderElement = {
  id: string;
  type: HeaderElementType;
  label?: string;
  html?: string;
  href?: string;
  menuKey?: string;
  width?: number;
  logoSrc?: string;
  settings?: Record<string, any>;
};

type HeaderRow = {
  enabled: boolean;
  height: number;
  backgroundColor: string;
  backgroundImage?: string;
  textColor: string;
  activeTextColor?: string;
  borderBottom: boolean;
  borderBottomColor?: string;
  borderBottomHeight?: number;
  columns: { left: HeaderElement[]; center: HeaderElement[]; right: HeaderElement[] };
};

type HeaderSettings = {
  desktop: { topBar: HeaderRow; mainHeader: HeaderRow; bottomHeader: HeaderRow };
  mobile: { topBar: HeaderRow; mainHeader: HeaderRow; bottomHeader: HeaderRow };
};

type DeviceKey = 'desktop' | 'mobile';
type RowKey = 'topBar' | 'mainHeader' | 'bottomHeader';
type ColumnKey = 'left' | 'center' | 'right';

const rowLabels: Record<RowKey, string> = { topBar: 'Top Bar', mainHeader: 'Main Header', bottomHeader: 'Bottom Header' };
const columnLabels: Record<ColumnKey, string> = { left: 'Left', center: 'Center', right: 'Right' };
const elementLabels: Record<HeaderElementType, string> = {
  logo: 'Logo', mainMenu: 'Main Menu', secondaryMenu: 'Secondary Menu', mobileMenu: 'Mobile Menu', mobileMenuIcon: 'Mobile Menu Icon',
  search: 'Search', cart: 'Cart', wishlist: 'Wishlist', account: 'Account/Login', categoriesMenu: 'Categories Menu', textHtml: 'Text/HTML',
  button: 'Button', socialIcons: 'Social Icons', languageSwitcher: 'Language Switcher', divider: 'Divider', space: 'Space',
};
const elementTypes = Object.keys(elementLabels) as HeaderElementType[];

const makeRow = (overrides: Partial<HeaderRow> = {}): HeaderRow => {
  const { columns, ...rest } = overrides;
  return {
    enabled: true,
    height: 64,
    backgroundColor: '#111110',
    textColor: '#FAFAF8',
    activeTextColor: '#9D7D39',
    borderBottom: false,
    borderBottomColor: '#9D7D39',
    borderBottomHeight: 1,
    ...rest,
    columns: { left: [], center: [], right: [], ...(columns || {}) },
  };
};

const makeDefaultSettings = (): HeaderSettings => ({
  desktop: {
    topBar: makeRow({ height: 32, backgroundColor: '#9D7D39', textColor: '#FAFAF8', columns: { left: [], center: [{ id: 'desktop-shipping-text', type: 'textHtml', html: 'Free shipping on orders over 50 KWD — Kuwait & GCC' }], right: [] } }),
    mainHeader: makeRow({ height: 64, backgroundColor: '#111110', textColor: '#FAFAF8', columns: { left: [{ id: 'desktop-logo', type: 'logo' }], center: [{ id: 'desktop-main-menu', type: 'mainMenu', menuKey: 'header' }], right: [{ id: 'desktop-language', type: 'languageSwitcher' }, { id: 'desktop-search', type: 'search' }, { id: 'desktop-account', type: 'account' }, { id: 'desktop-wishlist', type: 'wishlist' }, { id: 'desktop-cart', type: 'cart' }] } }),
    bottomHeader: makeRow({ enabled: false, height: 44, backgroundColor: '#111110', textColor: '#FAFAF8', borderBottom: true }),
  },
  mobile: {
    topBar: makeRow({ enabled: false, height: 30, backgroundColor: '#9D7D39', textColor: '#FAFAF8', columns: { left: [], center: [{ id: 'mobile-top-text', type: 'textHtml', html: 'Free shipping over 50 KWD' }], right: [] } }),
    mainHeader: makeRow({ height: 58, backgroundColor: '#111110', textColor: '#FAFAF8', columns: { left: [{ id: 'mobile-menu-icon', type: 'mobileMenuIcon' }], center: [{ id: 'mobile-logo', type: 'logo' }], right: [{ id: 'mobile-search', type: 'search' }, { id: 'mobile-cart', type: 'cart' }] } }),
    bottomHeader: makeRow({ enabled: false, height: 44, backgroundColor: '#111110', textColor: '#FAFAF8' }),
  },
});

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

// ─── RGBA colour helpers ──────────────────────────────────────────────────────
function parseColor(value: string): { r: number; g: number; b: number; a: number } {
  const rgba = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] !== undefined ? Math.round(+rgba[4] * 100) : 100 };
  const hex = value.replace('#', '');
  if (hex.length === 3) {
    const [r, g, b] = hex.split('').map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 100 };
  }
  if (hex.length >= 6) {
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 100 };
  }
  return { r: 17, g: 17, b: 16, a: 100 };
}
function formatColor({ r, g, b, a }: { r: number; g: number; b: number; a: number }): string {
  if (a >= 100) return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${r},${g},${b},${(a / 100).toFixed(2)})`;
}
function RgbaColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const parsed = parseColor(value);
  const hexOnly = `#${[parsed.r, parsed.g, parsed.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const update = (patch: Partial<typeof parsed>) => onChange(formatColor({ ...parsed, ...patch }));
  const previewBg = formatColor(parsed);
  return (
    <div className="relative mt-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center gap-2 border border-[#ddd4c2] px-2 hover:border-[#9D7D39]"
        title={previewBg}
      >
        <span className="h-5 w-5 shrink-0 rounded-sm border border-[#ddd4c2]" style={{ background: previewBg }} />
        <span className="flex-1 truncate text-left text-[11px] text-[#6f6a60]">{previewBg}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-50 w-64 rounded-lg border border-[#ddd4c2] bg-white p-3 shadow-xl">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={hexOnly}
              onChange={(e) => {
                const hex = e.target.value.replace('#', '');
                update({ r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) });
              }}
              className="h-10 w-10 shrink-0 cursor-pointer border-0 p-0"
            />
            <span className="flex-1 truncate text-[11px] font-mono text-[#6f6a60]">{hexOnly}</span>
          </div>
          <div
            className="mt-2 h-5 w-full rounded border border-[#ddd4c2]"
            style={{ background: `linear-gradient(to right, rgba(${parsed.r},${parsed.g},${parsed.b},0), rgba(${parsed.r},${parsed.g},${parsed.b},1))` }}
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="w-12 text-[10px] text-[#8A8A82]">Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={parsed.a}
              onChange={(e) => update({ a: Number(e.target.value) })}
              className="flex-1 accent-[#9D7D39]"
            />
            <span className="w-8 text-right text-[10px] text-[#8A8A82]">{parsed.a}%</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {(['r','g','b'] as const).map((ch) => (
              <label key={ch} className="flex flex-col items-center gap-0.5">
                <input type="number" min={0} max={255} value={parsed[ch]} onChange={(e) => update({ [ch]: Math.min(255,Math.max(0,Number(e.target.value))) })} className="w-full border border-[#ddd4c2] px-1 py-1 text-center text-[11px]" />
                <span className="text-[9px] uppercase text-[#8A8A82]">{ch}</span>
              </label>
            ))}
            <label className="flex flex-col items-center gap-0.5">
              <input type="number" min={0} max={100} value={parsed.a} onChange={(e) => update({ a: Math.min(100,Math.max(0,Number(e.target.value))) })} className="w-full border border-[#ddd4c2] px-1 py-1 text-center text-[11px]" />
              <span className="text-[9px] uppercase text-[#8A8A82]">A%</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
const newId = (type: HeaderElementType) => `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function normalizeSettings(value: any): HeaderSettings {
  const defaults = makeDefaultSettings();
  if (!value) return defaults;
  (['desktop', 'mobile'] as DeviceKey[]).forEach((device) => {
    (['topBar', 'mainHeader', 'bottomHeader'] as RowKey[]).forEach((rowKey) => {
      const row = value?.[device]?.[rowKey] || {};
      defaults[device][rowKey] = makeRow({ ...defaults[device][rowKey], ...row, columns: { ...defaults[device][rowKey].columns, ...(row.columns || {}) } });
    });
  });
  return defaults;
}

function elementSummary(element: HeaderElement) {
  if (element.type === 'textHtml') return element.html || 'Text/HTML';
  if (element.type === 'button') return `${element.label || 'Button'} → ${element.href || '#'}`;
  if (element.type === 'logo') return element.logoSrc || element.settings?.logoSrc || 'Default Cove logo';
  if (['mainMenu', 'secondaryMenu', 'mobileMenu', 'categoriesMenu'].includes(element.type)) return `Menu key: ${element.menuKey || 'header'}`;
  if (element.type === 'space') return `${element.width || 24}px space`;
  return elementLabels[element.type];
}

export default function AdminHeaderBuilder() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.headerSettings.get.useQuery(undefined, { retry: false });
  const saveMutation = trpc.headerSettings.save.useMutation({
    onSuccess: async () => {
      await utils.headerSettings.get.invalidate();
      toast.success('Header layout saved');
    },
    onError: (error) => toast.error(error.message || 'Failed to save header layout'),
  });
  const { data: menus } = trpc.menuBuilder.listMenus.useQuery(undefined, { retry: false });
  const menuOptions = useMemo(() => (menus || []).map((m: any) => ({ key: m.key, name: m.name })), [menus]);

  const [activeDevice, setActiveDevice] = useState<DeviceKey>('desktop');
  const [settings, setSettings] = useState<HeaderSettings>(() => makeDefaultSettings());
  const [dragSource, setDragSource] = useState<{ row: RowKey; column: ColumnKey; index: number } | null>(null);
  const [editingLogo, setEditingLogo] = useState<{ row: RowKey; column: ColumnKey; index: number } | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [backgroundPickerRow, setBackgroundPickerRow] = useState<RowKey | null>(null);
  const [customizeRow, setCustomizeRow] = useState<RowKey | null>(null);
  const [customizeTab, setCustomizeTab] = useState<'style' | 'border'>('style');

  useEffect(() => { if (data !== undefined) setSettings(normalizeSettings(data)); }, [data]);

  const updateRow = (rowKey: RowKey, patch: Partial<HeaderRow>) => {
    setSettings((current) => {
      const next = clone(current);
      next[activeDevice][rowKey] = { ...next[activeDevice][rowKey], ...patch };
      return next;
    });
  };

  const updateElement = (rowKey: RowKey, column: ColumnKey, index: number, patch: Partial<HeaderElement>) => {
    setSettings((current) => {
      const next = clone(current);
      next[activeDevice][rowKey].columns[column][index] = { ...next[activeDevice][rowKey].columns[column][index], ...patch };
      return next;
    });
  };

  const addElement = (rowKey: RowKey, column: ColumnKey, type: HeaderElementType) => {
    const element: HeaderElement = { id: newId(type), type };
    if (['mainMenu', 'secondaryMenu', 'mobileMenu', 'categoriesMenu'].includes(type)) element.menuKey = type === 'mobileMenu' ? 'mobile' : 'header';
    if (type === 'textHtml') element.html = 'Custom text';
    if (type === 'button') { element.label = 'Button'; element.href = '/shop'; }
    if (type === 'space') element.width = 24;
    setSettings((current) => {
      const next = clone(current);
      next[activeDevice][rowKey].columns[column].push(element);
      return next;
    });
  };

  const removeElement = (rowKey: RowKey, column: ColumnKey, index: number) => {
    setSettings((current) => {
      const next = clone(current);
      next[activeDevice][rowKey].columns[column].splice(index, 1);
      return next;
    });
  };

  const moveElement = (rowKey: RowKey, column: ColumnKey, index: number, direction: -1 | 1) => {
    setSettings((current) => {
      const next = clone(current);
      const arr = next[activeDevice][rowKey].columns[column];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return current;
      const [item] = arr.splice(index, 1);
      arr.splice(target, 0, item);
      return next;
    });
  };

  const dropElement = (rowKey: RowKey, column: ColumnKey, targetIndex: number) => {
    if (!dragSource) return;
    setSettings((current) => {
      const next = clone(current);
      const sourceArr = next[activeDevice][dragSource.row].columns[dragSource.column];
      const [item] = sourceArr.splice(dragSource.index, 1);
      const targetArr = next[activeDevice][rowKey].columns[column];
      const insertAt = Math.min(targetIndex, targetArr.length);
      targetArr.splice(insertAt, 0, item);
      return next;
    });
    setDragSource(null);
  };

  const currentDevice = settings[activeDevice];
  const logoElement = editingLogo ? currentDevice[editingLogo.row].columns[editingLogo.column][editingLogo.index] : null;

  const updateEditingLogo = (patch: Partial<HeaderElement>) => {
    if (!editingLogo) return;
    updateElement(editingLogo.row, editingLogo.column, editingLogo.index, patch);
  };

  const setEditingLogoImage = (logoSrc: string) => {
    const nextSettings = { ...(logoElement?.settings || {}), logoSrc };
    updateEditingLogo({ logoSrc, settings: nextSettings });
  };

  const setEditingLogoWidth = (logoWidth: number) => {
    const safeWidth = Math.min(500, Math.max(10, logoWidth || 200));
    updateEditingLogo({ settings: { ...(logoElement?.settings || {}), logoWidth: safeWidth } });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9D7D39]">Theme Layout</p>
            <h1 className="mt-2 font-serif text-3xl text-[#111110]">Header Builder</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#6f6a60]">Control the full global header layout. Menus remain managed in Menu Builder; this page decides where logo, menus, search, cart, wishlist, language and custom elements appear.</p>
          </div>
          <button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending} className="inline-flex items-center justify-center gap-2 bg-[#9D7D39] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-50">
            <Save size={15} /> {saveMutation.isPending ? 'Saving...' : 'Save Header'}
          </button>
        </div>

        <div className="flex gap-2 border-b border-[#e7e0d2]">
          {(['desktop', 'mobile'] as DeviceKey[]).map((device) => (
            <button key={device} onClick={() => setActiveDevice(device)} className={`inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] ${activeDevice === device ? 'border-b-2 border-[#9D7D39] text-[#111110]' : 'text-[#8A8A82]'}`}>
              {device === 'desktop' ? <Monitor size={15} /> : <Smartphone size={15} />} {device}
            </button>
          ))}
        </div>

        {isLoading ? <div className="border border-[#e7e0d2] bg-white p-8 text-sm text-[#8A8A82]">Loading header layout...</div> : (
          <div className="space-y-6">
            {(['topBar', 'mainHeader', 'bottomHeader'] as RowKey[]).map((rowKey) => {
              const row = currentDevice[rowKey];
              return (
                <section key={rowKey} className="border border-[#e7e0d2] bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#eee8dc] px-5 py-4">
                    <div>
                      <h2 className="font-serif text-2xl text-[#111110]">{rowLabels[rowKey]}</h2>
                      <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-[#8A8A82]">{activeDevice} row</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#111110]">
                        <input type="checkbox" checked={row.enabled} onChange={(e) => updateRow(rowKey, { enabled: e.target.checked })} className="h-4 w-4" />
                        Enabled
                      </label>
                      <button
                        type="button"
                        onClick={() => { setCustomizeRow(rowKey); setCustomizeTab('style'); }}
                        className="inline-flex items-center gap-2 border border-[#9D7D39] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#9D7D39] hover:bg-[#9D7D39] hover:text-white transition-colors"
                      >
                        <Pencil size={13} /> Customize
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 lg:grid-cols-3">
                    {(['left', 'center', 'right'] as ColumnKey[]).map((column) => (
                      <div key={column} className="min-h-48 border border-dashed border-[#d8cba8] bg-[#FAFAF8] p-4" onDragOver={(e) => e.preventDefault()} onDrop={() => dropElement(rowKey, column, row.columns[column].length)}>
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#111110]">{columnLabels[column]}</h3>
                          <select className="max-w-[155px] border border-[#ddd4c2] bg-white px-2 py-2 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) addElement(rowKey, column, e.target.value as HeaderElementType); e.currentTarget.value = ''; }}>
                            <option value="">+ Add Element</option>
                            {elementTypes.map((type) => <option key={type} value={type}>{elementLabels[type]}</option>)}
                          </select>
                        </div>
                        <div className="space-y-3">
                          {row.columns[column].length === 0 && <div className="rounded border border-[#eee8dc] bg-white p-4 text-center text-xs text-[#8A8A82]">Drop or add elements here</div>}
                          {row.columns[column].map((element, index) => (
                            <div key={element.id} draggable onDragStart={() => setDragSource({ row: rowKey, column, index })} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); dropElement(rowKey, column, index); }} className="rounded border border-[#e2d8c7] bg-white p-3 shadow-sm">
                              <div className="flex items-start gap-3">
                                <GripVertical size={16} className="mt-1 text-[#9D7D39]" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-[#111110]">{elementLabels[element.type]}</p>
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => moveElement(rowKey, column, index, -1)} className="p-1 text-[#8A8A82] hover:text-[#111110]" type="button"><ArrowUp size={13} /></button>
                                      <button onClick={() => moveElement(rowKey, column, index, 1)} className="p-1 text-[#8A8A82] hover:text-[#111110]" type="button"><ArrowDown size={13} /></button>
                                      {element.type === 'logo' && <button onClick={() => setEditingLogo({ row: rowKey, column, index })} className="p-1 text-[#8A8A82] hover:text-[#111110]" type="button" aria-label="Configure logo"><Pencil size={13} /></button>}
                                      <button onClick={() => removeElement(rowKey, column, index)} className="p-1 text-red-600" type="button"><Trash2 size={13} /></button>
                                    </div>
                                  </div>
                                  <p className="mt-1 truncate text-xs text-[#8A8A82]">{elementSummary(element)}</p>
                                  {['mainMenu', 'secondaryMenu', 'mobileMenu', 'categoriesMenu'].includes(element.type) && (
                                    <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-[#6f6a60]">Menu source
                                      <select value={element.menuKey || 'header'} onChange={(e) => updateElement(rowKey, column, index, { menuKey: e.target.value })} className="mt-1 w-full border border-[#ddd4c2] px-2 py-2 text-xs">
                                        {(menuOptions.length ? menuOptions : [{ key: 'header', name: 'Header Navigation' }, { key: 'mobile', name: 'Mobile Navigation' }]).map((menu) => <option key={menu.key} value={menu.key}>{menu.name} ({menu.key})</option>)}
                                      </select>
                                    </label>
                                  )}
                                  {element.type === 'textHtml' && <textarea value={element.html || ''} onChange={(e) => updateElement(rowKey, column, index, { html: e.target.value })} className="mt-3 h-20 w-full border border-[#ddd4c2] px-2 py-2 text-xs" />}
                                  {element.type === 'button' && <div className="mt-3 grid grid-cols-2 gap-2"><input value={element.label || ''} onChange={(e) => updateElement(rowKey, column, index, { label: e.target.value })} placeholder="Label" className="border border-[#ddd4c2] px-2 py-2 text-xs" /><input value={element.href || ''} onChange={(e) => updateElement(rowKey, column, index, { href: e.target.value })} placeholder="/shop" className="border border-[#ddd4c2] px-2 py-2 text-xs" /></div>}
                                  {element.type === 'space' && <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-[#6f6a60]">Width<input type="number" min={4} max={120} value={element.width || 24} onChange={(e) => updateElement(rowKey, column, index, { width: Number(e.target.value) })} className="mt-1 w-full border border-[#ddd4c2] px-2 py-2 text-xs" /></label>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {customizeRow && (() => {
        const cRow = currentDevice[customizeRow];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
            <div className="flex flex-col bg-white shadow-2xl" style={{ position: 'fixed', inset: '20px' }}>
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[#eee8dc] px-6 py-5">
                <h2 className="font-serif text-2xl text-[#111110]">Customize {rowLabels[customizeRow]}</h2>
                <button type="button" onClick={() => setCustomizeRow(null)} className="p-1 text-[#6f6a60] hover:text-[#111110]" aria-label="Close"><X size={22} /></button>
              </div>
              {/* Tabs */}
              <div className="flex shrink-0 gap-0 border-b border-[#eee8dc] px-6">
                {(['style', 'border'] as const).map((tab) => (
                  <button key={tab} type="button" onClick={() => setCustomizeTab(tab)}
                    className={`px-5 py-4 text-sm font-semibold uppercase tracking-[0.14em] transition-colors ${
                      customizeTab === tab ? 'border-b-2 border-[#9D7D39] text-[#9D7D39]' : 'text-[#8A8A82] hover:text-[#111110]'
                    }`}>
                    {tab === 'style' ? 'Style' : 'Border Bottom'}
                  </button>
                ))}
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {customizeTab === 'style' && (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Height */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f6a60]">Height (px)</label>
                      <input type="number" min={24} max={240} value={cRow.height}
                        onChange={(e) => updateRow(customizeRow, { height: Number(e.target.value) })}
                        className="mt-2 w-full border border-[#ddd4c2] px-3 py-2 text-sm" />
                    </div>
                    {/* Background color */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f6a60]">Background Color</label>
                      <RgbaColorInput value={cRow.backgroundColor} onChange={(v) => updateRow(customizeRow, { backgroundColor: v })} />
                    </div>
                    {/* Background image */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f6a60]">Background Image</label>
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" onClick={() => setBackgroundPickerRow(customizeRow)}
                          className="inline-flex flex-1 items-center justify-center gap-2 border border-[#ddd4c2] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#111110] hover:border-[#9D7D39]">
                          <ImagePlus size={14} /> {cRow.backgroundImage ? 'Change image' : 'Choose image'}
                        </button>
                        {cRow.backgroundImage && (
                          <button type="button" onClick={() => updateRow(customizeRow, { backgroundImage: '' })}
                            className="inline-flex h-10 w-10 items-center justify-center border border-red-200 text-red-600 hover:bg-red-50" aria-label="Remove">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      {cRow.backgroundImage && <p className="mt-1 truncate text-[10px] text-[#8A8A82]">{cRow.backgroundImage}</p>}
                    </div>
                    {/* Text color */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f6a60]">Text Color</label>
                      <RgbaColorInput value={cRow.textColor} onChange={(v) => updateRow(customizeRow, { textColor: v })} />
                    </div>
                    {/* Active text color */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f6a60]">Active Text Color</label>
                      <RgbaColorInput value={cRow.activeTextColor || '#9D7D39'} onChange={(v) => updateRow(customizeRow, { activeTextColor: v })} />
                    </div>
                  </div>
                )}
                {customizeTab === 'border' && (
                  <div className="space-y-6">
                    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-[#111110]">
                      <input type="checkbox" checked={cRow.borderBottom}
                        onChange={(e) => updateRow(customizeRow, { borderBottom: e.target.checked })}
                        className="h-4 w-4" />
                      Enable Border Bottom
                    </label>
                    {cRow.borderBottom && (
                      <div className="grid gap-6 md:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f6a60]">Border Height (px)</label>
                          <input type="number" min={1} max={20} value={cRow.borderBottomHeight ?? 1}
                            onChange={(e) => updateRow(customizeRow, { borderBottomHeight: Number(e.target.value) })}
                            className="mt-2 w-full border border-[#ddd4c2] px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f6a60]">Border Color</label>
                          <RgbaColorInput value={cRow.borderBottomColor || '#9D7D39'} onChange={(v) => updateRow(customizeRow, { borderBottomColor: v })} />
                        </div>
                        {/* Live preview */}
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f6a60]">Preview</label>
                          <div className="mt-2 h-12 w-full rounded border border-[#eee8dc] bg-[#111110]"
                            style={{ borderBottom: `${cRow.borderBottomHeight ?? 1}px solid ${cRow.borderBottomColor || '#9D7D39'}` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Footer */}
              <div className="shrink-0 border-t border-[#eee8dc] px-6 py-4">
                <button type="button" onClick={() => setCustomizeRow(null)}
                  className="bg-[#9D7D39] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-[#81662d]">
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {logoElement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#eee8dc] px-6 py-5">
              <h2 className="text-xl font-semibold text-[#111110]">Configure Logo settings</h2>
              <button type="button" onClick={() => setEditingLogo(null)} className="p-1 text-[#6f6a60] hover:text-[#111110]" aria-label="Close logo settings">
                <X size={22} />
              </button>
            </div>

            <div className="border-b border-[#eee8dc] px-6">
              <button type="button" className="border-b-2 border-[#9D7D39] px-4 py-4 text-sm font-semibold text-[#9D7D39]">General</button>
            </div>

            <div className="space-y-6 px-6 py-5">
              <div>
                <p className="mb-3 border-b border-[#eee8dc] pb-2 text-sm font-semibold text-[#111110]">Logo image</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-10 w-24 overflow-hidden rounded border border-[#e2d8c7] bg-[#FAFAF8]">
                    {(logoElement.logoSrc || logoElement.settings?.logoSrc) ? (
                      <img src={logoElement.logoSrc || logoElement.settings?.logoSrc} alt="Selected logo" className="h-full w-full object-contain" />
                    ) : null}
                  </div>
                  <button type="button" onClick={() => setMediaPickerOpen(true)} className="inline-flex items-center gap-2 rounded border border-[#ddd4c2] bg-[#FAFAF8] px-4 py-2 text-sm font-semibold text-[#111110] hover:border-[#9D7D39]">
                    <ImagePlus size={15} /> Upload
                  </button>
                  <button type="button" onClick={() => setEditingLogoImage('')} className="inline-flex items-center gap-2 rounded bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-3 border-b border-[#eee8dc] pb-2 text-sm font-semibold text-[#111110]">Logo width</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={500}
                    value={logoElement.settings?.logoWidth || 200}
                    onChange={(event) => setEditingLogoWidth(Number(event.target.value))}
                    className="w-full accent-[#9D7D39]"
                  />
                  <div className="flex items-center border border-[#ddd4c2] bg-white">
                    <input
                      type="number"
                      min={10}
                      max={500}
                      value={logoElement.settings?.logoWidth || 200}
                      onChange={(event) => setEditingLogoWidth(Number(event.target.value))}
                      className="w-20 px-3 py-2 text-sm outline-none"
                    />
                    <span className="border-l border-[#ddd4c2] px-2 text-xs text-[#6f6a60]">px</span>
                  </div>
                </div>
                <p className="mt-3 text-xs italic leading-relaxed text-[#8A8A82]">Determine the logo image width in pixels. Minimum 10px and maximum 500px.</p>
              </div>

              <div className="border-t border-[#eee8dc] pt-5">
                <button type="button" onClick={() => setEditingLogo(null)} className="bg-[#9D7D39] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-[#81662d]">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <MediaPickerDialog
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        title="Choose image"
        value={logoElement?.logoSrc || logoElement?.settings?.logoSrc || ''}
        accept="image/*"
        onSelect={(url) => setEditingLogoImage(url)}
      />

      <MediaPickerDialog
        open={Boolean(backgroundPickerRow)}
        onOpenChange={(open) => { if (!open) setBackgroundPickerRow(null); }}
        title="Choose image"
        value={backgroundPickerRow ? currentDevice[backgroundPickerRow].backgroundImage || '' : ''}
        accept="image/*"
        onSelect={(url) => {
          if (!backgroundPickerRow) return;
          updateRow(backgroundPickerRow, { backgroundImage: url });
          setBackgroundPickerRow(null);
        }}
      />
    </AdminLayout>
  );
}
