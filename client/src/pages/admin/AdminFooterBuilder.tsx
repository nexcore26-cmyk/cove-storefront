import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Loader2, Plus, Save, Trash2, PanelBottom, Mail, Phone, MapPin } from 'lucide-react';

type FooterColumn = {
  id: string;
  title: string;
  menuKey: string;
  description?: string;
};

type FooterSettings = {
  logoUrl: string;
  description: string;
  contact: {
    phone: string;
    email: string;
    address: string;
  };
  social: {
    instagram: string;
    facebook: string;
    twitter: string;
    tiktok: string;
  };
  newsletterVisible: boolean;
  copyrightText: string;
  layoutColumns: number;
  assignedFooterMenuKey: string;
  paymentBadgesVisible: boolean;
  legalLinksVisible: boolean;
  columns: FooterColumn[];
};

const DEFAULT_SETTINGS: FooterSettings = {
  logoUrl: '/brand/cove-logo.png',
  description: 'Curated interiors, artisan objects, and refined home pieces selected for timeless spaces.',
  contact: {
    phone: '+965 2222 0000',
    email: 'hello@coveinterior.com',
    address: 'Kuwait City, Kuwait',
  },
  social: {
    instagram: 'https://instagram.com/coveinterior',
    facebook: '',
    twitter: '',
    tiktok: '',
  },
  newsletterVisible: true,
  copyrightText: `© ${new Date().getFullYear()} Cove Interior. All rights reserved.`,
  layoutColumns: 4,
  assignedFooterMenuKey: 'footer',
  paymentBadgesVisible: true,
  legalLinksVisible: true,
  columns: [
    { id: 'shop', title: 'Shop', menuKey: 'footer', description: 'Primary footer shopping links' },
    { id: 'information', title: 'Information', menuKey: 'footer', description: 'Tenant-managed footer navigation' },
    { id: 'support', title: 'Support', menuKey: 'footer', description: 'Customer service links and contact details' },
  ],
};

const inputClass = 'w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#9D7D39] focus:ring-2 focus:ring-[#9D7D39]/10';
const labelClass = 'block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 mb-2';
const cardClass = 'rounded-xl border border-stone-200 bg-white shadow-sm';

function mergeFooterSettings(raw: unknown): FooterSettings {
  const data = (raw || {}) as Partial<FooterSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    contact: { ...DEFAULT_SETTINGS.contact, ...(data.contact || {}) },
    social: { ...DEFAULT_SETTINGS.social, ...(data.social || {}) },
    columns: Array.isArray(data.columns) && data.columns.length > 0 ? data.columns : DEFAULT_SETTINGS.columns,
  };
}

export default function AdminFooterBuilder() {
  const utils = trpc.useUtils();
  const { data: savedSettings, isLoading } = trpc.footerSettings.get.useQuery();
  const { data: menus = [] } = trpc.menuBuilder.listMenus.useQuery();
  const saveSettings = trpc.footerSettings.save.useMutation({
    onSuccess: async () => {
      await utils.footerSettings.get.invalidate();
      toast.success('Footer settings saved');
    },
    onError: (error) => toast.error(error.message || 'Failed to save footer settings'),
  });

  const [settings, setSettings] = useState<FooterSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(mergeFooterSettings(savedSettings));
  }, [savedSettings]);

  const footerMenus = useMemo(() => menus.filter((menu: any) => ['footer', 'mobile', 'sidebar', 'custom'].includes(menu.location)), [menus]);

  const updateSetting = <K extends keyof FooterSettings>(key: K, value: FooterSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const updateContact = (key: keyof FooterSettings['contact'], value: string) => {
    setSettings((current) => ({ ...current, contact: { ...current.contact, [key]: value } }));
  };

  const updateSocial = (key: keyof FooterSettings['social'], value: string) => {
    setSettings((current) => ({ ...current, social: { ...current.social, [key]: value } }));
  };

  const updateColumn = (id: string, patch: Partial<FooterColumn>) => {
    setSettings((current) => ({
      ...current,
      columns: current.columns.map((column) => column.id === id ? { ...column, ...patch } : column),
    }));
  };

  const addColumn = () => {
    const id = `column-${Date.now()}`;
    setSettings((current) => ({
      ...current,
      columns: [...current.columns, { id, title: 'New Column', menuKey: current.assignedFooterMenuKey || 'footer', description: '' }],
      layoutColumns: Math.min(5, Math.max(current.layoutColumns, current.columns.length + 1)),
    }));
  };

  const removeColumn = (id: string) => {
    setSettings((current) => ({
      ...current,
      columns: current.columns.filter((column) => column.id !== id),
      layoutColumns: Math.max(1, Math.min(5, current.columns.length - 1)),
    }));
  };

  const handleSave = () => {
    saveSettings.mutate(settings as any);
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-10 max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
              Admin
            </p>
            <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Footer Builder
            </h1>
            <p className="text-xs mt-2 max-w-2xl" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Configure the global storefront footer without hardcoding tenant content. Footer menus are assigned through the existing menu builder locations.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saveSettings.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#242424] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#9D7D39] disabled:opacity-60"
          >
            {saveSettings.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save Footer
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 text-sm text-stone-500">
            <Loader2 className="animate-spin" size={20} style={{ color: '#9D7D39' }} />
            Loading footer configuration...
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <section className={`${cardClass} p-6`}>
                <div className="mb-5 flex items-center gap-3">
                  <PanelBottom size={20} style={{ color: '#9D7D39' }} />
                  <div>
                    <h2 className="text-lg font-medium text-stone-900">Brand block</h2>
                    <p className="text-xs text-stone-500">Logo, description, and tenant-owned footer introduction.</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Logo URL</label>
                    <input className={inputClass} value={settings.logoUrl} onChange={(e) => updateSetting('logoUrl', e.target.value)} placeholder="/brand/cove-logo.png" />
                  </div>
                  <div>
                    <label className={labelClass}>Default footer menu</label>
                    <select className={inputClass} value={settings.assignedFooterMenuKey} onChange={(e) => updateSetting('assignedFooterMenuKey', e.target.value)}>
                      <option value="footer">footer</option>
                      {footerMenus.map((menu: any) => (
                        <option key={menu.id || menu.key} value={menu.key}>{menu.name} ({menu.key})</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Description</label>
                    <textarea className={`${inputClass} min-h-[110px]`} value={settings.description} onChange={(e) => updateSetting('description', e.target.value)} />
                  </div>
                </div>
              </section>

              <section className={`${cardClass} p-6`}>
                <div className="mb-5">
                  <h2 className="text-lg font-medium text-stone-900">Footer columns and menu assignments</h2>
                  <p className="text-xs text-stone-500">Each column can point to any menu location supported by the menu builder: header, footer, mobile, sidebar, or custom.</p>
                </div>
                <div className="mb-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Column layout count</label>
                    <select className={inputClass} value={settings.layoutColumns} onChange={(e) => updateSetting('layoutColumns', Number(e.target.value))}>
                      {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count} columns</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={addColumn} className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-700 transition hover:border-[#9D7D39] hover:text-[#9D7D39]">
                      <Plus size={16} /> Add column
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {settings.columns.map((column) => (
                    <div key={column.id} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <div>
                          <label className={labelClass}>Column title</label>
                          <input className={inputClass} value={column.title} onChange={(e) => updateColumn(column.id, { title: e.target.value })} />
                        </div>
                        <div>
                          <label className={labelClass}>Assigned menu</label>
                          <select className={inputClass} value={column.menuKey} onChange={(e) => updateColumn(column.id, { menuKey: e.target.value })}>
                            <option value="footer">footer</option>
                            <option value="header">header</option>
                            <option value="mobile">mobile</option>
                            <option value="sidebar">sidebar</option>
                            {menus.map((menu: any) => (
                              <option key={menu.id || menu.key} value={menu.key}>{menu.name} ({menu.key})</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button onClick={() => removeColumn(column.id)} className="rounded-md border border-red-200 p-2 text-red-600 transition hover:bg-red-50" aria-label="Remove column">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="md:col-span-3">
                          <label className={labelClass}>Internal note / column description</label>
                          <input className={inputClass} value={column.description || ''} onChange={(e) => updateColumn(column.id, { description: e.target.value })} placeholder="Optional admin note" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`${cardClass} p-6`}>
                <div className="mb-5">
                  <h2 className="text-lg font-medium text-stone-900">Contact and social links</h2>
                  <p className="text-xs text-stone-500">These details render globally in the footer contact/support area.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input className={inputClass} value={settings.contact.phone} onChange={(e) => updateContact('phone', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input className={inputClass} value={settings.contact.email} onChange={(e) => updateContact('email', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Address</label>
                    <input className={inputClass} value={settings.contact.address} onChange={(e) => updateContact('address', e.target.value)} />
                  </div>
                  {(['instagram', 'facebook', 'twitter', 'tiktok'] as const).map((key) => (
                    <div key={key}>
                      <label className={labelClass}>{key}</label>
                      <input className={inputClass} value={settings.social[key]} onChange={(e) => updateSocial(key, e.target.value)} placeholder={`https://${key}.com/...`} />
                    </div>
                  ))}
                </div>
              </section>

              <section className={`${cardClass} p-6`}>
                <div className="mb-5">
                  <h2 className="text-lg font-medium text-stone-900">Footer visibility and legal copy</h2>
                  <p className="text-xs text-stone-500">Control optional global blocks shown beneath the menu columns.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 p-4 text-sm">
                    <span>Newsletter signup</span>
                    <input type="checkbox" checked={settings.newsletterVisible} onChange={(e) => updateSetting('newsletterVisible', e.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 p-4 text-sm">
                    <span>Payment badges</span>
                    <input type="checkbox" checked={settings.paymentBadgesVisible} onChange={(e) => updateSetting('paymentBadgesVisible', e.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 p-4 text-sm">
                    <span>Legal links</span>
                    <input type="checkbox" checked={settings.legalLinksVisible} onChange={(e) => updateSetting('legalLinksVisible', e.target.checked)} />
                  </label>
                  <div className="md:col-span-3">
                    <label className={labelClass}>Copyright text</label>
                    <input className={inputClass} value={settings.copyrightText} onChange={(e) => updateSetting('copyrightText', e.target.value)} />
                  </div>
                </div>
              </section>
            </div>

            <aside className={`${cardClass} h-fit overflow-hidden`}>
              <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
                <h2 className="text-lg font-medium text-stone-900">Live structure preview</h2>
                <p className="text-xs text-stone-500">Preview uses saved structure fields and fallback menu labels.</p>
              </div>
              <div className="bg-[#242424] p-6 text-white">
                <img src={settings.logoUrl} alt="Footer logo preview" className="mb-5 max-h-10 max-w-[160px] object-contain brightness-0 invert" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                <p className="mb-5 text-sm leading-6 text-white/70">{settings.description}</p>
                <div className="mb-6 space-y-2 text-xs text-white/70">
                  {settings.contact.phone && <p className="flex items-center gap-2"><Phone size={14} /> {settings.contact.phone}</p>}
                  {settings.contact.email && <p className="flex items-center gap-2"><Mail size={14} /> {settings.contact.email}</p>}
                  {settings.contact.address && <p className="flex items-center gap-2"><MapPin size={14} /> {settings.contact.address}</p>}
                </div>
                <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.min(settings.layoutColumns, 2)}, minmax(0, 1fr))` }}>
                  {settings.columns.map((column) => (
                    <div key={column.id}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B56D]">{column.title}</h3>
                      <p className="text-[11px] text-white/50">Menu: {column.menuKey}</p>
                      <ul className="mt-3 space-y-2 text-xs text-white/70">
                        <li>Managed menu link</li>
                        <li>Managed menu link</li>
                        <li>Managed menu link</li>
                      </ul>
                    </div>
                  ))}
                </div>
                {settings.newsletterVisible && (
                  <div className="mt-6 rounded-lg border border-white/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D8B56D]">Newsletter</p>
                    <p className="mt-2 text-xs text-white/60">Visible in storefront footer.</p>
                  </div>
                )}
                <div className="mt-6 border-t border-white/10 pt-4 text-[11px] text-white/50">
                  {settings.copyrightText}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
