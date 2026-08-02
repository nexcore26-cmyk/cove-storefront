/**
 * Admin Settings — Store info, coupon management, and inventory/POS config
 */
import { useState, useEffect } from 'react';
import { Settings, Tag, Loader2, Warehouse, X } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

type SettingsTab = 'store' | 'inventory' | 'coupons';

const inputCls = "w-full px-3 py-2 text-sm border bg-transparent outline-none focus:border-[#9D7D39] transition-colors";
const inputStyle = { borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' };
const labelCls = "block text-xs font-semibold tracking-wider uppercase mb-1";
const labelStyle = { fontFamily: 'Montserrat, sans-serif', color: '#242424' };

// ─── Coupon Form Modal ───────────────────────────────────────────────────────
function CouponModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: any;
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    code: initial?.code ?? '',
    description: initial?.description ?? '',
    type: initial?.type ?? 'percent',
    amount: initial?.amount ? parseFloat(String(initial.amount)) : 0,
    minimumAmount: initial?.minimumAmount ? parseFloat(String(initial.minimumAmount)) : 0,
    maximumAmount: initial?.maximumAmount ? parseFloat(String(initial.maximumAmount)) : 0,
    usageLimit: initial?.usageLimit ?? '',
    freeShipping: initial?.freeShipping ?? false,
    individualUse: initial?.individualUse ?? false,
    expiryDate: initial?.expiryDate ? new Date(initial.expiryDate).toISOString().slice(0, 10) : '',
    isActive: initial?.isActive ?? true,
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E8E4DC' }}>
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
            {initial ? 'Edit Coupon' : 'New Coupon'}
          </h2>
          <button onClick={onClose} className="p-1 hover:opacity-70"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>Code *</label>
              <input className={inputCls} style={inputStyle} value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="SUMMER20" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Type *</label>
              <select className={inputCls} style={{ ...inputStyle, backgroundColor: 'white' }}
                value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="percent">Percentage (%)</option>
                <option value="fixed_cart">Fixed Cart (KWD)</option>
                <option value="fixed_product">Fixed Product (KWD)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>
                Amount * {form.type === 'percent' ? '(%)' : '(KWD)'}
              </label>
              <input className={inputCls} style={inputStyle} type="number" min="0" step="0.001"
                value={form.amount} onChange={(e) => set('amount', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Min Order (KWD)</label>
              <input className={inputCls} style={inputStyle} type="number" min="0" step="0.001"
                value={form.minimumAmount} onChange={(e) => set('minimumAmount', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>Usage Limit</label>
              <input className={inputCls} style={inputStyle} type="number" min="1" step="1"
                value={form.usageLimit} onChange={(e) => set('usageLimit', e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Unlimited" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Expiry Date</label>
              <input className={inputCls} style={inputStyle} type="date"
                value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Description</label>
            <input className={inputCls} style={inputStyle} value={form.description}
              onChange={(e) => set('description', e.target.value)} placeholder="Optional note" />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.freeShipping} onChange={(e) => set('freeShipping', e.target.checked)}
                className="accent-[#9D7D39]" />
              <span className="text-xs" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>Free Shipping</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.individualUse} onChange={(e) => set('individualUse', e.target.checked)}
                className="accent-[#9D7D39]" />
              <span className="text-xs" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>Individual Use Only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)}
                className="accent-[#9D7D39]" />
              <span className="text-xs" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>Active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#E8E4DC' }}>
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold tracking-wider uppercase border"
            style={{ borderColor: '#D4C9B8', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...form, usageLimit: form.usageLimit ? parseInt(String(form.usageLimit)) : undefined })}
            disabled={saving || !form.code || !form.amount}
            className="px-4 py-2 text-xs font-semibold tracking-wider uppercase disabled:opacity-50"
            style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : initial ? 'Save Changes' : 'Create Coupon'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminSettings() {
  const [tab, setTab] = useState<SettingsTab>('store');

  // Queries
  const { data: coupons, isLoading: couponsLoading, refetch: refetchCoupons } = trpc.coupons.list.useQuery();
  const { data: storeSettings, isLoading: settingsLoading, refetch: refetchSettings } = trpc.settings.get.useQuery();
  const { data: warehouses } = trpc.inventory.warehouses.useQuery();

  // Coupon state
  const [couponModal, setCouponModal] = useState<{ open: boolean; initial?: any }>({ open: false });
  const createCoupon = trpc.coupons.create.useMutation({
    onSuccess: () => { toast.success('Coupon created'); setCouponModal({ open: false }); refetchCoupons(); },
    onError: (e) => toast.error(e.message),
  });
  const updateCoupon = trpc.coupons.update.useMutation({
    onSuccess: () => { toast.success('Coupon updated'); setCouponModal({ open: false }); refetchCoupons(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCoupon = trpc.coupons.delete.useMutation({
    onSuccess: () => { toast.success('Coupon deleted'); refetchCoupons(); },
    onError: (e) => toast.error(e.message),
  });


  // Store settings state
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => { toast.success('Settings saved'); refetchSettings(); },
    onError: (e) => toast.error(e.message),
  });
  const utils = trpc.useUtils();
  const [warehouseForm, setWarehouseForm] = useState({ name: '', code: '', type: 'main' as 'main' | 'online' | 'pos', description: '' });
  const addWarehouse = trpc.inventory.addWarehouse.useMutation({
    onSuccess: () => {
      toast.success('Warehouse created');
      setWarehouseForm({ name: '', code: '', type: 'main', description: '' });
      utils.inventory.warehouses.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateWarehouse = trpc.inventory.updateWarehouse.useMutation({
    onSuccess: () => { toast.success('Warehouse updated'); utils.inventory.warehouses.invalidate(); refetchSettings(); },
    onError: (e) => toast.error(e.message),
  });
  const [posEnabled, setPosEnabled] = useState(false);
  const [posWarehouseId, setPosWarehouseId] = useState('');
  const [onlineWarehouseId, setOnlineWarehouseId] = useState('');
  const [mainWarehouseId, setMainWarehouseId] = useState('');
  const [codEnabled, setCodEnabled] = useState(false);
  useEffect(() => {
    if (storeSettings) {
      setPosEnabled(!!storeSettings.posEnabled);
      setPosWarehouseId(String(storeSettings.posWarehouseId ?? ''));
      setOnlineWarehouseId(String(storeSettings.onlineWarehouseId ?? ''));
      setMainWarehouseId(String(storeSettings.mainWarehouseId ?? ''));
      setCodEnabled(!!(storeSettings as any).codEnabled);
    }
  }, [storeSettings]);

  const handleSaveInventory = () => {
    updateSettings.mutate({
      posEnabled,
      posWarehouseId: posWarehouseId ? parseInt(posWarehouseId) : null,
      onlineWarehouseId: onlineWarehouseId ? parseInt(onlineWarehouseId) : null,
      mainWarehouseId: mainWarehouseId ? parseInt(mainWarehouseId) : null,
    });
  };

  const handleCreateWarehouse = () => {
    const name = warehouseForm.name.trim();
    const code = warehouseForm.code.trim().toUpperCase();
    if (!name || !code) {
      toast.error('Warehouse name and code are required');
      return;
    }
    addWarehouse.mutate({ name, code, type: warehouseForm.type, description: warehouseForm.description.trim() || undefined });
  };

  const handleSavePayment = () => updateSettings.mutate({ codEnabled });

  const handleCouponSave = (data: any) => {
    if (couponModal.initial) {
      updateCoupon.mutate({ id: couponModal.initial.id, ...data });
    } else {
      createCoupon.mutate(data);
    }
  };

  const TABS: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'store', label: 'Store Info', icon: Settings },
    { id: 'inventory', label: 'Inventory', icon: Warehouse },
    { id: 'coupons', label: 'Coupons', icon: Tag },
  ];

  const selectStyle = { borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424', backgroundColor: 'white' };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
            Configuration
          </p>
          <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            Settings
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: '#E8E4DC' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 -mb-px transition-colors"
              style={{ borderColor: tab === t.id ? '#9D7D39' : 'transparent', color: tab === t.id ? '#9D7D39' : '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Store Info Tab ── */}
        {tab === 'store' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border shadow-sm p-6" style={{ borderColor: '#E8E4DC' }}>
              <h2 className="text-sm font-semibold tracking-wider uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                Store Information
              </h2>
              {settingsLoading ? (
                <Loader2 className="animate-spin" size={20} style={{ color: '#9D7D39' }} />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: '#F0EDE8' }}>
                    <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Store Name</span>
                    <span className="text-xs font-medium" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>Cove Interior</span>
                  </div>
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: '#F0EDE8' }}>
                    <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Currency</span>
                    <span className="text-xs font-medium" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>KWD (Kuwaiti Dinar)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Language */}
            <div className="bg-white rounded-lg border shadow-sm p-6" style={{ borderColor: '#E8E4DC' }}>
              <h2 className="text-sm font-semibold tracking-wider uppercase mb-1" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                Admin Language
              </h2>
              <p className="text-xs mb-4" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Controls the display language for attribute labels and other bilingual content in the admin panel.
              </p>
              {settingsLoading ? (
                <Loader2 className="animate-spin" size={20} style={{ color: '#9D7D39' }} />
              ) : (
                <div className="flex gap-2">
                  {(['en', 'ar'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => updateSettings.mutate({ adminLanguage: lang })}
                      className="px-4 py-2 text-xs font-semibold tracking-wider uppercase border transition-colors"
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        backgroundColor: ((storeSettings as any)?.adminLanguage ?? 'en') === lang ? '#9D7D39' : 'transparent',
                        color: ((storeSettings as any)?.adminLanguage ?? 'en') === lang ? '#FAFAF8' : '#9D7D39',
                        borderColor: '#9D7D39',
                      }}
                    >
                      {lang === 'en' ? 'English' : 'Arabic عربي'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Payment Gateway — link to dedicated page */}
            <div className="bg-white rounded-lg border shadow-sm p-6" style={{ borderColor: '#E8E4DC' }}>
              <h2 className="text-sm font-semibold tracking-wider uppercase mb-1" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                Payment Gateway
              </h2>
              <p className="text-xs mb-4" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Manage payment gateways, API keys, and Cash on Delivery settings from the dedicated Payment Gateways page.
              </p>
              <a href="/admin/payment-gateways"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase"
                style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif', textDecoration: 'none' }}>
                Manage Payment Gateways →
              </a>
            </div>
          </div>
        )}

        {/* ── Inventory Tab ── */}
        {tab === 'inventory' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border shadow-sm p-6" style={{ borderColor: '#E8E4DC' }}>
              <h2 className="text-sm font-semibold tracking-wider uppercase mb-1" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                Warehouse Management
              </h2>
              <p className="text-xs mb-5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Create tenant warehouses here, then link each sales channel to the warehouse that should supply stock.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <input className={inputCls} style={inputStyle} placeholder="Warehouse name" value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm((f) => ({ ...f, name: e.target.value }))} />
                <input className={inputCls} style={inputStyle} placeholder="Code, e.g. ONLINE" value={warehouseForm.code}
                  onChange={(e) => setWarehouseForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
                <select className={inputCls} style={{ ...selectStyle }} value={warehouseForm.type}
                  onChange={(e) => setWarehouseForm((f) => ({ ...f, type: e.target.value as 'main' | 'online' | 'pos' }))}>
                  <option value="main">Main</option>
                  <option value="online">Online</option>
                  <option value="pos">POS</option>
                </select>
                <button onClick={handleCreateWarehouse} disabled={addWarehouse.isPending}
                  className="px-4 py-2 text-xs font-semibold tracking-wider uppercase disabled:opacity-50"
                  style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                  {addWarehouse.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Create Warehouse'}
                </button>
              </div>
              <input className={inputCls} style={inputStyle} placeholder="Optional description" value={warehouseForm.description}
                onChange={(e) => setWarehouseForm((f) => ({ ...f, description: e.target.value }))} />
              <div className="overflow-x-auto mt-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E8E4DC' }}>
                      {['Warehouse', 'Code', 'Type', 'Status', 'Action'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold tracking-wider uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(warehouses || []).map((w: any) => (
                      <tr key={w.id} className="border-b" style={{ borderColor: '#F0EDE8' }}>
                        <td className="px-3 py-3 text-xs font-medium" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>{w.name}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{w.code}</td>
                        <td className="px-3 py-3 text-xs uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{w.type}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: w.isActive ? '#10B981' : '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>{w.isActive ? 'Active' : 'Inactive'}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => {
                              const name = prompt('Warehouse name', w.name);
                              if (name === null) return;
                              const code = prompt('Warehouse code', w.code);
                              if (code === null) return;
                              const type = prompt('Warehouse type: main, online, or pos', w.type);
                              if (type === null) return;
                              if (!['main', 'online', 'pos'].includes(type)) { toast.error('Warehouse type must be main, online, or pos'); return; }
                              const description = prompt('Description', w.description || '') ?? '';
                              updateWarehouse.mutate({ id: w.id, name: name.trim(), code: code.trim().toUpperCase(), type: type as 'main' | 'online' | 'pos', description });
                            }}
                              disabled={updateWarehouse.isPending}
                              className="px-3 py-1 text-[10px] font-semibold tracking-wider uppercase border disabled:opacity-50"
                              style={{ borderColor: '#D4C9B8', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                              Edit
                            </button>
                            <button onClick={() => updateWarehouse.mutate({ id: w.id, isActive: !w.isActive })}
                              disabled={updateWarehouse.isPending}
                              className="px-3 py-1 text-[10px] font-semibold tracking-wider uppercase border disabled:opacity-50"
                              style={{ borderColor: '#D4C9B8', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                              {w.isActive ? 'Delete' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg border shadow-sm p-6" style={{ borderColor: '#E8E4DC' }}>
              <h2 className="text-sm font-semibold tracking-wider uppercase mb-1" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                Sales Channel Stock Source
              </h2>
              <p className="text-xs mb-6" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Website orders deduct from the Online Store warehouse. POS orders deduct from the selected POS warehouse when POS is active.
              </p>
              {settingsLoading ? (
                <Loader2 className="animate-spin" size={20} style={{ color: '#9D7D39' }} />
              ) : (
                <div className="space-y-5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={posEnabled} onChange={(e) => setPosEnabled(e.target.checked)} className="accent-[#9D7D39] w-4 h-4" />
                    <div>
                      <p className="text-xs font-semibold" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>Enable Point of Sale (POS)</p>
                      <p className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Allow staff to use the POS terminal for in-store sales.</p>
                    </div>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Main Warehouse', helper: 'Default operational warehouse.', value: mainWarehouseId, onChange: setMainWarehouseId },
                      { label: 'Website / Online Warehouse', helper: 'Website orders and online availability use this warehouse.', value: onlineWarehouseId, onChange: setOnlineWarehouseId },
                      { label: 'POS / Brass Store Warehouse', helper: 'POS sales use this warehouse when POS is enabled.', value: posWarehouseId, onChange: setPosWarehouseId },
                    ].map((wh) => (
                      <div key={wh.label}>
                        <label className={labelCls} style={labelStyle}>{wh.label}</label>
                        <select className={inputCls} style={{ ...selectStyle }} value={wh.value} onChange={(e) => wh.onChange(e.target.value)}>
                          <option value="">— Use fallback by warehouse type —</option>
                          {(warehouses || []).filter((w: any) => w.isActive !== false).map((w: any) => (
                            <option key={w.id} value={String(w.id)}>{w.name} ({w.code})</option>
                          ))}
                        </select>
                        <p className="text-[11px] mt-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{wh.helper}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleSaveInventory} disabled={updateSettings.isPending}
                    className="px-4 py-2 text-xs font-semibold tracking-wider uppercase disabled:opacity-50"
                    style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                    {updateSettings.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Save Inventory Settings'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Coupons Tab ── */}
        {tab === 'coupons' && (
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E8E4DC' }}>
              <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                Discount Coupons
              </h2>
              <button
                onClick={() => setCouponModal({ open: true })}
                className="flex items-center gap-2 px-3 py-2 text-[10px] font-semibold tracking-wider uppercase border transition-colors hover:border-[#9D7D39] hover:text-[#9D7D39]"
                style={{ borderColor: '#D4C9B8', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                <Plus size={12} /> New Coupon
              </button>
            </div>
            {couponsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin" size={24} style={{ color: '#9D7D39' }} />
              </div>
            ) : !coupons || coupons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Tag size={32} className="mb-3" style={{ color: '#D4C9B8' }} />
                <p className="text-sm mb-4" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>No coupons yet.</p>
                <button onClick={() => setCouponModal({ open: true })}
                  className="px-4 py-2 text-xs font-semibold tracking-wider uppercase"
                  style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                  Create First Coupon
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E8E4DC' }}>
                      {['Code', 'Type', 'Amount', 'Min Order', 'Usage', 'Expiry', 'Free Ship', 'Active', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                          style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c: any) => (
                      <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#F0EDE8' }}>
                        <td className="px-4 py-3 font-medium text-xs" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>{c.code}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                          {c.type === 'percent' ? 'Percent' : c.type === 'fixed_cart' ? 'Fixed Cart' : 'Fixed Product'}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                          {c.type === 'percent' ? `${parseFloat(String(c.amount))}%` : `${parseFloat(String(c.amount)).toFixed(3)} KWD`}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                          {c.minimumAmount ? `${parseFloat(String(c.minimumAmount)).toFixed(3)} KWD` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                          {c.usageCount ?? 0}{c.usageLimit ? ` / ${c.usageLimit}` : ''}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                          {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.freeShipping ? <Check size={14} style={{ color: '#10B981' }} /> : <span style={{ color: '#D4C9B8' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full"
                            style={{ backgroundColor: c.isActive ? '#10B98120' : '#EF444420', color: c.isActive ? '#10B981' : '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>
                            {c.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCouponModal({ open: true, initial: c })}
                              className="p-1 hover:opacity-70 transition-opacity" style={{ color: '#8A8A82' }}>
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => { if (confirm(`Delete coupon "${c.code}"?`)) deleteCoupon.mutate({ id: c.id }); }}
                              className="p-1 hover:opacity-70 transition-opacity" style={{ color: '#EF4444' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Coupon Modal */}
      {couponModal.open && (
        <CouponModal
          initial={couponModal.initial}
          onClose={() => setCouponModal({ open: false })}
          onSave={handleCouponSave}
          saving={createCoupon.isPending || updateCoupon.isPending}
        />
      )}
    </AdminLayout>
  );
}
