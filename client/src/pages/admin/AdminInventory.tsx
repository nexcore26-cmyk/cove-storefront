/**
 * Admin Inventory — Multi-warehouse stock view, out-of-stock threshold, and stock movement
 */
import { useState, useMemo } from 'react';
import {
  Warehouse, ArrowRight, Loader2, Search, AlertCircle,
  ChevronDown, ChevronUp, History, Package, Plus, Pencil, X, Sliders, Download
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=100&q=60';

type Tab = 'stock' | 'movement' | 'warehouses';

export default function AdminInventory() {
  const { user } = useAuth();
  const isVendor = (user as any)?.role === 'vendor';
  const vendorId = isVendor ? (user as any)?.vendorId as number : undefined;
  const [tab, setTab] = useState<Tab>('stock');
  const [search, setSearch] = useState('');
  const [transferModal, setTransferModal] = useState<{ productId: number; productName: string } | null>(null);
  const [thresholdModal, setThresholdModal] = useState<{
    productId: number; productName: string; warehouseId: number; warehouseName: string;
    enabled: boolean; threshold: number;
  } | null>(null);
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [thresholdEnabled, setThresholdEnabled] = useState(false);
  const [thresholdValue, setThresholdValue] = useState('');

  // Warehouse management state
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any | null>(null);
  const [whName, setWhName] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whType, setWhType] = useState<'main' | 'online' | 'pos'>('main');
  const [whDesc, setWhDesc] = useState('');

  // Quick transfer state (Warehouses tab)
  const [quickTransferProductSearch, setQuickTransferProductSearch] = useState('');
  const [quickTransferProductId, setQuickTransferProductId] = useState<number | null>(null);
  const [quickTransferFrom, setQuickTransferFrom] = useState('');
  const [quickTransferTo, setQuickTransferTo] = useState('');
  const [quickTransferQty, setQuickTransferQty] = useState('');
  const [quickTransferReason, setQuickTransferReason] = useState('');
  // E4: Stock adjustment modal
  const [adjustModal, setAdjustModal] = useState<{ productId: number; variantId?: number; productName: string; warehouseId: number; warehouseName: string; currentQty: number } | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'remove' | 'set'>('add');
  const utils = trpc.useUtils();

  const { data: warehouses } = trpc.inventory.warehouses.useQuery();
  const { data: productsData, isLoading } = trpc.products.list.useQuery(
    { search: search || undefined, limit: 200, status: 'active', vendorId: vendorId },
    { enabled: tab === 'stock' }
  );
  const { data: transferHistory, isLoading: historyLoading } = trpc.inventory.transfers.useQuery(
    { limit: 100 },
    { enabled: tab === 'movement' }
  );

  const productIds = useMemo(() => (productsData?.items || []).map((p: any) => p.id), [productsData]);
  const { data: stockData } = trpc.inventory.stockByProducts.useQuery(
    { productIds },
    { enabled: productIds.length > 0 }
  );

  const { data: warehouseSummary } = trpc.inventory.warehouseSummary.useQuery(
    undefined,
    { enabled: tab === 'warehouses' }
  );

  // Quick transfer product search
  const { data: quickTransferProducts } = trpc.products.list.useQuery(
    { search: quickTransferProductSearch, limit: 8, status: 'active' },
    { enabled: tab === 'warehouses' && quickTransferProductSearch.length >= 2 && !quickTransferProductId }
  );

  const quickTransferMutation = trpc.inventory.transfer.useMutation({
    onSuccess: () => {
      utils.inventory.warehouseSummary.invalidate();
      setQuickTransferProductSearch('');
      setQuickTransferProductId(null);
      setQuickTransferFrom('');
      setQuickTransferTo('');
      setQuickTransferQty('');
      setQuickTransferReason('');
      toast.success('Stock transferred successfully');
    },
    onError: (err) => toast.error(err.message),
  });

  // Build a map: productId -> warehouseId -> stock row
  const stockMap = useMemo(() => {
    const map: Record<number, Record<number, { quantity: number; allocatedVariationQuantity: number; unallocatedQuantity: number; outOfStockThresholdEnabled: boolean; outOfStockThreshold: number }>> = {};
    (stockData || []).forEach((row: any) => {
      if (!map[row.productId]) map[row.productId] = {};
      map[row.productId][row.warehouseId] = {
        quantity: Number(row.quantity ?? 0),
        allocatedVariationQuantity: Number(row.allocatedVariationQuantity ?? 0),
        unallocatedQuantity: Number(row.unallocatedQuantity ?? row.quantity ?? 0),
        outOfStockThresholdEnabled: row.outOfStockThresholdEnabled,
        outOfStockThreshold: row.outOfStockThreshold,
      };
    });
    return map;
  }, [stockData]);

  const transferMutation = trpc.inventory.transfer.useMutation({
    onSuccess: () => {
      utils.inventory.stockByProducts.invalidate();
      setTransferModal(null);
      setTransferQty('');
      setTransferReason('');
      toast.success('Stock transferred successfully');
    },
    onError: (err) => toast.error(err.message),
  });

  // E4: Stock adjustment mutation
  const adjustMutation = trpc.inventory.adjust.useMutation({
    onSuccess: () => {
      utils.inventory.stockByProducts.invalidate();
      utils.inventory.transfers.invalidate();
      setAdjustModal(null);
      setAdjustQty('');
      setAdjustReason('');
      toast.success('Stock adjusted successfully');
    },
    onError: (err) => toast.error(err.message),
  });

  // E6: Inventory CSV export
  const { refetch: exportInventoryCsv, isFetching: isExportingCsv } = trpc.inventory.exportCsv.useQuery(
    {},
    { enabled: false }
  );
  const handleExportInventoryCsv = async () => {
    const result = await exportInventoryCsv();
    if (!result.data?.csv) return;
    const blob = new Blob([result.data.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Inventory exported');
  };

  const thresholdMutation = trpc.inventory.updateThreshold.useMutation({
    onSuccess: () => {
      utils.inventory.stockByProducts.invalidate();
      setThresholdModal(null);
      toast.success('Out-of-stock threshold updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const addWarehouseMutation = trpc.inventory.addWarehouse.useMutation({
    onSuccess: () => {
      utils.inventory.warehouses.invalidate();
      setShowAddWarehouse(false);
      setWhName(''); setWhCode(''); setWhType('main'); setWhDesc('');
      toast.success('Warehouse added');
    },
    onError: (err) => toast.error(err.message),
  });

  const updateWarehouseMutation = trpc.inventory.updateWarehouse.useMutation({
    onSuccess: () => {
      utils.inventory.warehouses.invalidate();
      setEditingWarehouse(null);
      toast.success('Warehouse updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveWarehouse = () => {
    if (!whName.trim() || !whCode.trim()) { toast.error('Name and code are required'); return; }
    if (editingWarehouse) {
      updateWarehouseMutation.mutate({ id: editingWarehouse.id, name: whName, type: whType, description: whDesc || undefined });
    } else {
      addWarehouseMutation.mutate({ name: whName, code: whCode, type: whType, description: whDesc || undefined });
    }
  };

  const openEditWarehouse = (w: any) => {
    setEditingWarehouse(w);
    setWhName(w.name);
    setWhCode(w.code);
    setWhType(w.type);
    setWhDesc(w.description || '');
    setShowAddWarehouse(true);
  };

  const handleTransfer = () => {
    if (!transferModal || !fromWarehouse || !toWarehouse || !transferQty) {
      toast.error('Please fill in all transfer fields');
      return;
    }
    const qty = parseInt(transferQty);
    if (isNaN(qty) || qty <= 0) { toast.error('Invalid quantity'); return; }
    const fromId = parseInt(fromWarehouse);
    const toId = parseInt(toWarehouse);
    if (fromId === toId) { toast.error('Source and destination must be different'); return; }
    const availableQty = stockMap[transferModal.productId]?.[fromId]?.quantity ?? 0;
    if (availableQty > 0 && qty > availableQty) {
      toast.error(`Cannot transfer ${qty} — only ${availableQty} available in source warehouse`);
      return;
    }
    transferMutation.mutate({
      fromWarehouseId: fromId, toWarehouseId: toId,
      productId: transferModal.productId, quantity: qty,
      reason: transferReason || 'Manual transfer',
    });
  };

  const openThresholdModal = (p: any, w: any) => {
    const existing = stockMap[p.id]?.[w.id];
    setThresholdEnabled(existing?.outOfStockThresholdEnabled ?? false);
    setThresholdValue(String(existing?.outOfStockThreshold ?? 0));
    setThresholdModal({ productId: p.id, productName: p.name, warehouseId: w.id, warehouseName: w.name, enabled: existing?.outOfStockThresholdEnabled ?? false, threshold: existing?.outOfStockThreshold ?? 0 });
  };

  const handleSaveThreshold = () => {
    if (!thresholdModal) return;
    const val = parseInt(thresholdValue);
    if (isNaN(val) || val < 0) { toast.error('Invalid threshold value'); return; }
    thresholdMutation.mutate({
      productId: thresholdModal.productId,
      warehouseId: thresholdModal.warehouseId,
      outOfStockThresholdEnabled: thresholdEnabled,
      outOfStockThreshold: val,
    });
  };

  const products = productsData?.items || [];

  const labelStyle = { fontFamily: 'Montserrat, sans-serif', color: '#242424' };
  const mutedStyle = { fontFamily: 'Montserrat, sans-serif', color: '#8A8A82' };
  const goldStyle = { color: '#9D7D39' };
  const borderColor = '#E8E4DC';

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={goldStyle}>
              Multi-Warehouse
            </p>
            <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Inventory
            </h1>
          </div>
          <button
            onClick={handleExportInventoryCsv}
            disabled={isExportingCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors disabled:opacity-40"
            style={{ borderColor: '#9D7D39', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
          >
            {isExportingCsv ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
            Export CSV
          </button>
        </div>

        {/* Warehouse legend */}
        {warehouses && warehouses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {warehouses.map((w: any) => (
              <div key={w.id} className="bg-white rounded-lg p-4 border shadow-sm" style={{ borderColor }}>
                <div className="flex items-center gap-2 mb-1">
                  <Warehouse size={14} style={goldStyle} />
                  <span className="text-xs font-semibold tracking-wider uppercase" style={labelStyle}>{w.name}</span>
                </div>
                <p className="text-[10px]" style={mutedStyle}>
                  {w.description || (w.type === 'main' ? 'Physical warehouse stock' : w.type === 'online' ? 'Available for online orders' : 'Available for POS sales')}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 mb-6 rounded-lg border" style={{ backgroundColor: 'rgba(157,125,57,0.05)', borderColor: 'rgba(157,125,57,0.2)' }}>
          <AlertCircle size={16} style={{ ...goldStyle, flexShrink: 0, marginTop: 2 }} />
          <p className="text-xs leading-relaxed" style={mutedStyle}>
            Stock transfers move quantity between warehouses with a full audit trail. Example: you have 500 units in <strong>Main Warehouse</strong> — allocate 200 to <strong>Online</strong> and 200 to <strong>POS</strong>, leaving 100 in Main.
            Click any stock cell to set an out-of-stock threshold for that product in that warehouse.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b" style={{ borderColor }}>
          {(isVendor ? (['stock'] as Tab[]) : (['stock', 'movement', 'warehouses'] as Tab[])).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-6 py-3 text-xs font-semibold tracking-wider uppercase transition-colors"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                color: tab === t ? '#9D7D39' : '#8A8A82',
                borderBottom: tab === t ? '2px solid #9D7D39' : '2px solid transparent',
                marginBottom: -1,
              }}>
              {t === 'stock' ? 'Stock Overview' : t === 'movement' ? 'Stock Movement' : 'Warehouses'}
            </button>
          ))}
        </div>

        {/* ── STOCK OVERVIEW TAB ── */}
        {tab === 'stock' && (
          <>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={mutedStyle} />
              <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm border bg-white outline-none focus:border-[#9D7D39] transition-colors"
                style={{ borderColor, ...labelStyle }} />
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ borderColor }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin" size={28} style={goldStyle} />
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Package size={40} className="mb-4" style={{ color: '#D4C9B8' }} />
                  <p className="text-sm" style={mutedStyle}>No products found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase" style={mutedStyle}>Product</th>
                        {(warehouses || []).map((w: any) => (
                          <th key={w.id} className="px-4 py-3 text-center text-xs font-semibold tracking-wider uppercase" style={mutedStyle}>
                            {w.name}
                          </th>
                        ))}
                        {!isVendor && <th className="px-4 py-3 text-center text-xs font-semibold tracking-wider uppercase" style={mutedStyle}>Transfer</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p: any) => {
                        const images = (() => { try { return JSON.parse(p.images || '[]'); } catch { return []; } })();
                        const img = Array.isArray(images) && images[0] ? images[0] : PLACEHOLDER_IMG;
                        return (
                          <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#F0EDE8' }}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <img src={img} alt={p.name} className="w-8 h-8 object-cover rounded flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-medium" style={labelStyle}>{p.name}</p>
                                  <p className="text-[10px]" style={mutedStyle}>{p.sku || '—'}</p>
                                </div>
                              </div>
                            </td>
                            {(warehouses || []).map((w: any) => {
                              const s = stockMap[p.id]?.[w.id];
                              const qty = s?.quantity ?? 0;
                              const allocatedQty = s?.allocatedVariationQuantity ?? 0;
                              const unallocatedQty = s?.unallocatedQuantity ?? qty;
                              const threshEnabled = s?.outOfStockThresholdEnabled ?? false;
                              const thresh = s?.outOfStockThreshold ?? 0;
                              const isOOS = threshEnabled ? qty <= thresh : qty <= 0;
                              return (
                                <td key={w.id} className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => openThresholdModal(p, w)}
                                    className="group flex flex-col items-center mx-auto gap-0.5 hover:opacity-80 transition-opacity"
                                    title="Click to set out-of-stock threshold"
                                  >
                                    <span className="text-sm font-medium" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: isOOS ? '#E53E3E' : '#242424' }}>
                                      {qty}
                                    </span>
                                    {(allocatedQty > 0 || unallocatedQty !== qty) && (
                                      <span className="text-[9px]" style={{ color: '#8A7A68', fontFamily: 'Montserrat, sans-serif' }}>
                                        {allocatedQty} alloc · {unallocatedQty} free
                                      </span>
                                    )}
                                    {threshEnabled && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(157,125,57,0.1)', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                                        OOS ≤ {thresh}
                                      </span>
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                            {!isVendor && (
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <button
                                  onClick={() => setTransferModal({ productId: p.id, productName: p.name })}
                                  className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors hover:border-[#9D7D39] hover:text-[#9D7D39]"
                                  style={{ borderColor: '#D4C9B8', ...labelStyle, fontFamily: 'Montserrat, sans-serif' }}
                                >
                                  <ArrowRight size={10} /> Transfer
                                </button>
                                <button
                                  onClick={() => {
                                    const firstWh = warehouses?.[0];
                                    if (!firstWh) return;
                                    const currentQty = stockMap[p.id]?.[firstWh.id]?.quantity ?? 0;
                                    setAdjustQty('');
                                    setAdjustReason('');
                                    setAdjustType('add');
                                    setAdjustModal({ productId: p.id, productName: p.name, warehouseId: firstWh.id, warehouseName: firstWh.name, currentQty });
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors hover:border-[#F59E0B] hover:text-[#F59E0B]"
                                  style={{ borderColor: '#D4C9B8', ...labelStyle, fontFamily: 'Montserrat, sans-serif' }}
                                >
                                  <Sliders size={10} /> Adjust
                                </button>
                              </div>
                            </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── STOCK MOVEMENT TAB ── */}
        {tab === 'movement' && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ borderColor }}>
            {historyLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin" size={28} style={goldStyle} />
              </div>
            ) : !transferHistory || transferHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <History size={40} className="mb-4" style={{ color: '#D4C9B8' }} />
                <p className="text-sm" style={mutedStyle}>No stock movements yet</p>
                <p className="text-xs mt-1" style={mutedStyle}>Transfers will appear here once you move stock between warehouses.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                      {['Date', 'Product', 'From', 'To', 'Qty', 'Reason', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase" style={mutedStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(transferHistory as any[]).map((t: any) => (
                      <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#F0EDE8' }}>
                        <td className="px-4 py-3 text-xs" style={mutedStyle}>
                          {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium" style={labelStyle}>{t.productId}</td>
                        <td className="px-4 py-3 text-xs" style={mutedStyle}>{t.fromWarehouseId}</td>
                        <td className="px-4 py-3 text-xs" style={mutedStyle}>{t.toWarehouseId}</td>
                        <td className="px-4 py-3 text-xs font-medium" style={labelStyle}>{t.quantity}</td>
                        <td className="px-4 py-3 text-xs" style={mutedStyle}>{t.reason || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider"
                            style={{ backgroundColor: t.status === 'completed' ? 'rgba(72,187,120,0.1)' : 'rgba(237,137,54,0.1)', color: t.status === 'completed' ? '#276749' : '#C05621', fontFamily: 'Montserrat, sans-serif' }}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── WAREHOUSES TAB ── */}
        {tab === 'warehouses' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs" style={mutedStyle}>Manage physical and virtual warehouses. Warehouse codes are used by the WC sync to assign stock.</p>
              <button
                onClick={() => { setEditingWarehouse(null); setWhName(''); setWhCode(''); setWhType('main'); setWhDesc(''); setShowAddWarehouse(true); }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-colors"
                style={{ backgroundColor: '#111110', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                <Plus size={12} /> Add Warehouse
              </button>
            </div>

            {/* Add/Edit form */}
            {showAddWarehouse && (
              <div className="bg-white rounded-lg border shadow-sm p-6" style={{ borderColor }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
                    {editingWarehouse ? 'Edit Warehouse' : 'New Warehouse'}
                  </h3>
                  <button onClick={() => setShowAddWarehouse(false)} style={{ color: '#8A8A82' }}><X size={16} /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={labelStyle}>Name *</label>
                    <input type="text" value={whName} onChange={e => setWhName(e.target.value)} placeholder="e.g. Main Warehouse"
                      className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39]"
                      style={{ borderColor, fontFamily: 'Montserrat, sans-serif', color: '#242424' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={labelStyle}>Code * {editingWarehouse && <span className="normal-case text-[10px]">(read-only)</span>}</label>
                    <input type="text" value={whCode} onChange={e => setWhCode(e.target.value.toUpperCase())} placeholder="e.g. MAIN"
                      readOnly={!!editingWarehouse}
                      className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39]"
                      style={{ borderColor, fontFamily: 'Montserrat, sans-serif', color: editingWarehouse ? '#8A8A82' : '#242424' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={labelStyle}>Type *</label>
                    <select value={whType} onChange={e => setWhType(e.target.value as any)}
                      className="w-full px-4 py-3 text-sm border outline-none focus:border-[#9D7D39]"
                      style={{ borderColor, fontFamily: 'Montserrat, sans-serif', color: '#242424', backgroundColor: 'white' }}>
                      <option value="main">Main (physical storage)</option>
                      <option value="online">Online (e-commerce orders)</option>
                      <option value="pos">POS (in-store sales)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={labelStyle}>Description</label>
                    <input type="text" value={whDesc} onChange={e => setWhDesc(e.target.value)} placeholder="Optional description"
                      className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39]"
                      style={{ borderColor, fontFamily: 'Montserrat, sans-serif', color: '#242424' }} />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={handleSaveWarehouse}
                    disabled={addWarehouseMutation.isPending || updateWarehouseMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 text-xs font-semibold tracking-wider uppercase transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                    {(addWarehouseMutation.isPending || updateWarehouseMutation.isPending) && <Loader2 size={12} className="animate-spin" />}
                    {editingWarehouse ? 'Save Changes' : 'Create Warehouse'}
                  </button>
                  <button onClick={() => setShowAddWarehouse(false)}
                    className="px-6 py-3 text-xs font-semibold tracking-wider uppercase border transition-colors hover:border-[#9D7D39]"
                    style={{ borderColor, color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Warehouse list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(warehouses || []).map((w: any) => (
                <div key={w.id} className="bg-white rounded-lg border shadow-sm p-5" style={{ borderColor }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Warehouse size={16} style={goldStyle} />
                      <span className="text-sm font-semibold" style={labelStyle}>{w.name}</span>
                    </div>
                    <button onClick={() => openEditWarehouse(w)} className="p-1 rounded hover:bg-gray-100" style={{ color: '#8A8A82' }}>
                      <Pencil size={12} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#F0EDE8', color: '#9D7D39' }}>{w.code}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                        style={{ backgroundColor: w.type === 'online' ? 'rgba(59,130,246,0.1)' : w.type === 'pos' ? 'rgba(168,85,247,0.1)' : 'rgba(157,125,57,0.1)', color: w.type === 'online' ? '#1d4ed8' : w.type === 'pos' ? '#7c3aed' : '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                        {w.type}
                      </span>
                    </div>
                    {w.description && <p className="text-xs mt-2" style={mutedStyle}>{w.description}</p>}
                    <div className="flex items-center gap-1 mt-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: w.isActive ? '#10B981' : '#EF4444' }} />
                      <span className="text-[10px]" style={mutedStyle}>{w.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    {/* Stock summary */}
                    {(() => {
                      const s = (warehouseSummary || []).find((r: any) => r.warehouseId === w.id);
                      if (!s) return null;
                      return (
                        <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2" style={{ borderColor: '#F0EDE8' }}>
                          <div>
                            <p className="text-[10px] font-semibold tracking-wider uppercase" style={mutedStyle}>Total Units</p>
                            <p className="text-sm font-medium" style={labelStyle}>{Number(s.totalUnits).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold tracking-wider uppercase" style={mutedStyle}>SKUs</p>
                            <p className="text-sm font-medium" style={labelStyle}>{Number(s.skuCount).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold tracking-wider uppercase" style={mutedStyle}>Low Stock</p>
                            <p className="text-sm font-medium" style={{ color: Number(s.lowStockCount) > 0 ? '#F59E0B' : '#8A8A82' }}>{Number(s.lowStockCount)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold tracking-wider uppercase" style={mutedStyle}>Out of Stock</p>
                            <p className="text-sm font-medium" style={{ color: Number(s.outOfStockCount) > 0 ? '#EF4444' : '#8A8A82' }}>{Number(s.outOfStockCount)}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>

            {/* ── QUICK TRANSFER ── */}
            <div className="mt-6 bg-white rounded-lg border p-6" style={{ borderColor: '#E8E4DC' }}>
              <h3 className="text-lg font-light mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>Quick Stock Transfer</h3>
              <p className="text-xs mb-4" style={mutedStyle}>Move stock between warehouses. A full audit record will be created in the Stock Movement tab.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={mutedStyle}>Product *</label>
                  <input
                    type="text"
                    value={quickTransferProductSearch}
                    onChange={e => { setQuickTransferProductSearch(e.target.value); setQuickTransferProductId(null); }}
                    placeholder="Search product..."
                    className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39]"
                    style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                  />
                  {quickTransferProductSearch.length >= 2 && !quickTransferProductId && (
                    <div className="absolute z-10 left-0 right-0 border rounded mt-1 bg-white shadow-sm max-h-40 overflow-y-auto" style={{ borderColor: '#E8E4DC' }}>
                      {(quickTransferProducts?.items || []).length === 0 ? (
                        <p className="px-4 py-2 text-xs" style={mutedStyle}>No products found</p>
                      ) : (
                        (quickTransferProducts?.items || []).map((p: any) => (
                          <button key={p.id} onClick={() => { setQuickTransferProductId(p.id); setQuickTransferProductSearch(p.name); }}
                            className="w-full text-left px-4 py-2 text-xs hover:bg-[#F5F1EB] transition-colors"
                            style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                            {p.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={mutedStyle}>Quantity *</label>
                  <input
                    type="number" min={1}
                    value={quickTransferQty}
                    onChange={e => setQuickTransferQty(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39]"
                    style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={mutedStyle}>From Warehouse *</label>
                  <select value={quickTransferFrom} onChange={e => setQuickTransferFrom(e.target.value)}
                    className="w-full px-4 py-3 text-sm border outline-none focus:border-[#9D7D39]"
                    style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424', backgroundColor: 'white' }}>
                    <option value="">Select...</option>
                    {(warehouses || []).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={mutedStyle}>To Warehouse *</label>
                  <select value={quickTransferTo} onChange={e => setQuickTransferTo(e.target.value)}
                    className="w-full px-4 py-3 text-sm border outline-none focus:border-[#9D7D39]"
                    style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424', backgroundColor: 'white' }}>
                    <option value="">Select...</option>
                    {(warehouses || []).filter((w: any) => String(w.id) !== quickTransferFrom).map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={mutedStyle}>Reason (optional)</label>
                  <input
                    type="text"
                    value={quickTransferReason}
                    onChange={e => setQuickTransferReason(e.target.value)}
                    placeholder="e.g. Allocate to online channel"
                    className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39]"
                    style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  if (!quickTransferProductId || !quickTransferFrom || !quickTransferTo || !quickTransferQty) {
                    toast.error('Please fill all required fields');
                    return;
                  }
                  const qty = Number(quickTransferQty);
                  if (isNaN(qty) || qty <= 0) { toast.error('Invalid quantity'); return; }
                  if (quickTransferFrom === quickTransferTo) { toast.error('Source and destination must be different'); return; }
                  quickTransferMutation.mutate({
                    productId: quickTransferProductId,
                    fromWarehouseId: Number(quickTransferFrom),
                    toWarehouseId: Number(quickTransferTo),
                    quantity: qty,
                    reason: quickTransferReason || 'Manual transfer',
                  });
                }}
                disabled={quickTransferMutation.isPending}
                className="mt-4 px-6 py-3 text-xs font-semibold tracking-wider uppercase disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: '#111110', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                {quickTransferMutation.isPending ? 'Transferring...' : 'Transfer Stock'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── TRANSFER MODAL ── */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-light mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Transfer Stock
            </h2>
            <p className="text-xs mb-6" style={mutedStyle}>{transferModal.productName}</p>
            <div className="space-y-4">
              {[
                { label: 'From Warehouse', value: fromWarehouse, setter: setFromWarehouse, filter: undefined },
                { label: 'To Warehouse', value: toWarehouse, setter: setToWarehouse, filter: (w: any) => String(w.id) !== fromWarehouse },
              ].map(({ label, value, setter, filter }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={labelStyle}>{label}</label>
                  <select value={value} onChange={(e) => setter(e.target.value)}
                    className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39]"
                    style={{ borderColor, fontFamily: 'Montserrat, sans-serif' }}>
                    <option value="">Select...</option>
                    {(filter ? (warehouses || []).filter(filter) : warehouses || []).map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              ))}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold tracking-wider uppercase" style={labelStyle}>Quantity</label>
                  {fromWarehouse && (() => {
                    const avail = stockMap[transferModal.productId]?.[parseInt(fromWarehouse)]?.quantity ?? null;
                    return avail !== null ? (
                      <span className="text-[10px] font-semibold" style={{ fontFamily: 'Montserrat, sans-serif', color: avail > 0 ? '#10B981' : '#EF4444' }}>
                        Available: {avail}
                      </span>
                    ) : null;
                  })()}
                </div>
                {(() => {
                  const avail = fromWarehouse ? (stockMap[transferModal.productId]?.[parseInt(fromWarehouse)]?.quantity ?? 0) : 0;
                  const qty = parseInt(transferQty) || 0;
                  const overLimit = fromWarehouse && avail > 0 && qty > avail;
                  return (
                    <>
                      <input
                        type="number" min="1"
                        max={fromWarehouse && avail > 0 ? avail : undefined}
                        value={transferQty}
                        onChange={(e) => setTransferQty(e.target.value)}
                        placeholder={fromWarehouse ? `Max ${avail}` : 'e.g. 200'}
                        className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39]"
                        style={{ borderColor: overLimit ? '#EF4444' : borderColor, fontFamily: 'Montserrat, sans-serif' }}
                      />
                      {overLimit && (
                        <p className="text-[10px] mt-1" style={{ color: '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>
                          Cannot exceed available quantity ({avail})
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={labelStyle}>Reason (optional)</label>
                <input type="text" value={transferReason} onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Allocate to online channel"
                  className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39]"
                  style={{ borderColor, fontFamily: 'Montserrat, sans-serif' }} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleTransfer} disabled={transferMutation.isPending}
                className="flex-1 py-3 text-xs font-semibold tracking-widest uppercase transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                {transferMutation.isPending ? 'Transferring...' : 'Confirm Transfer'}
              </button>
              <button onClick={() => setTransferModal(null)}
                className="flex-1 py-3 text-xs font-semibold tracking-widest uppercase border transition-colors hover:border-[#9D7D39]"
                style={{ borderColor, color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OUT-OF-STOCK THRESHOLD MODAL ── */}
      {thresholdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-light mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Out-of-Stock Threshold
            </h2>
            <p className="text-xs mb-1" style={mutedStyle}>{thresholdModal.productName}</p>
            <p className="text-[10px] mb-6 font-semibold tracking-wider uppercase" style={goldStyle}>{thresholdModal.warehouseName}</p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border" style={{ borderColor }}>
                <div>
                  <p className="text-xs font-semibold tracking-wider uppercase mb-0.5" style={labelStyle}>Enable Threshold</p>
                  <p className="text-[10px]" style={mutedStyle}>Show "Out of Stock" before quantity reaches 0</p>
                </div>
                <button
                  onClick={() => setThresholdEnabled(!thresholdEnabled)}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{ backgroundColor: thresholdEnabled ? '#9D7D39' : '#D4C9B8' }}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${thresholdEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {thresholdEnabled && (
                <div>
                  <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={labelStyle}>
                    Out-of-Stock at Quantity ≤
                  </label>
                  <input type="number" min="0" value={thresholdValue} onChange={(e) => setThresholdValue(e.target.value)}
                    placeholder="e.g. 400"
                    className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39]"
                    style={{ borderColor, fontFamily: 'Montserrat, sans-serif' }} />
                  <p className="text-[10px] mt-2" style={mutedStyle}>
                    Example: if you have 500 units and set threshold to 400, the product shows "Out of Stock" once quantity drops to 400 or below.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveThreshold} disabled={thresholdMutation.isPending}
                className="flex-1 py-3 text-xs font-semibold tracking-widest uppercase transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                {thresholdMutation.isPending ? 'Saving...' : 'Save Threshold'}
              </button>
              <button onClick={() => setThresholdModal(null)}
                className="flex-1 py-3 text-xs font-semibold tracking-widest uppercase border transition-colors hover:border-[#9D7D39]"
                style={{ borderColor, color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* E4: Stock Adjustment Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>Adjust Stock</h2>
              <button onClick={() => setAdjustModal(null)}><X size={18} style={{ color: '#8A8A82' }} /></button>
            </div>
            <p className="text-xs mb-4" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              <strong style={{ color: '#242424' }}>{adjustModal.productName}</strong> — {adjustModal.warehouseName}
            </p>
            <p className="text-xs mb-4" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Current quantity: <strong style={{ color: '#242424' }}>{adjustModal.currentQty}</strong>
            </p>
            {/* Warehouse selector */}
            <div className="mb-3">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Warehouse</label>
              <select
                value={adjustModal.warehouseId}
                onChange={(e) => {
                  const wId = Number(e.target.value);
                  const wh = warehouses?.find((w: any) => w.id === wId);
                  const currentQty = stockMap[adjustModal.productId]?.[wId]?.quantity ?? 0;
                  setAdjustModal({ ...adjustModal, warehouseId: wId, warehouseName: wh?.name ?? '', currentQty });
                }}
                className="block w-full mt-1 text-xs border rounded px-2 py-1.5 outline-none"
                style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
              >
                {(warehouses || []).map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            {/* Adjustment type */}
            <div className="mb-3">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Adjustment Type</label>
              <div className="flex gap-2 mt-1">
                {(['add', 'remove', 'set'] as const).map(t => (
                  <button key={t} onClick={() => setAdjustType(t)}
                    className="flex-1 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors"
                    style={{
                      borderColor: adjustType === t ? '#9D7D39' : '#E8E4DC',
                      color: adjustType === t ? '#9D7D39' : '#8A8A82',
                      backgroundColor: adjustType === t ? 'rgba(157,125,57,0.08)' : 'transparent',
                      fontFamily: 'Montserrat, sans-serif',
                    }}>
                    {t === 'add' ? '+ Add' : t === 'remove' ? '− Remove' : '= Set'}
                  </button>
                ))}
              </div>
            </div>
            {/* Quantity */}
            <div className="mb-3">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Quantity</label>
              <input type="number" min={adjustType === 'set' ? '0' : '1'} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)}
                placeholder={adjustType === 'set' ? 'Set final quantity, e.g. 0' : 'e.g. 10'}
                className="block w-full mt-1 text-xs border rounded px-2 py-1.5 outline-none"
                style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }} />
              <p className="text-[10px] mt-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                {adjustType === 'set'
                  ? 'Set means final stock quantity. Use 0 to hide the product from the shop.'
                  : adjustType === 'add'
                    ? 'Add means increase stock by this amount.'
                    : 'Remove means decrease stock by this amount.'}
              </p>
            </div>
            {/* Reason */}
            <div className="mb-4">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Reason (required)</label>
              <input type="text" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Damaged goods, Stock count correction"
                className="block w-full mt-1 text-xs border rounded px-2 py-1.5 outline-none"
                style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }} />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const qty = Number.parseInt(adjustQty, 10);
                  if (Number.isNaN(qty) || qty < 0) { toast.error('Enter a valid quantity'); return; }
                  if (adjustType !== 'set' && qty <= 0) { toast.error('Enter a quantity greater than zero'); return; }
                  if (!adjustReason.trim()) { toast.error('Reason is required'); return; }
                  const delta = adjustType === 'add' ? qty : adjustType === 'remove' ? -qty : qty - adjustModal.currentQty;
                  if (delta === 0) { toast.info('Stock is already set to this quantity'); return; }
                  const adjType = adjustType === 'add' ? 'found' : adjustType === 'remove' ? 'damage' : 'correction';
                  adjustMutation.mutate({ productId: adjustModal.productId, warehouseId: adjustModal.warehouseId, quantityDelta: delta, type: adjType, reason: adjustReason });
                }}
                disabled={adjustMutation.isPending}
                className="flex-1 py-3 text-xs font-semibold tracking-widest uppercase transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
              >
                {adjustMutation.isPending ? 'Adjusting...' : 'Apply Adjustment'}
              </button>
              <button onClick={() => setAdjustModal(null)}
                className="flex-1 py-3 text-xs font-semibold tracking-widest uppercase border transition-colors hover:border-[#9D7D39]"
                style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
