/**
 * Admin Orders — Order list with status filtering, order detail modal, invoice download, and resend email
 */
import { useState, useEffect } from 'react';
import { Loader2, ShoppingCart, ChevronDown, FileDown, Eye, Mail, X, Package, MapPin, CreditCard, ArrowLeftRight, Plus, Trash2, Clock, StickyNote, Tag, Download } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { cleanName } from '@/lib/cleanName';

const STATUSES = ['all', 'pending', 'processing', 'on_hold', 'completed', 'shipped', 'delivered', 'cancelled', 'refunded', 'failed', 'exchanged'];
const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B', processing: '#3B82F6', completed: '#10B981',
  cancelled: '#EF4444', shipped: '#8B5CF6', delivered: '#10B981',
  on_hold: '#6B7280', refunded: '#EC4899', failed: '#EF4444', exchanged: '#8B5CF6',
};

/** Small component that fetches a signed invoice URL on demand and triggers download. */
function InvoiceDownloadButton({ orderId, hasInvoice }: { orderId: number; hasInvoice: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading, error } = trpc.orders.downloadInvoice.useQuery(
    { orderId },
    { enabled, retry: false }
  );

  useEffect(() => {
    if (!data?.url) return;
    const a = document.createElement('a');
    a.href = data.url;
    a.download = `invoice-${data.orderNumber || orderId}.pdf`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setEnabled(false);
  }, [data]);

  useEffect(() => {
    if (!error) return;
    toast.error((error as any).message || 'Invoice not available');
    setEnabled(false);
  }, [error]);

  if (!hasInvoice) {
    return <span className="text-[10px]" style={{ color: '#D4C9B8', fontFamily: 'Montserrat, sans-serif' }}>—</span>;
  }

  return (
    <button
      onClick={() => setEnabled(true)}
      disabled={isLoading || enabled}
      title="Download Invoice PDF"
      className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold tracking-wider uppercase border transition-colors disabled:opacity-40"
      style={{ borderColor: '#9D7D39', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
    >
      {isLoading || enabled ? <Loader2 size={10} className="animate-spin" /> : <FileDown size={10} />}
      PDF
    </button>
  );
}

/** Order detail modal — shows full order info, items, address, payment */
function OrderDetailModal({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { data, isLoading } = trpc.orders.byId.useQuery({ id: orderId });
  const resendMutation = trpc.orders.resendEmail.useMutation({
    onSuccess: () => toast.success('Confirmation email resent successfully'),
    onError: (err) => toast.error(err.message || 'Failed to resend email'),
  });

  // Expenses
  const utils = trpc.useUtils();
  const { data: expenses = [] } = trpc.expenses.listByOrder.useQuery({ orderId });
  const [expenseForm, setExpenseForm] = useState({ category: 'shipping_cost', description: '', amount: '' });
  const addExpenseMutation = trpc.expenses.add.useMutation({
    onSuccess: () => {
      utils.expenses.listByOrder.invalidate({ orderId });
      setExpenseForm({ category: 'shipping_cost', description: '', amount: '' });
      toast.success('Expense added');
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteExpenseMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => utils.expenses.listByOrder.invalidate({ orderId }),
    onError: (e) => toast.error(e.message),
  });

  // Gift Lines
  const [giftSearch, setGiftSearch] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const { data: giftSearchData } = trpc.products.list.useQuery(
    { search: giftSearch, limit: 8, offset: 0 },
    { enabled: giftSearch.length >= 2 }
  );
  const giftSearchResults = (giftSearchData as any)?.items ?? [];
  const addGiftMutation = trpc.orders.addGiftLine.useMutation({
    onSuccess: () => {
      utils.orders.byId.invalidate({ id: orderId });
      setGiftSearch('');
      setGiftNote('');
      toast.success('Gift line added');
    },
    onError: (e) => toast.error(e.message),
  });
  const removeGiftMutation = trpc.orders.removeOrderItem.useMutation({
    onSuccess: () => utils.orders.byId.invalidate({ id: orderId }),
    onError: (e) => toast.error(e.message),
  });

  // Exchange
  const [showExchange, setShowExchange] = useState(false);
  type ExchangeItem = { productId: number; variantId?: number; name: string; sku?: string; quantity: number; price: number };
  const [exchangeItems, setExchangeItems] = useState<ExchangeItem[]>([{ productId: 0, name: '', quantity: 1, price: 0 }]);
  const exchangeMutation = trpc.orders.exchange.useMutation({
    onSuccess: (res: { success: boolean; newOrderNumber: string }) => {
      utils.orders.byId.invalidate({ id: orderId });
      utils.orders.list.invalidate();
      setShowExchange(false);
      toast.success(`Exchange processed. New order: ${res.newOrderNumber}`);
    },
    onError: (e: { message: string }) => toast.error(e.message || 'Exchange failed'),
  });

  // Refund
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const refundMutation = trpc.orders.refund.useMutation({
    onSuccess: () => {
      utils.orders.byId.invalidate({ id: orderId });
      utils.orders.list.invalidate();
      setShowRefund(false);
      setRefundAmount('');
      setRefundNote('');
      toast.success('Refund processed successfully');
    },
    onError: (e) => toast.error(e.message || 'Refund failed'),
  });

  // E1: Internal notes
  const [showNotes, setShowNotes] = useState(false);
  const [internalNotesText, setInternalNotesText] = useState('');
  const updateNotesMutation = trpc.orders.updateInternalNotes.useMutation({
    onSuccess: () => {
      utils.orders.byId.invalidate({ id: orderId });
      setShowNotes(false);
      toast.success('Internal notes saved');
    },
    onError: (e) => toast.error(e.message),
  });

  // E2: Apply discount
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const applyDiscountMutation = trpc.orders.applyDiscount.useMutation({
    onSuccess: (res) => {
      utils.orders.byId.invalidate({ id: orderId });
      utils.orders.list.invalidate();
      setShowDiscount(false);
      setDiscountAmount('');
      setDiscountReason('');
      toast.success(`Discount applied. New total: ${res.newTotal.toFixed(3)} KWD`);
    },
    onError: (e) => toast.error(e.message),
  });

  const order = data?.order as any;
  const items = (data?.items ?? []) as any[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl" style={{ borderColor: '#E8E4DC' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E8E4DC' }}>
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
              Order Detail
            </p>
            <h2 className="text-2xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              {order ? `#${order.orderNumber}` : '...'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} style={{ color: '#8A8A82' }} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin" size={28} style={{ color: '#9D7D39' }} />
          </div>
        ) : order ? (
          <div className="px-6 py-4 space-y-6">
            {/* Status + meta row */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full"
                style={{
                  backgroundColor: `${STATUS_COLORS[order.status] || '#6B7280'}20`,
                  color: STATUS_COLORS[order.status] || '#6B7280',
                  fontFamily: 'Montserrat, sans-serif',
                }}>
                {order.status}
              </span>
              <span className="px-3 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full"
                style={{
                  backgroundColor: order.channel === 'online' ? '#3B82F620' : '#8B5CF620',
                  color: order.channel === 'online' ? '#3B82F6' : '#8B5CF6',
                  fontFamily: 'Montserrat, sans-serif',
                }}>
                {order.channel}
              </span>
              <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                {new Date(order.createdAt).toLocaleString()}
              </span>
            </div>

            {/* Customer info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#FAFAF8', border: '1px solid #E8E4DC' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Package size={14} style={{ color: '#9D7D39' }} />
                  <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Customer</span>
                </div>
                <p className="text-sm font-medium" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                  {order.guestName || order.customerName || '—'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                  {order.guestEmail || order.customerEmail || '—'}
                </p>
                {(order.guestPhone || order.customerPhone) && (
                  <p className="text-xs mt-0.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                    {order.guestPhone || order.customerPhone}
                  </p>
                )}
              </div>

              {order.shippingAddress && (
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#FAFAF8', border: '1px solid #E8E4DC' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={14} style={{ color: '#9D7D39' }} />
                    <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Shipping Address</span>
                  </div>
                  {(() => {
                    const addr = typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : order.shippingAddress;
                    return (
                      <div className="text-xs space-y-0.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {addr.address1 && <p>{addr.address1}</p>}
                        {addr.address2 && <p>{addr.address2}</p>}
                        {(addr.city || addr.state) && <p>{[addr.city, addr.state].filter(Boolean).join(', ')}</p>}
                        {addr.country && <p>{addr.country}</p>}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Payment info */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#FAFAF8', border: '1px solid #E8E4DC' }}>
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={14} style={{ color: '#9D7D39' }} />
                <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Payment</span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                <span>Method: <strong style={{ color: '#242424' }}>{order.paymentMethod || 'COD'}</strong></span>
                <span>Status: <strong style={{ color: STATUS_COLORS[order.paymentStatus] || '#242424' }}>{order.paymentStatus || 'pending'}</strong></span>
                {order.paymentReference && <span>Ref: <strong style={{ color: '#242424' }}>{order.paymentReference}</strong></span>}
              </div>
            </div>

            {/* Order items */}
            <div>
              <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                Items ({items.length})
              </p>
              <div className="space-y-2">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#F0EDE8' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                        {cleanName(item.name)}
                      </p>
                      {item.variantAttributes && (
                        <p className="text-[10px]" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                          {Object.values(item.variantAttributes as Record<string, string>).join(' / ')}
                        </p>
                      )}
                      {item.sku && (
                        <p className="text-[10px]" style={{ color: '#D4C9B8', fontFamily: 'Montserrat, sans-serif' }}>
                          SKU: {item.sku}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {item.quantity} × {parseFloat(String(item.unitPrice || 0)).toFixed(3)}
                      </p>
                      <p className="text-sm font-medium italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                        {parseFloat(String(item.totalPrice || 0)).toFixed(3)} KWD
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: '#E8E4DC' }}>
              <div className="flex justify-between text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                <span>Subtotal</span>
                <span>{parseFloat(String(order.subtotal || 0)).toFixed(3)} KWD</span>
              </div>
              {parseFloat(String(order.shippingCost || 0)) > 0 && (
                <div className="flex justify-between text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                  <span>Shipping</span>
                  <span>{parseFloat(String(order.shippingCost || 0)).toFixed(3)} KWD</span>
                </div>
              )}
              {parseFloat(String(order.discountAmount || 0)) > 0 && (
                <div className="flex justify-between text-xs" style={{ color: '#10B981', fontFamily: 'Montserrat, sans-serif' }}>
                  <span>Discount</span>
                  <span>−{parseFloat(String(order.discountAmount || 0)).toFixed(3)} KWD</span>
                </div>
              )}
              <div className="flex justify-between text-base font-medium pt-2 border-t" style={{ borderColor: '#E8E4DC', fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
                <span>Total</span>
                <span className="italic" style={{ color: '#9D7D39' }}>{parseFloat(String(order.total || 0)).toFixed(3)} KWD</span>
              </div>
            </div>

            {/* E1: Status Timeline */}
            <div className="pt-2 border-t" style={{ borderColor: '#E8E4DC' }}>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={12} style={{ color: '#9D7D39' }} />
                <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Status Timeline</p>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Order Placed', ts: order.createdAt, always: true },
                  { label: 'Payment Confirmed', ts: order.paidAt },
                  { label: 'Shipped', ts: order.shippedAt },
                  { label: 'Delivered', ts: order.deliveredAt },
                ].filter(e => e.always || e.ts).map((event, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: event.ts ? '#9D7D39' : '#E8E4DC' }} />
                    <span className="text-xs" style={{ color: event.ts ? '#242424' : '#D4C9B8', fontFamily: 'Montserrat, sans-serif' }}>
                      {event.label}
                    </span>
                    {event.ts && (
                      <span className="text-[10px] ml-auto" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {new Date(event.ts).toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="p-3 rounded" style={{ backgroundColor: '#FFF9F0', border: '1px solid #F0EDE8' }}>
                <p className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Customer Notes</p>
                <p className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{order.notes}</p>
              </div>
            )}

            {/* E1: Internal Notes */}
            <div className="pt-2 border-t" style={{ borderColor: '#E8E4DC' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StickyNote size={12} style={{ color: '#9D7D39' }} />
                  <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Internal Notes</p>
                </div>
                <button
                  onClick={() => { setInternalNotesText(order.internalNotes ?? ''); setShowNotes(!showNotes); }}
                  className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 border"
                  style={{ borderColor: '#9D7D39', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
                >
                  {showNotes ? 'Cancel' : 'Edit'}
                </button>
              </div>
              {!showNotes && order.internalNotes && (
                <p className="text-xs whitespace-pre-wrap" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{order.internalNotes}</p>
              )}
              {!showNotes && !order.internalNotes && (
                <p className="text-xs italic" style={{ color: '#D4C9B8', fontFamily: 'Montserrat, sans-serif' }}>No internal notes</p>
              )}
              {showNotes && (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={internalNotesText}
                    onChange={(e) => setInternalNotesText(e.target.value)}
                    placeholder="Internal notes (not visible to customer)"
                    className="block w-full text-xs border rounded px-2 py-1.5 outline-none resize-none"
                    style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                  />
                  <button
                    onClick={() => updateNotesMutation.mutate({ orderId: order.id, internalNotes: internalNotesText })}
                    disabled={updateNotesMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase disabled:opacity-40"
                    style={{ backgroundColor: '#9D7D39', color: '#fff', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {updateNotesMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <StickyNote size={10} />}
                    Save Notes
                  </button>
                </div>
              )}
            </div>

            {/* Expenses */}
            <div className="pt-2 border-t" style={{ borderColor: '#E8E4DC' }}>
              <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Order Expenses</p>
              {expenses.length > 0 && (
                <div className="space-y-1 mb-3">
                  {expenses.map((exp: any) => (
                    <div key={exp.id} className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: '#F0EDE8' }}>
                      <div>
                        <span className="font-medium" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>{exp.category.replace(/_/g, ' ')}</span>
                        {exp.description && <span className="ml-2" style={{ color: '#8A8A82' }}>{exp.description}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ color: '#9D7D39', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{parseFloat(String(exp.amount)).toFixed(3)} KWD</span>
                        <button onClick={() => deleteExpenseMutation.mutate({ id: exp.id })} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-medium pt-1" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                    <span>Total Expenses</span>
                    <span style={{ color: '#9D7D39', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                      {expenses.reduce((s: number, e: any) => s + parseFloat(String(e.amount)), 0).toFixed(3)} KWD
                    </span>
                  </div>
                </div>
              )}
              {/* Add expense form */}
              <div className="flex gap-2 mt-2">
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="text-xs border rounded px-2 py-1 flex-1"
                  style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                >
                  <option value="shipping_cost">Shipping Cost</option>
                  <option value="packaging">Packaging</option>
                  <option value="customs">Customs / Duties</option>
                  <option value="handling">Handling</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="Description"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="text-xs border rounded px-2 py-1 flex-1"
                  style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                />
                <input
                  type="number"
                  placeholder="Amount"
                  min="0"
                  step="0.001"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="text-xs border rounded px-2 py-1 w-24"
                  style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                />
                <button
                  onClick={() => addExpenseMutation.mutate({ orderId, category: expenseForm.category, description: expenseForm.description || undefined, amount: parseFloat(expenseForm.amount) || 0 })}
                  disabled={addExpenseMutation.isPending || !expenseForm.amount}
                  className="text-[10px] font-semibold tracking-wider uppercase px-3 py-1 border disabled:opacity-40"
                  style={{ borderColor: '#9D7D39', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Gift Lines */}
            <div className="pt-2 border-t" style={{ borderColor: '#E8E4DC' }}>
              <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Gift Lines</p>
              {/* Existing gift items */}
              {items.filter((i: any) => i.isGift).length > 0 && (
                <div className="space-y-1 mb-3">
                  {items.filter((i: any) => i.isGift).map((i: any) => (
                    <div key={i.id} className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: '#F0EDE8' }}>
                      <div>
                        <span className="font-medium" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>{cleanName(i.name)}</span>
                        {i.giftNote && <span className="ml-2 italic" style={{ color: '#8A8A82' }}>{i.giftNote}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ color: '#10B981', fontFamily: 'Montserrat, sans-serif' }}>FREE × {i.quantity}</span>
                        <button onClick={() => removeGiftMutation.mutate({ id: i.id })} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Add gift line form */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search product to gift (min 2 chars)..."
                    value={giftSearch}
                    onChange={(e) => setGiftSearch(e.target.value)}
                    className="text-xs border rounded px-2 py-1 w-full"
                    style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                  />
                  {giftSearchResults.length > 0 && giftSearch.length >= 2 && (
                    <div className="absolute z-10 w-full bg-white border shadow-lg rounded mt-1 max-h-40 overflow-y-auto" style={{ borderColor: '#E8E4DC' }}>
                      {giftSearchResults.map((p: any) => (
                        <button
                          key={p.id}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                          style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                          onClick={() => {
                            addGiftMutation.mutate({ orderId, productId: p.id, qty: 1, giftNote: giftNote || undefined });
                          }}
                        >
                          {p.images?.[0] && <img src={p.images[0]} alt="" className="w-6 h-6 object-cover rounded" />}
                          <span>{cleanName(p.name)}</span>
                          <span className="ml-auto" style={{ color: '#9D7D39' }}>FREE</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Gift note (optional)"
                  value={giftNote}
                  onChange={(e) => setGiftNote(e.target.value)}
                  className="text-xs border rounded px-2 py-1 w-full"
                  style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 pt-2 border-t" style={{ borderColor: '#E8E4DC' }}>
              <InvoiceDownloadButton orderId={order.id} hasInvoice={!!order.invoiceKey} />
              {/* E2: Apply Discount button */}
              {!['refunded', 'cancelled', 'failed'].includes(order.status) && (
                <button
                  onClick={() => { setDiscountAmount(''); setDiscountReason(''); setShowDiscount(!showDiscount); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors"
                  style={{ borderColor: '#F59E0B', color: '#F59E0B', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
                >
                  <Tag size={10} />
                  Apply Discount
                </button>
              )}
              <button
                onClick={() => resendMutation.mutate({ orderId: order.id })}
                disabled={resendMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors disabled:opacity-40"
                style={{ borderColor: '#3B82F6', color: '#3B82F6', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
              >
                {resendMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Mail size={10} />}
                Resend Email
              </button>
              {/* Exchange button — for eligible orders not already exchanged */}
              {['completed', 'processing', 'shipped', 'delivered'].includes(order.status) && order.status !== 'exchanged' && (
                <button
                  onClick={() => {
                    setExchangeItems([{ productId: 0, name: '', quantity: 1, price: 0 }]);
                    setShowExchange(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors"
                  style={{ borderColor: '#8B5CF6', color: '#8B5CF6', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
                >
                  <ArrowLeftRight size={10} />
                  Exchange
                </button>
              )}
              {order.status === 'exchanged' && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#8B5CF6', fontFamily: 'Montserrat, sans-serif' }}>
                  <ArrowLeftRight size={10} /> Exchanged
                </span>
              )}
              {/* Refund button — only for paid orders not already refunded */}
              {order.paymentStatus === 'paid' && order.status !== 'refunded' && (
                <button
                  onClick={() => {
                    setRefundAmount(parseFloat(String(order.total || 0)).toFixed(3));
                    setShowRefund(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors"
                  style={{ borderColor: '#EC4899', color: '#EC4899', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
                >
                  <CreditCard size={10} />
                  Refund
                </button>
              )}
              {order.status === 'refunded' && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase"
                  style={{ color: '#EC4899', fontFamily: 'Montserrat, sans-serif' }}
                >
                  <CreditCard size={10} />
                  {order.refundAmount ? `Refunded — ${parseFloat(String(order.refundAmount)).toFixed(3)} KWD` : 'Refunded'}
                </span>
              )}
            </div>
            {/* Refund panel */}
            {showRefund && (
              <div className="p-4 rounded-lg border mt-2" style={{ backgroundColor: '#FFF5F8', borderColor: '#EC4899' }}>
                <p className="text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: '#EC4899', fontFamily: 'Montserrat, sans-serif' }}>Process Refund</p>
                {/* Gateway info banner */}
                {order.channel === 'online' && order.paymentMethod === 'myfatoorah' && order.gatewayRef ? (
                  <div className="mb-3 px-3 py-2 rounded text-[10px]" style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', fontFamily: 'Montserrat, sans-serif' }}>
                    MyFatoorah refund will be processed automatically via gateway (Invoice #{order.gatewayRef})
                  </div>
                ) : order.channel === 'online' && order.paymentMethod === 'myfatoorah' && !order.gatewayRef ? (
                  <div className="mb-3 px-3 py-2 rounded text-[10px]" style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE047', color: '#854D0E', fontFamily: 'Montserrat, sans-serif' }}>
                    Warning: No gateway reference found. Order will be marked as refunded without a MyFatoorah API call.
                  </div>
                ) : (
                  <div className="mb-3 px-3 py-2 rounded text-[10px]" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0C4A6E', fontFamily: 'Montserrat, sans-serif' }}>
                    {order.channel === 'pos' ? 'POS order — will be marked as refunded (no gateway call).' : 'COD order — will be marked as refunded (no gateway call).'}
                  </div>
                )}
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Amount (KWD)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      max={parseFloat(String(order.total || 0))}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="block w-full mt-1 text-xs border rounded px-2 py-1.5 outline-none"
                      style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Note (optional)</label>
                    <input
                      type="text"
                      value={refundNote}
                      onChange={(e) => setRefundNote(e.target.value)}
                      placeholder="Reason for refund"
                      className="block w-full mt-1 text-xs border rounded px-2 py-1.5 outline-none"
                      style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        const amt = parseFloat(refundAmount);
                        if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
                        refundMutation.mutate({ orderId: order.id, amount: amt, note: refundNote || undefined });
                      }}
                      disabled={refundMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase transition-colors disabled:opacity-40"
                      style={{ backgroundColor: '#EC4899', color: '#fff', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {refundMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <CreditCard size={10} />}
                      Confirm Refund
                    </button>
                    <button
                      onClick={() => setShowRefund(false)}
                      className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors"
                      style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* E2: Apply Discount panel */}
            {showDiscount && (
              <div className="p-4 rounded-lg border mt-2" style={{ backgroundColor: '#FFFBEB', borderColor: '#F59E0B' }}>
                <p className="text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: '#F59E0B', fontFamily: 'Montserrat, sans-serif' }}>Apply Discount to Order</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Discount Amount (KWD)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      placeholder="e.g. 5.000"
                      className="block w-full mt-1 text-xs border rounded px-2 py-1.5 outline-none"
                      style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Reason (required)</label>
                    <input
                      type="text"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Reason for discount"
                      className="block w-full mt-1 text-xs border rounded px-2 py-1.5 outline-none"
                      style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        const amt = parseFloat(discountAmount);
                        if (!amt || amt <= 0) { toast.error('Enter a valid discount amount'); return; }
                        if (!discountReason.trim()) { toast.error('Reason is required'); return; }
                        applyDiscountMutation.mutate({ orderId: order.id, discountAmount: amt, reason: discountReason });
                      }}
                      disabled={applyDiscountMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase transition-colors disabled:opacity-40"
                      style={{ backgroundColor: '#F59E0B', color: '#fff', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {applyDiscountMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Tag size={10} />}
                      Apply Discount
                    </button>
                    <button
                      onClick={() => setShowDiscount(false)}
                      className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors"
                      style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Exchange panel */}
            {showExchange && (
              <div className="p-4 rounded-lg border mt-2" style={{ backgroundColor: '#F5F3FF', borderColor: '#8B5CF6' }}>
                <p className="text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: '#8B5CF6', fontFamily: 'Montserrat, sans-serif' }}>Process Exchange</p>
                <p className="text-[10px] mb-3" style={{ color: '#6B7280', fontFamily: 'Montserrat, sans-serif' }}>Original order items will be restocked. Enter the new items for the exchange order.</p>
                <div className="space-y-2">
                  {exchangeItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-end">
                      <div className="col-span-4">
                        {idx === 0 && <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Product Name</label>}
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => setExchangeItems(prev => prev.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))}
                          placeholder="Product name"
                          className="block w-full text-xs border rounded px-2 py-1.5 outline-none"
                          style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>SKU</label>}
                        <input
                          type="text"
                          value={item.sku || ''}
                          onChange={(e) => setExchangeItems(prev => prev.map((it, i) => i === idx ? { ...it, sku: e.target.value } : it))}
                          placeholder="SKU"
                          className="block w-full text-xs border rounded px-2 py-1.5 outline-none"
                          style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Qty</label>}
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => setExchangeItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 1 } : it))}
                          className="block w-full text-xs border rounded px-2 py-1.5 outline-none"
                          style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Price (KWD)</label>}
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.price}
                          onChange={(e) => setExchangeItems(prev => prev.map((it, i) => i === idx ? { ...it, price: parseFloat(e.target.value) || 0 } : it))}
                          className="block w-full text-xs border rounded px-2 py-1.5 outline-none"
                          style={{ borderColor: '#E8E4DC', color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                        />
                      </div>
                      <div className="col-span-2 flex gap-1">
                        {exchangeItems.length > 1 && (
                          <button
                            onClick={() => setExchangeItems(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded border transition-colors"
                            style={{ borderColor: '#EF4444', color: '#EF4444', backgroundColor: 'transparent' }}
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setExchangeItems(prev => [...prev, { productId: 0, name: '', quantity: 1, price: 0 }])}
                    className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase mt-1"
                    style={{ color: '#8B5CF6', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    <Plus size={10} /> Add Item
                  </button>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        const validItems = exchangeItems.filter(it => it.name.trim());
                        if (validItems.length === 0) { toast.error('Add at least one item with a name'); return; }
                        exchangeMutation.mutate({
                          originalOrderId: order.id,
                          newItems: validItems.map(it => ({ productId: it.productId || 0, variantId: it.variantId, name: it.name, sku: it.sku, quantity: it.quantity, price: it.price })),
                        });
                      }}
                      disabled={exchangeMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase transition-colors disabled:opacity-40"
                      style={{ backgroundColor: '#8B5CF6', color: '#fff', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {exchangeMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <ArrowLeftRight size={10} />}
                      Confirm Exchange
                    </button>
                    <button
                      onClick={() => setShowExchange(false)}
                      className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors"
                      style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-16 text-center text-sm" style={{ color: '#8A8A82' }}>Order not found</div>
        )}
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState<Record<number, string>>({});
  const [viewOrderId, setViewOrderId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.orders.list.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: 100,
  });

  // E5: CSV export
  const { refetch: exportCsv, isFetching: isExporting } = trpc.orders.exportCsv.useQuery(
    { status: statusFilter === 'all' ? undefined : statusFilter },
    { enabled: false }
  );
  const handleExportCsv = async () => {
    const result = await exportCsv();
    if (!result.data?.csv) return;
    const blob = new Blob([result.data.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Orders exported');
  };

  const updateMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      utils.orders.list.invalidate();
      setUpdatingId(null);
      toast.success('Order status updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const orders = data?.items || [];

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
              Manage
            </p>
            <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Orders
            </h1>
          </div>
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-colors disabled:opacity-40"
            style={{ borderColor: '#9D7D39', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
          >
            {isExporting ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
            Export CSV
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase border transition-all"
              style={{
                borderColor: statusFilter === s ? '#9D7D39' : '#E8E4DC',
                color: statusFilter === s ? '#9D7D39' : '#8A8A82',
                backgroundColor: statusFilter === s ? 'rgba(157,125,57,0.08)' : 'transparent',
                fontFamily: 'Montserrat, sans-serif',
              }}>
              {s}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin" size={28} style={{ color: '#9D7D39' }} />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ShoppingCart size={40} className="mb-4" style={{ color: '#D4C9B8' }} />
              <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                No orders found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #E8E4DC' }}>
                    {['Order #', 'Customer', 'Channel', 'Items', 'Total', 'Status', 'Date', 'Update Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                        style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order: any) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#F0EDE8' }}>
                      <td className="px-4 py-3 font-medium text-xs" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                        #{order.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        <div>{order.guestName || `Customer #${order.customerId || '—'}`}</div>
                        <div className="text-[10px]">{order.guestEmail || ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full"
                          style={{
                            backgroundColor: order.channel === 'online' ? '#3B82F620' : '#8B5CF620',
                            color: order.channel === 'online' ? '#3B82F6' : '#8B5CF6',
                            fontFamily: 'Montserrat, sans-serif',
                          }}>
                          {order.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-center" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {order.itemCount ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-medium italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                        {parseFloat(String(order.total || 0)).toFixed(3)} KWD
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full"
                          style={{
                            backgroundColor: `${STATUS_COLORS[order.status] || '#6B7280'}20`,
                            color: STATUS_COLORS[order.status] || '#6B7280',
                            fontFamily: 'Montserrat, sans-serif',
                          }}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <select
                              value={newStatus[order.id] || order.status}
                              onChange={(e) => setNewStatus({ ...newStatus, [order.id]: e.target.value })}
                              className="appearance-none pl-2 pr-6 py-1 text-[10px] border focus:border-[#9D7D39] outline-none bg-white"
                              style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                            >
                              {STATUSES.filter(s => s !== 'all').map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8A8A82' }} />
                          </div>
                          <button
                            onClick={() => {
                              const status = newStatus[order.id] || order.status;
                              if (status === order.status) return;
                              setUpdatingId(order.id);
                              updateMutation.mutate({ id: order.id, status: status as any });
                            }}
                            disabled={updatingId === order.id || (newStatus[order.id] || order.status) === order.status}
                            className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase transition-colors disabled:opacity-40"
                            style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
                          >
                            {updatingId === order.id ? '...' : 'Set'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {/* View order detail */}
                          <button
                            onClick={() => setViewOrderId(order.id)}
                            title="View order detail"
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold tracking-wider uppercase border transition-colors"
                            style={{ borderColor: '#242424', color: '#242424', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent' }}
                          >
                            <Eye size={10} />
                            View
                          </button>
                          {/* Invoice download */}
                          <InvoiceDownloadButton orderId={order.id} hasInvoice={!!order.invoiceKey} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Order detail modal */}
      {viewOrderId !== null && (
        <OrderDetailModal orderId={viewOrderId} onClose={() => setViewOrderId(null)} />
      )}
    </AdminLayout>
  );
}
