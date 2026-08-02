/**
 * POSMySales — Personal sales dashboard for POS staff
 * Shows: today's sales, this month's sales, all-time totals, and order list
 */
import { useState } from 'react';
import { TrendingUp, ShoppingBag, Calendar, Award, Loader2, RotateCcw, X } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string; sub?: string; icon: any; accent?: boolean;
}) {
  return (
    <div className="rounded-lg p-5 border" style={{
      backgroundColor: accent ? '#111110' : '#FAFAF8',
      borderColor: accent ? 'transparent' : '#E8E4DC',
    }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase"
          style={{ color: accent ? 'rgba(250,250,248,0.5)' : '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
          {label}
        </p>
        <Icon size={16} style={{ color: '#9D7D39' }} />
      </div>
      <p className="text-2xl font-light italic" style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        color: accent ? '#FAFAF8' : '#242424',
      }}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-1" style={{ color: accent ? 'rgba(250,250,248,0.4)' : '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-KW', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Inline Return Request modal */
function ReturnRequestModal({ order, onClose }: { order: any; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const submit = trpc.returnRequests.submit.useMutation({
    onSuccess: () => {
      toast.success(`Return request submitted for order #${order.orderNumber}`);
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-light italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            Return Request — #{order.orderNumber}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs mb-3" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
          Describe the reason for the return. An admin will review and approve or reject this request.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Item damaged on arrival, wrong colour delivered..."
          rows={4}
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
          style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif' }}
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold tracking-wider uppercase border rounded-lg"
            style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
            Cancel
          </button>
          <button
            onClick={() => submit.mutate({ orderId: order.id, reason })}
            disabled={reason.trim().length < 3 || submit.isPending}
            className="flex-1 py-2 text-xs font-semibold tracking-wider uppercase rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}>
            {submit.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

export default function POSMySales() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [returnOrder, setReturnOrder] = useState<any>(null);
  const limit = 20;

  const { data: stats, isLoading: statsLoading } = trpc.pos.myStats.useQuery();
  const { data: ordersData, isLoading: ordersLoading } = trpc.pos.myOrders.useQuery({
    limit,
    offset: page * limit,
  });

  const orders = ordersData?.orders ?? [];
  const total = ordersData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] font-semibold tracking-[0.3em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
            POS Staff
          </p>
          <h1 className="text-3xl font-light italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            My Sales
          </h1>
          {user && (
            <p className="text-xs mt-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              {user.name || user.email}
            </p>
          )}
        </div>

        {/* Stats Grid */}
        {statsLoading ? (
          <div className="flex items-center gap-2 mb-8 text-xs" style={{ color: '#8A8A82' }}>
            <Loader2 size={14} className="animate-spin" /> Loading stats...
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Today's Sales"
              value={`${(stats?.todaySales ?? 0).toFixed(3)} KWD`}
              sub={`${stats?.todayOrders ?? 0} orders`}
              icon={TrendingUp}
              accent
            />
            <StatCard
              label="This Month"
              value={`${(stats?.monthSales ?? 0).toFixed(3)} KWD`}
              sub={`${stats?.monthOrders ?? 0} orders`}
              icon={Calendar}
            />
            <StatCard
              label="All Time"
              value={`${(stats?.totalSales ?? 0).toFixed(3)} KWD`}
              sub={`${stats?.totalOrders ?? 0} total orders`}
              icon={Award}
            />
          </div>
        )}

        {/* Orders Table */}
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
            <ShoppingBag size={14} style={{ color: '#9D7D39' }} />
            <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
              My Orders ({total})
            </p>
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-xs" style={{ color: '#8A8A82' }}>
              <Loader2 size={14} className="animate-spin" /> Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ShoppingBag size={32} style={{ color: '#E8E4DC' }} />
              <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                No POS orders yet
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: '#F5F2ED' }}>
                      {['Order #', 'Customer', 'Date', 'Status', 'Payment', 'Total', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase"
                          style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order: any) => (
                      <tr key={order.id} className="border-t hover:bg-[#FAFAF8] transition-colors" style={{ borderColor: '#E8E4DC' }}>
                        <td className="px-4 py-3 text-xs font-semibold" style={{ fontFamily: 'Montserrat, sans-serif', color: '#9D7D39' }}>
                          #{order.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                          {order.customerName || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                            order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                            order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                            order.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
                          {parseFloat(String(order.total || 0)).toFixed(3)} KWD
                        </td>
                        <td className="px-4 py-3">
                          {['completed', 'delivered', 'shipped'].includes(order.status) && (
                            <button
                              onClick={() => setReturnOrder(order)}
                              className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-1 rounded border hover:bg-amber-50 transition-colors"
                              style={{ borderColor: '#9D7D39', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}
                              title="Submit Return Request">
                              <RotateCcw size={10} />
                              Return
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
                  <p className="text-[10px]" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                    Page {page + 1} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 text-[10px] font-semibold tracking-wider uppercase border rounded disabled:opacity-40"
                      style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 text-[10px] font-semibold tracking-wider uppercase border rounded disabled:opacity-40"
                      style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {returnOrder && (
        <ReturnRequestModal order={returnOrder} onClose={() => setReturnOrder(null)} />
      )}
    </AdminLayout>
  );
}
