/**
 * Admin Products — List, search, toggle featured/status, edit pricing
 */
import { useState, useMemo } from 'react';
import { Search, Star, Edit2, Loader2, Package, RefreshCw, Trash2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Link } from 'wouter';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&q=60';

export default function AdminProducts() {
  const { user } = useAuth();
  const isVendor = (user as any)?.role === 'vendor';
  const vendorId = isVendor ? (user as any)?.vendorId as number : undefined;
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editSalePrice, setEditSalePrice] = useState('');
  const [editCog, setEditCog] = useState('');
  const [editMeasurementType, setEditMeasurementType] = useState<'unit' | 'meter' | 'kg' | 'roll' | 'box'>('unit');
  const utils = trpc.useUtils();

  const { data: categoriesData, isLoading: categoriesLoading } = trpc.categories.list.useQuery({});
  const categories = useMemo(() => ((categoriesData as any)?.items ?? categoriesData ?? []) as any[], [categoriesData]);
  const isLegacySplitCategory = (cat: any) => {
    const haystack = `${cat?.name ?? ''} ${cat?.slug ?? ''}`.toLowerCase();
    return ['web', 'store', 'event'].some((token) => haystack.includes(token));
  };

  const { data, isLoading } = trpc.products.list.useQuery({
    search: search || undefined,
    categoryId: selectedCategoryId ? Number(selectedCategoryId) : undefined,
    limit: 200,
    vendorId: vendorId,
    status: isVendor ? 'active' : undefined,
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setEditingId(null);
      toast.success('Product updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const archiveMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      utils.inventory.stockByProducts.invalidate();
      setArchivingId(null);
      toast.success('Product archived');
    },
    onError: (err) => {
      setArchivingId(null);
      toast.error(err.message);
    },
  });

  const products = data?.items || [];

  // Fetch per-warehouse stock for visible products
  const productIds = useMemo(() => products.map((p: any) => p.id), [products]);
  const { data: stockData, isLoading: stockLoading } = trpc.inventory.stockByProducts.useQuery(
    { productIds },
    { enabled: productIds.length > 0 }
  );
  const { data: warehouses } = trpc.inventory.warehouses.useQuery();

  // Build stockMap: productId -> warehouseId -> { quantity, outOfStockThresholdEnabled, outOfStockThreshold }
  const stockMap = useMemo(() => {
    const map: Record<number, Record<number, { quantity: number; outOfStockThresholdEnabled: boolean; outOfStockThreshold: number }>> = {};
    (stockData || []).forEach((row: any) => {
      if (!map[row.productId]) map[row.productId] = {};
      map[row.productId][row.warehouseId] = {
        quantity: row.quantity,
        outOfStockThresholdEnabled: row.outOfStockThresholdEnabled ?? false,
        outOfStockThreshold: row.outOfStockThreshold ?? 0,
      };
    });
    return map;
  }, [stockData]);

  // Threshold popover state
  const [thresholdPopover, setThresholdPopover] = useState<{ productId: number; warehouseId: number; enabled: boolean; value: number } | null>(null);
  const thresholdMutation = trpc.inventory.updateThreshold.useMutation({
    onSuccess: () => {
      utils.inventory.stockByProducts.invalidate();
      setThresholdPopover(null);
      toast.success('Threshold updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setEditPrice(String(p.price || ''));
    setEditSalePrice(String(p.salePrice || ''));
    setEditCog(String(p.cog || ''));
    setEditMeasurementType(p.measurementType || 'unit');
  };

  const handleSave = (id: number) => {
    updateMutation.mutate({
      id,
      price: editPrice || undefined,
      salePrice: editSalePrice || undefined,
      cog: editCog || undefined,
      measurementType: editMeasurementType,
    });
  };

  const toggleFeatured = (p: any) => {
    updateMutation.mutate({ id: p.id, isFeatured: !p.isFeatured });
  };

  const toggleNew = (p: any) => {
    updateMutation.mutate({ id: p.id, isNew: !p.isNew });
  };

  const handleArchiveProduct = (p: any) => {
    const productLabel = `${p.name || 'this product'}${p.sku ? ` (SKU ${p.sku})` : ''}`;
    const confirmed = window.confirm(
      `Archive ${productLabel}?\n\nThis is the safe delete action: it hides the product from the active catalogue by changing its status to Archived. It does not remove historical orders, inventory records, or audit data.`
    );
    if (!confirmed) return;
    setArchivingId(p.id);
    archiveMutation.mutate({ id: p.id, status: 'archived', isFeatured: false, isNew: false });
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
              Catalogue
            </p>
            <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Products
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/products/new">
              <button className="flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase border transition-colors"
                style={{ backgroundColor: '#242424', borderColor: '#242424', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                + New Product
              </button>
            </Link>

          </div>
        </div>

        {/* Search and category filter */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#8A8A82' }} />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm border bg-white outline-none focus:border-[#9D7D39] transition-colors"
              style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Category Filter
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              disabled={categoriesLoading}
              className="w-full px-4 py-3 text-sm border bg-white outline-none focus:border-[#9D7D39] transition-colors disabled:opacity-60"
              style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
              aria-label="Filter products by category"
            >
              <option value="">All Categories</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name}{isLegacySplitCategory(cat) ? ' — Legacy Web/Store/Event' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px]" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Use this to review old Web, Store, and Event category-linked products before any cleanup.
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin" size={28} style={{ color: '#9D7D39' }} />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Package size={40} className="mb-4" style={{ color: '#D4C9B8' }} />
              <p className="text-sm mb-2" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                No products found
              </p>
              <Link href="/admin/products/new" className="text-xs font-semibold tracking-wider uppercase hover:text-[#9D7D39] transition-colors mt-2"
                style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                Add New Product →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #E8E4DC' }}>
                    {['Product', 'SKU', 'Price', 'Sale', 'COG', 'Measure', 'Status', 'Featured', 'New'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                        style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                    {(warehouses || []).map((w: any) => (
                      <th key={`wh-${w.id}`} className="px-4 py-3 text-center text-xs font-semibold tracking-wider uppercase"
                        style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                        {w.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                      style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: any) => {
                    const images = (() => { if (Array.isArray(p.images)) return p.images; try { return JSON.parse(p.images || '[]'); } catch { return []; } })();
                    const img = Array.isArray(images) && images[0] ? images[0] : PLACEHOLDER_IMG;
                    const isEditing = editingId === p.id;

                    return (
                      <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#F0EDE8' }}>
                        {/* Product */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={img} alt={p.name} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                            <div>
                              <p className="font-medium text-xs" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                                {p.name}
                              </p>
                              <p className="text-[10px]" style={{ color: '#8A8A82' }}>{p.slug}</p>
                            </div>
                          </div>
                        </td>
                        {/* SKU */}
                        <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                          {p.sku || '—'}
                        </td>
                        {/* Price */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="number" step="0.001" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                              className="w-24 px-2 py-1 text-xs border focus:border-[#9D7D39] outline-none"
                              style={{ borderColor: '#E8E4DC' }} />
                          ) : (
                            <span className="text-xs font-medium italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                              {parseFloat(String(p.price || 0)).toFixed(3)}
                            </span>
                          )}
                        </td>
                        {/* Sale */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="number" step="0.001" value={editSalePrice} onChange={(e) => setEditSalePrice(e.target.value)}
                              className="w-24 px-2 py-1 text-xs border focus:border-[#9D7D39] outline-none"
                              style={{ borderColor: '#E8E4DC' }} />
                          ) : (
                            <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                              {p.salePrice ? parseFloat(String(p.salePrice)).toFixed(3) : '—'}
                            </span>
                          )}
                        </td>
                        {/* COG */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="number" step="0.001" value={editCog} onChange={(e) => setEditCog(e.target.value)}
                              className="w-24 px-2 py-1 text-xs border focus:border-[#9D7D39] outline-none"
                              style={{ borderColor: '#E8E4DC' }} />
                          ) : (
                            <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                              {p.cog ? parseFloat(String(p.cog)).toFixed(3) : '—'}
                            </span>
                          )}
                        </td>
                        {/* Measurement */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select
                              value={editMeasurementType}
                              onChange={(e) => setEditMeasurementType(e.target.value as any)}
                              className="px-2 py-1 text-xs border focus:border-[#9D7D39] outline-none bg-transparent"
                              style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                            >
                              <option value="unit">Unit</option>
                              <option value="meter">Meter</option>
                              <option value="kg">KG</option>
                              <option value="roll">Roll</option>
                              <option value="box">Box</option>
                            </select>
                          ) : (
                            <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                              {p.measurementType || 'unit'}
                            </span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full"
                            style={{
                              backgroundColor: p.status === 'active' ? '#10B98120' : '#6B728020',
                              color: p.status === 'active' ? '#10B981' : '#6B7280',
                              fontFamily: 'Montserrat, sans-serif',
                            }}>
                            {p.status}
                          </span>
                        </td>
                        {/* Featured */}
                        <td className="px-4 py-3">
                          <button onClick={() => toggleFeatured(p)} title="Toggle featured">
                            <Star size={16} fill={p.isFeatured ? '#9D7D39' : 'none'} style={{ color: p.isFeatured ? '#9D7D39' : '#D4C9B8' }} />
                          </button>
                        </td>
                        {/* New */}
                        <td className="px-4 py-3">
                          <button onClick={() => toggleNew(p)}
                            className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 border transition-colors"
                            style={{
                              borderColor: p.isNew ? '#9D7D39' : '#E8E4DC',
                              color: p.isNew ? '#9D7D39' : '#8A8A82',
                              fontFamily: 'Montserrat, sans-serif',
                            }}>
                            {p.isNew ? 'Yes' : 'No'}
                          </button>
                        </td>
                        {/* Per-warehouse stock */}
                        {(warehouses || []).map((w: any) => {
                          if (stockLoading) {
                            return (
                              <td key={`stock-${w.id}`} className="px-4 py-3 text-center">
                                <span className="inline-block w-8 h-3 rounded animate-pulse" style={{ backgroundColor: '#E8E4DC' }} />
                              </td>
                            );
                          }
                          const stockRow = stockMap[p.id]?.[w.id];
                          const qty = stockRow?.quantity ?? 0;
                          const hasData = stockData && stockData.length > 0;
                          return (
                            <td key={`stock-${w.id}`} className="px-4 py-3 text-center">
                              {hasData ? (
                                <button
                                  title="Click to set out-of-stock threshold"
                                  onClick={() => setThresholdPopover({
                                    productId: p.id,
                                    warehouseId: w.id,
                                    enabled: stockRow?.outOfStockThresholdEnabled ?? false,
                                    value: stockRow?.outOfStockThreshold ?? 0,
                                  })}
                                  className="text-xs font-medium hover:underline cursor-pointer"
                                  style={{ color: qty <= 0 ? '#EF4444' : qty <= 5 ? '#F59E0B' : '#10B981', fontFamily: 'Montserrat, sans-serif', background: 'none', border: 'none', padding: 0 }}>
                                  {qty}
                                  {stockRow?.outOfStockThresholdEnabled && (
                                    <span className="ml-1 text-[9px] font-semibold" style={{ color: '#9D7D39' }}>T:{stockRow.outOfStockThreshold}</span>
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs" style={{ color: '#D4C9B8' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        {/* Actions */}
                        <td className="px-4 py-3">
                          {isVendor ? (
                            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#D4C9B8', fontFamily: 'Montserrat, sans-serif' }}>View Only</span>
                          ) : isEditing ? (
                            <div className="flex gap-2">
                              <button onClick={() => handleSave(p.id)}
                                className="text-[10px] font-semibold tracking-wider uppercase px-3 py-1"
                                style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                                Save
                              </button>
                              <button onClick={() => setEditingId(null)}
                                className="text-[10px] font-semibold tracking-wider uppercase px-3 py-1 border"
                                style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleEdit(p)} className="hover:text-[#9D7D39] transition-colors" title="Quick edit pricing">
                                <Edit2 size={14} style={{ color: '#8A8A82' }} />
                              </button>
                              <Link href={`/admin/products/${p.id}`}>
                                <button className="text-[10px] font-semibold tracking-wider uppercase px-2 py-1 border hover:border-[#9D7D39] hover:text-[#9D7D39] transition-colors"
                                  style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                                  title="Full edit">
                                  Edit
                                </button>
                              </Link>
                              <button
                                onClick={() => handleArchiveProduct(p)}
                                disabled={archiveMutation.isPending && archivingId === p.id}
                                className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-1 border transition-colors disabled:opacity-60"
                                style={{ borderColor: '#F3D2D2', color: '#B91C1C', fontFamily: 'Montserrat, sans-serif' }}
                                title="Safe delete: archive product"
                              >
                                {archiveMutation.isPending && archivingId === p.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* ── THRESHOLD MODAL ── */}
      {thresholdPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-light mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Out-of-Stock Threshold
            </h2>
            <p className="text-xs mb-6" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Set the minimum stock level below which this product is shown as out of stock.
            </p>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={thresholdPopover.enabled}
                  onChange={e => setThresholdPopover(prev => prev ? { ...prev, enabled: e.target.checked } : null)}
                  className="w-4 h-4 accent-[#9D7D39]"
                />
                <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>Enable threshold</span>
              </label>
              {thresholdPopover.enabled && (
                <div>
                  <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Threshold value</label>
                  <input
                    type="number"
                    min={0}
                    value={thresholdPopover.value}
                    onChange={e => setThresholdPopover(prev => prev ? { ...prev, value: Number(e.target.value) } : null)}
                    className="w-full border px-3 py-2 text-sm rounded"
                    style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: '#8A8A82' }}>Product shown as out of stock when qty &le; this value</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => thresholdMutation.mutate({
                  productId: thresholdPopover.productId,
                  warehouseId: thresholdPopover.warehouseId,
                  outOfStockThresholdEnabled: thresholdPopover.enabled,
                  outOfStockThreshold: thresholdPopover.value,
                })}
                disabled={thresholdMutation.isPending}
                className="flex-1 py-2 text-xs font-semibold tracking-wider uppercase"
                style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
                {thresholdMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setThresholdPopover(null)}
                className="flex-1 py-2 text-xs font-semibold tracking-wider uppercase border"
                style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
