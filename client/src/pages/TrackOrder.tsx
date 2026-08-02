/**
 * Track Order — Public page
 * Customers enter their order number + email to see real-time order status and timeline.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { Loader2, Search, Package, Truck, CheckCircle, Clock, XCircle, ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// ─── Status configuration ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Package }> = {
  pending:    { label: 'Order Placed',   color: '#F59E0B', icon: Clock },
  processing: { label: 'Processing',     color: '#3B82F6', icon: Package },
  on_hold:    { label: 'On Hold',        color: '#6B7280', icon: Clock },
  shipped:    { label: 'Shipped',        color: '#8B5CF6', icon: Truck },
  delivered:  { label: 'Delivered',      color: '#10B981', icon: CheckCircle },
  completed:  { label: 'Completed',      color: '#10B981', icon: CheckCircle },
  cancelled:  { label: 'Cancelled',      color: '#EF4444', icon: XCircle },
  refunded:   { label: 'Refunded',       color: '#EC4899', icon: XCircle },
  failed:     { label: 'Failed',         color: '#EF4444', icon: XCircle },
};

// The ordered steps for the progress timeline
const TIMELINE_STEPS = [
  { key: 'pending',    label: 'Order Placed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped',    label: 'Shipped' },
  { key: 'delivered',  label: 'Delivered' },
];

const STEP_ORDER = TIMELINE_STEPS.map(s => s.key);

function getStepIndex(status: string) {
  const idx = STEP_ORDER.indexOf(status);
  if (idx !== -1) return idx;
  if (status === 'completed') return 3; // same as delivered
  return -1; // cancelled / failed / refunded / on_hold
}

// ─── Timeline component ───────────────────────────────────────────────────────

function OrderTimeline({ status }: { status: string }) {
  const currentIdx = getStepIndex(status);
  const isCancelled = ['cancelled', 'failed', 'refunded'].includes(status);

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 py-4 px-5 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
        <XCircle size={20} style={{ color: '#EF4444' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>
            {STATUS_CONFIG[status]?.label || status}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Montserrat, sans-serif' }}>
            This order has been {status}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Connector line */}
      <div className="absolute top-5 left-5 right-5 h-0.5" style={{ backgroundColor: '#E8E4DC' }} />
      <div
        className="absolute top-5 left-5 h-0.5 transition-all duration-700"
        style={{
          backgroundColor: '#9D7D39',
          width: currentIdx >= 0 ? `${(currentIdx / (TIMELINE_STEPS.length - 1)) * 100}%` : '0%',
        }}
      />

      <div className="relative flex justify-between">
        {TIMELINE_STEPS.map((step, idx) => {
          const isDone = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div key={step.key} className="flex flex-col items-center gap-2" style={{ width: '25%' }}>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10"
                style={{
                  backgroundColor: isDone ? '#9D7D39' : '#FAFAF8',
                  borderColor: isDone ? '#9D7D39' : '#E8E4DC',
                  boxShadow: isCurrent ? '0 0 0 4px rgba(157,125,57,0.15)' : 'none',
                }}
              >
                {isDone
                  ? <CheckCircle size={18} color="#FAFAF8" />
                  : <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#D4C9B8' }} />
                }
              </div>
              <p
                className="text-[10px] font-semibold tracking-wider uppercase text-center leading-tight"
                style={{
                  color: isDone ? '#9D7D39' : '#8A8A82',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState<{ orderNumber: string; email: string } | null>(null);

  const { data, isLoading, error } = trpc.orders.track.useQuery(
    query!,
    { enabled: !!query, retry: false }
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim() || !email.trim()) {
      toast.error('Please enter both your order number and email address.');
      return;
    }
    setQuery({ orderNumber: orderNumber.trim(), email: email.trim().toLowerCase() });
  }

  const statusInfo = data ? (STATUS_CONFIG[data.status] || { label: data.status, color: '#6B7280', icon: Package }) : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F0E8' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#242420', padding: '20px 0' }}>
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2 text-sm" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif', textDecoration: 'none' }}>
              <ArrowLeft size={14} />
              Back to Store
            </a>
          </Link>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, color: '#FAFAF8', letterSpacing: 3 }}>
            COVE INTERIOR
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-2" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
            Order Status
          </p>
          <h1 className="text-4xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242420' }}>
            Track Your Order
          </h1>
          <p className="mt-3 text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
            Enter your order number and email address to see the latest status.
          </p>
        </div>

        {/* Lookup form */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6" style={{ border: '1px solid #E8E4DC' }}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Order Number
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. COV-2024-001"
                className="w-full px-3 py-2.5 text-sm border focus:outline-none focus:border-[#9D7D39] transition-colors"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242420', backgroundColor: '#FAFAF8' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="The email used when placing the order"
                className="w-full px-3 py-2.5 text-sm border focus:outline-none focus:border-[#9D7D39] transition-colors"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242420', backgroundColor: '#FAFAF8' }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold tracking-[0.2em] uppercase transition-colors disabled:opacity-60"
              style={{ backgroundColor: '#242420', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Track Order
            </button>
          </form>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-white rounded-lg p-5 shadow-sm" style={{ border: '1px solid #FECACA' }}>
            <p className="text-sm font-semibold" style={{ color: '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>
              {(error as any).message || 'Order not found'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Please double-check your order number and email address.
            </p>
          </div>
        )}

        {/* Order result */}
        {data && statusInfo && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ border: '1px solid #E8E4DC' }}>
            {/* Status banner */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: `${statusInfo.color}12`, borderBottom: '1px solid #E8E4DC' }}>
              <div>
                <p className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                  Order #{data.orderNumber}
                </p>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold tracking-wider uppercase rounded-full"
                  style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color, fontFamily: 'Montserrat, sans-serif' }}
                >
                  <statusInfo.icon size={11} />
                  {statusInfo.label}
                </span>
              </div>
              <div className="text-right">
                <p className="text-[10px]" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Total</p>
                <p className="text-lg font-light italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                  {parseFloat(String(data.total || 0)).toFixed(3)} {data.currency || 'KWD'}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="px-6 py-6">
              <OrderTimeline status={data.status} />
            </div>

            {/* Details */}
            <div className="px-6 pb-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                  Placed On
                </p>
                <p style={{ color: '#242420', fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  {new Date(data.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                  Items
                </p>
                <p style={{ color: '#242420', fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  {data.itemCount} {data.itemCount === 1 ? 'item' : 'items'}
                </p>
              </div>
              {data.paymentMethod && (
                <div>
                  <p className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                    Payment
                  </p>
                  <p style={{ color: '#242420', fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                    {data.paymentMethod}
                  </p>
                </div>
              )}
              {data.trackingNumber && (
                <div>
                  <p className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                    Tracking Number
                  </p>
                  <p className="font-mono text-xs" style={{ color: '#242420' }}>
                    {data.trackingNumber}
                  </p>
                </div>
              )}
              {data.shippedAt && (
                <div>
                  <p className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                    Shipped On
                  </p>
                  <p style={{ color: '#242420', fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                    {new Date(data.shippedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
              {data.deliveredAt && (
                <div>
                  <p className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                    Delivered On
                  </p>
                  <p style={{ color: '#242420', fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                    {new Date(data.deliveredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#FAFAF8', borderTop: '1px solid #E8E4DC' }}>
              <p className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Questions? Email us at{' '}
                <a href="mailto:info@coveinterior.com" style={{ color: '#9D7D39' }}>info@coveinterior.com</a>
              </p>
              <Link href="/shop">
                <a className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif', textDecoration: 'none' }}>
                  Continue Shopping →
                </a>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
