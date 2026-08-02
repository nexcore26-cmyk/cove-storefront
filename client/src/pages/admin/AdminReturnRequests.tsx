/**
 * AdminReturnRequests — Admin page to review, approve, reject, and execute refunds for return requests
 */
import { useState } from 'react';
import { RotateCcw, CheckCircle, XCircle, Loader2, DollarSign } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'executed';

function formatDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-KW', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    pending:  { bg: 'bg-amber-100',  text: 'text-amber-700' },
    approved: { bg: 'bg-green-100',  text: 'text-green-700' },
    rejected: { bg: 'bg-red-100',    text: 'text-red-700' },
    executed: { bg: 'bg-blue-100',   text: 'text-blue-700' },
  };
  const c = cfg[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

/** Inline resolve modal (approve or reject) */
function ResolveModal({
  rr,
  action,
  onClose,
}: {
  rr: any;
  action: 'approve' | 'reject';
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const utils = trpc.useUtils();
  const approve = trpc.returnRequests.approve.useMutation({
    onSuccess: () => {
      toast.success(`Return request #${rr.id} approved`);
      utils.returnRequests.list.invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });
  const reject = trpc.returnRequests.reject.useMutation({
    onSuccess: () => {
      toast.success(`Return request #${rr.id} rejected`);
      utils.returnRequests.list.invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const isPending = approve.isPending || reject.isPending;
  const isApprove = action === 'approve';

  const handleSubmit = () => {
    if (isApprove) {
      approve.mutate({ id: rr.id, notes: notes || undefined });
    } else {
      reject.mutate({ id: rr.id, notes: notes || undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-light italic mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
          {isApprove ? 'Approve' : 'Reject'} Return Request #{rr.id}
        </h2>
        <p className="text-xs mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
          Order: <strong>#{rr.orderNumber}</strong> — {rr.customerName || rr.customerEmail || 'Unknown'}
        </p>
        <p className="text-xs mb-4 italic" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
          Reason: "{rr.reason}"
        </p>
        <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
          Admin Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={isApprove ? 'e.g. Approved — customer to return item within 7 days' : 'e.g. Rejected — item shows signs of use beyond normal wear'}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 mb-4"
          style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif' }}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold tracking-wider uppercase border rounded-lg"
            style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 py-2 text-xs font-semibold tracking-wider uppercase rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              backgroundColor: isApprove ? '#16a34a' : '#dc2626',
              color: '#FAFAF8',
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : isApprove ? <CheckCircle size={12} /> : <XCircle size={12} />}
            {isApprove ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Execute Refund modal — shown for approved return requests */
function ExecuteRefundModal({
  rr,
  onClose,
}: {
  rr: any;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<string>(rr.orderTotal ? String(rr.orderTotal) : '');
  const [reason, setReason] = useState('');
  const utils = trpc.useUtils();

  const executeRefund = trpc.returnRequests.executeRefund.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Refund of ${data.refundAmount} KWD executed for return request #${rr.id}`);
      utils.returnRequests.list.invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }
    executeRefund.mutate({ id: rr.id, refundAmount: parsed, reason: reason || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={18} style={{ color: '#9D7D39' }} />
          <h2 className="text-lg font-light italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            Execute Refund — Return #{rr.id}
          </h2>
        </div>
        <p className="text-xs mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
          Order: <strong>#{rr.orderNumber}</strong> — {rr.customerName || rr.customerEmail || 'Unknown'}
        </p>
        <p className="text-xs mb-4 italic" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
          Reason: "{rr.reason}"
        </p>

        <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
          Refund Amount (KWD)
        </label>
        <input
          type="number"
          step="0.001"
          min="0.001"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="e.g. 45.000"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
          style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif' }}
        />

        <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
          Refund Reason (optional)
        </label>
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Item returned in original condition"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-4"
          style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif' }}
        />

        <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FCD34D' }}>
          <p className="text-[10px]" style={{ color: '#92400E', fontFamily: 'Montserrat, sans-serif' }}>
            This will immediately process a refund via MyFatoorah. This action cannot be undone.
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
            onClick={handleSubmit}
            disabled={executeRefund.isPending}
            className="flex-1 py-2 text-xs font-semibold tracking-wider uppercase rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
          >
            {executeRefund.isPending ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />}
            Execute Refund
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminReturnRequests() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [page, setPage] = useState(0);
  const [resolving, setResolving] = useState<{ rr: any; action: 'approve' | 'reject' } | null>(null);
  const [executing, setExecuting] = useState<any | null>(null);
  const limit = 30;

  const { data, isLoading } = trpc.returnRequests.list.useQuery({
    status: statusFilter === 'executed' ? 'all' : statusFilter,
    limit,
    offset: page * limit,
  });

  // Client-side filter for 'executed' since the backend enum doesn't include it in the filter yet
  const rows = (data ?? []).filter((rr: any) => {
    if (statusFilter === 'all') return true;
    return rr.status === statusFilter;
  });

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <p className="text-[10px] font-semibold tracking-[0.3em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
            Admin
          </p>
          <h1 className="text-3xl font-light italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            Return Requests
          </h1>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['pending', 'approved', 'rejected', 'executed', 'all'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className="px-4 py-1.5 text-[10px] font-semibold tracking-wider uppercase rounded-full border transition-colors"
              style={{
                borderColor: statusFilter === s ? '#9D7D39' : '#E8E4DC',
                backgroundColor: statusFilter === s ? '#9D7D39' : 'transparent',
                color: statusFilter === s ? '#FAFAF8' : '#8A8A82',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
            <div className="flex items-center gap-2">
              <RotateCcw size={14} style={{ color: '#9D7D39' }} />
              <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Requests
              </p>
            </div>
            {isLoading && <Loader2 size={14} className="animate-spin" style={{ color: '#9D7D39' }} />}
          </div>

          {!isLoading && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RotateCcw size={32} style={{ color: '#E8E4DC' }} />
              <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                No {statusFilter === 'all' ? '' : statusFilter} return requests
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F5F2ED' }}>
                    {['ID', 'Order', 'Customer', 'Reason', 'Status', 'Submitted', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase"
                        style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((rr: any) => (
                    <tr key={rr.id} className="border-t hover:bg-[#FAFAF8] transition-colors" style={{ borderColor: '#E8E4DC' }}>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                        #{rr.id}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                        #{rr.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                        {rr.customerName || rr.customerEmail || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        <span className="line-clamp-2">{rr.reason}</span>
                        {rr.notes && (
                          <p className="text-[10px] mt-0.5 italic" style={{ color: '#9D7D39' }}>
                            Note: {rr.notes}
                          </p>
                        )}
                        {rr.refundAmount && (
                          <p className="text-[10px] mt-0.5 font-semibold" style={{ color: '#1d4ed8' }}>
                            Refunded: {rr.refundAmount} KWD
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={rr.status} />
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {formatDate(rr.createdAt)}
                        {rr.resolvedAt && (
                          <p className="text-[10px] mt-0.5">Resolved: {formatDate(rr.resolvedAt)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {rr.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setResolving({ rr, action: 'approve' })}
                              className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-1 rounded border hover:bg-green-50 transition-colors"
                              style={{ borderColor: '#16a34a', color: '#16a34a', fontFamily: 'Montserrat, sans-serif' }}
                            >
                              <CheckCircle size={10} /> Approve
                            </button>
                            <button
                              onClick={() => setResolving({ rr, action: 'reject' })}
                              className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-1 rounded border hover:bg-red-50 transition-colors"
                              style={{ borderColor: '#dc2626', color: '#dc2626', fontFamily: 'Montserrat, sans-serif' }}
                            >
                              <XCircle size={10} /> Reject
                            </button>
                          </div>
                        )}
                        {rr.status === 'approved' && (
                          <button
                            onClick={() => setExecuting(rr)}
                            className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-1 rounded border hover:bg-amber-50 transition-colors"
                            style={{ borderColor: '#9D7D39', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}
                          >
                            <DollarSign size={10} /> Execute Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {rows.length === limit && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-[10px]" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Page {page + 1}
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
                onClick={() => setPage(p => p + 1)}
                disabled={rows.length < limit}
                className="px-3 py-1 text-[10px] font-semibold tracking-wider uppercase border rounded disabled:opacity-40"
                style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resolve modal */}
      {resolving && (
        <ResolveModal
          rr={resolving.rr}
          action={resolving.action}
          onClose={() => setResolving(null)}
        />
      )}

      {/* Execute Refund modal */}
      {executing && (
        <ExecuteRefundModal
          rr={executing}
          onClose={() => setExecuting(null)}
        />
      )}
    </AdminLayout>
  );
}
