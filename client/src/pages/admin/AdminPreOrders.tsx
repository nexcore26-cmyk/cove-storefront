/**
 * AdminPreOrders — Pre-Order Fulfilment Dashboard (Phase 67)
 *
 * Lists all product variants with active pre-orders (preOrderEnabled=true AND preOrderUsed>0).
 * Admin can fulfil a pre-order variant, which:
 *   - Disables pre-order for that variant
 *   - Resets preOrderUsed to 0
 *   - Moves related pending orders to 'processing' status
 */
import { useState } from 'react';
import { Package, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

function ProgressBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 90 ? '#dc2626' : pct >= 60 ? '#f59e0b' : '#16a34a';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-semibold" style={{ color, fontFamily: 'Montserrat, sans-serif' }}>
        {used}/{limit}
      </span>
    </div>
  );
}

function FulfilConfirmModal({
  row,
  onClose,
}: {
  row: any;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const fulfil = trpc.products.fulfilPreOrder.useMutation({
    onSuccess: () => {
      toast.success(`Pre-order fulfilled for ${row.variantName || row.productName}`);
      utils.products.preOrderSummary.invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle size={18} style={{ color: '#16a34a' }} />
          <h2 className="text-lg font-light italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            Fulfil Pre-Order
          </h2>
        </div>
        <p className="text-sm mb-2" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
          <strong>{row.productName}</strong>
          {row.variantName && <span className="text-gray-500"> — {row.variantName}</span>}
        </p>
        <p className="text-xs mb-4" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
          SKU: <strong>{row.sku || '—'}</strong> &nbsp;·&nbsp; Pre-orders used: <strong>{row.preOrderUsed}</strong> of <strong>{row.preOrderLimit}</strong>
        </p>

        <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC' }}>
          <p className="text-[10px]" style={{ color: '#166534', fontFamily: 'Montserrat, sans-serif' }}>
            This will disable pre-ordering for this variant, reset the pre-order counter to 0, and move any related pending orders to <strong>processing</strong> status.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold tracking-wider uppercase border rounded-lg"
            style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
          >
            Cancel
          </button>
          <button
            onClick={() => fulfil.mutate({ variantId: row.variantId })}
            disabled={fulfil.isPending}
            className="flex-1 py-2 text-xs font-semibold tracking-wider uppercase rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: '#16a34a', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
          >
            {fulfil.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            Fulfil Pre-Order
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPreOrders() {
  const [confirming, setConfirming] = useState<any | null>(null);

  const { data, isLoading, refetch } = trpc.products.preOrderSummary.useQuery();
  const rows = data ?? [];

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.3em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
              Admin
            </p>
            <h1 className="text-3xl font-light italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Pre-Order Fulfilment
            </h1>
            <p className="text-xs mt-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Variants with active pre-orders — fulfil to disable pre-ordering and advance pending orders to processing.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border rounded-lg hover:bg-gray-50 transition-colors"
            style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
          >
            <RefreshCw size={11} />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
            <div className="flex items-center gap-2">
              <Package size={14} style={{ color: '#9D7D39' }} />
              <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                Active Pre-Orders
              </p>
              {!isLoading && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#9D7D3920', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                  {rows.length}
                </span>
              )}
            </div>
            {isLoading && <Loader2 size={14} className="animate-spin" style={{ color: '#9D7D39' }} />}
          </div>

          {!isLoading && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Package size={32} style={{ color: '#E8E4DC' }} />
              <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                No active pre-orders
              </p>
              <p className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Pre-orders appear here when a variant has pre-ordering enabled and at least one pre-order placed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F5F2ED' }}>
                    {['Product', 'Variant / SKU', 'Pre-Orders', 'Progress', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase"
                        style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => (
                    <tr key={row.variantId} className="border-t hover:bg-[#FAFAF8] transition-colors" style={{ borderColor: '#E8E4DC' }}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                          {row.productName || '—'}
                        </p>
                        {row.productSlug && (
                          <p className="text-[10px] mt-0.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            /{row.productSlug}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                          {row.variantName || 'Default'}
                        </p>
                        {row.sku && (
                          <p className="text-[10px] mt-0.5 font-mono" style={{ color: '#9D7D39' }}>
                            {row.sku}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-semibold" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                            {row.preOrderUsed}
                          </span>
                          <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            / {row.preOrderLimit} limit
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <ProgressBar used={row.preOrderUsed} limit={row.preOrderLimit} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setConfirming(row)}
                          className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded border hover:bg-green-50 transition-colors"
                          style={{ borderColor: '#16a34a', color: '#16a34a', fontFamily: 'Montserrat, sans-serif' }}
                        >
                          <CheckCircle size={10} /> Fulfil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Fulfil confirmation modal */}
      {confirming && (
        <FulfilConfirmModal
          row={confirming}
          onClose={() => setConfirming(null)}
        />
      )}
    </AdminLayout>
  );
}
