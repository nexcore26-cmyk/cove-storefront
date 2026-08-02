/**
 * Admin Dashboard — KPI overview, recent orders
 * Vendor role: shows vendor-specific KPIs and recent orders for their products
 */
import { ShoppingCart, Package, TrendingUp, Loader2, AlertCircle, Warehouse } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Link } from 'wouter';
const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  processing: '#3B82F6',
  completed: '#10B981',
  cancelled: '#EF4444',
  shipped: '#8B5CF6',
  delivered: '#10B981',
  on_hold: '#6B7280',
  refunded: '#EC4899',
  failed: '#EF4444',
};
function formatKwd(val: number) {
  return `${val.toFixed(3)} KWD`;
}

// ─── Vendor Dashboard View ────────────────────────────────────────────────────
function VendorDashboard() {
  const { data, isLoading } = trpc.vendors.vendorDashboard.useQuery();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin" size={32} style={{ color: '#9D7D39' }} />
      </div>
    );
  }
  const kpis = [
    { label: 'Total Orders', value: data?.totalOrders ?? '—', icon: ShoppingCart, color: '#9D7D39' },
    { label: 'Recent Revenue', value: data ? formatKwd(data.recentRevenue) : '—', icon: TrendingUp, color: '#10B981' },
    { label: 'Warehouses', value: data?.warehouseCount ?? '—', icon: Warehouse, color: '#3B82F6' },
    { label: 'Total Products', value: data?.totalProducts ?? '—', icon: Package, color: '#8B5CF6' },
  ];
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
          Overview
        </p>
        <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
          Dashboard
        </h1>
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg p-5 shadow-sm border" style={{ borderColor: '#E8E4DC' }}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                {kpi.label}
              </p>
              <kpi.icon size={16} style={{ color: kpi.color }} />
            </div>
            <p className="text-2xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>
      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E8E4DC' }}>
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
            Recent Orders
          </h2>
        </div>
        {!data?.recentOrders?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle size={32} className="mb-3" style={{ color: '#D4C9B8' }} />
            <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>No orders yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E4DC' }}>
                  {['Order', 'Item', 'Status', 'Sale Total', 'Your Payout', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                      style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order: any, idx: number) => (
                  <tr key={`${order.orderId}-${idx}`} className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#F0EDE8' }}>
                    <td className="px-4 py-3 font-medium" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                      #{order.orderNumber || order.orderId}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                      {order.itemName}
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
                    <td className="px-4 py-3 font-medium italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#8A8A82' }}>
                      {formatKwd(order.lineTotal)}
                    </td>
                    <td className="px-4 py-3 font-medium italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                      {formatKwd(order.vendorPayout)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                      {new Date(order.orderDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin Dashboard View ─────────────────────────────────────────────────────
function AdminDashboardView() {
  const { data: orders, isLoading: ordersLoading } = trpc.orders.list.useQuery({ limit: 10 });
  const { data: warehouses } = trpc.inventory.warehouses.useQuery();
  const { data: products } = trpc.products.list.useQuery({ limit: 1 });
  const recentOrders = orders?.items || [];
  const totalRevenue = recentOrders.reduce((sum: number, o: any) => sum + parseFloat(String(o.total || 0)), 0);
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
          Overview
        </p>
        <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
          Dashboard
        </h1>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Orders', value: orders?.total ?? '—', icon: ShoppingCart, color: '#9D7D39' },
          { label: 'Recent Revenue', value: `${totalRevenue.toFixed(3)} KWD`, icon: TrendingUp, color: '#10B981' },
          { label: 'Warehouses', value: warehouses?.length ?? '—', icon: Package, color: '#3B82F6' },
          { label: 'Total Products', value: products?.total ?? '—', icon: Package, color: '#8B5CF6' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg p-5 shadow-sm border" style={{ borderColor: '#E8E4DC' }}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                {kpi.label}
              </p>
              <kpi.icon size={16} style={{ color: kpi.color }} />
            </div>
            <p className="text-2xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E8E4DC' }}>
            <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
              Recent Orders
            </h2>
            <Link href="/admin/orders" className="text-xs hover:text-[#9D7D39] transition-colors" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              View All →
            </Link>
          </div>
          {ordersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin" size={24} style={{ color: '#9D7D39' }} />
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle size={32} className="mb-3" style={{ color: '#D4C9B8' }} />
              <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>No orders yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #E8E4DC' }}>
                    {['Order', 'Customer', 'Total', 'Status', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                        style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order: any) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#F0EDE8' }}>
                      <td className="px-4 py-3 font-medium" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                        #{order.orderNumber}
                      </td>
                      <td className="px-4 py-3" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {order.guestName || order.guestEmail || `Customer #${order.customerId || '—'}`}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  return (
    <AdminLayout>
      {(user as any)?.role === 'vendor' ? <VendorDashboard /> : <AdminDashboardView />}
    </AdminLayout>
  );
}
