/**
 * Admin Analytics — Revenue, orders, top products, channel breakdown
 * Design: Obsidian Editorial
 * Charts: Recharts (AreaChart for revenue over time, BarChart for status breakdown)
 */
import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { TrendingUp, ShoppingCart, Package, BarChart2, Loader2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';

const DAYS_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: 'All Time', value: undefined as number | undefined },
];

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

const CHANNEL_COLORS: Record<string, string> = {
  online: '#9D7D39',
  pos: '#3B82F6',
  legacy: '#7C3AED',
};

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border" style={{ borderColor: '#E8E4DC' }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
          {label}
        </p>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-2xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
        {value}
      </p>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg px-4 py-3 shadow-lg" style={{ borderColor: '#E8E4DC' }}>
      <p className="text-[10px] font-semibold tracking-wider uppercase mb-2" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
        {label}
      </p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-sm font-medium" style={{ color: p.color || '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
          {p.name === 'revenue' ? `${Number(p.value).toFixed(3)} KWD` : `${p.value} orders`}
        </p>
      ))}
    </div>
  );
}

export default function AdminAnalytics() {
  const [selectedDays, setSelectedDays] = useState<number | undefined>(30);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'count'>('revenue');

  const { data: summary, isLoading: summaryLoading } = trpc.analytics.summary.useQuery(
    selectedDays !== undefined ? { days: selectedDays } : {},
    { refetchOnWindowFocus: false }
  );

  const { data: chartData, isLoading: chartLoading } = trpc.analytics.revenueByDay.useQuery(
    { days: selectedDays ?? 30 },
    { refetchOnWindowFocus: false }
  );

  const { data: vendorPayables = [] } = trpc.analytics.vendorPayables.useQuery(
    selectedDays !== undefined ? { days: selectedDays } : {},
    { refetchOnWindowFocus: false }
  );

  const formattedChartData = useMemo(() => {
    if (!chartData) return [];
    return chartData.map(d => ({
      ...d,
      day: new Date(d.day).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    }));
  }, [chartData]);

  const isLoading = summaryLoading || chartLoading;

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
              Reporting
            </p>
            <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Analytics
            </h1>
          </div>

          {/* Date range selector */}
          <div className="flex items-center gap-1 bg-white border rounded-lg p-1 shadow-sm" style={{ borderColor: '#E8E4DC' }}>
            {DAYS_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setSelectedDays(opt.value)}
                className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase rounded transition-all"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  backgroundColor: selectedDays === opt.value ? '#242424' : 'transparent',
                  color: selectedDays === opt.value ? '#FAFAF8' : '#8A8A82',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin" size={32} style={{ color: '#9D7D39' }} />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <KpiCard
                label="Total Revenue"
                value={`${(summary?.totalRevenue ?? 0).toFixed(3)} KWD`}
                icon={TrendingUp}
                color="#9D7D39"
              />
              <KpiCard
                label="Total Orders"
                value={String(summary?.orderCount ?? 0)}
                icon={ShoppingCart}
                color="#3B82F6"
              />
              <KpiCard
                label="Avg Order Value"
                value={`${(summary?.avgOrderValue ?? 0).toFixed(3)} KWD`}
                icon={BarChart2}
                color="#8B5CF6"
              />
              <KpiCard
                label="Top Product"
                value={summary?.topProducts?.[0]?.name?.slice(0, 18) || '—'}
                icon={Package}
                color="#10B981"
              />
            </div>
            {/* Profit KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KpiCard
                label="Gross Profit"
                value={`${((summary as any)?.grossProfit ?? 0).toFixed(3)} KWD`}
                icon={TrendingUp}
                color="#059669"
              />
              <KpiCard
                label="Net Profit"
                value={`${((summary as any)?.netProfit ?? 0).toFixed(3)} KWD`}
                icon={TrendingUp}
                color={(summary as any)?.netProfit >= 0 ? '#10B981' : '#EF4444'}
              />
              <KpiCard
                label="Total COGS"
                value={`${((summary as any)?.totalCogs ?? 0).toFixed(3)} KWD`}
                icon={Package}
                color="#F59E0B"
              />
              <KpiCard
                label="Total Expenses"
                value={`${((summary as any)?.totalExpenses ?? 0).toFixed(3)} KWD`}
                icon={BarChart2}
                color="#EF4444"
              />
            </div>

            {/* Revenue Chart */}
            <div className="bg-white rounded-lg shadow-sm border mb-6 overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E8E4DC' }}>
                <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                  {chartMetric === 'revenue' ? 'Revenue Over Time' : 'Orders Over Time'}
                </h2>
                <div className="flex items-center gap-1 bg-gray-50 border rounded p-0.5" style={{ borderColor: '#E8E4DC' }}>
                  {(['revenue', 'count'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setChartMetric(m)}
                      className="px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase rounded transition-all"
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        backgroundColor: chartMetric === m ? '#9D7D39' : 'transparent',
                        color: chartMetric === m ? '#FAFAF8' : '#8A8A82',
                      }}
                    >
                      {m === 'revenue' ? 'Revenue' : 'Orders'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4" style={{ height: 280 }}>
                {formattedChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>No data for this period</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={formattedChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#9D7D39" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#9D7D39" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fontFamily: 'Montserrat, sans-serif', fill: '#8A8A82' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fontFamily: 'Montserrat, sans-serif', fill: '#8A8A82' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => chartMetric === 'revenue' ? `${v.toFixed(0)}` : String(v)}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey={chartMetric}
                        stroke="#9D7D39"
                        strokeWidth={2}
                        fill="url(#goldGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#9D7D39' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Bottom row: Top Products + Status Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products */}
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
                <div className="px-6 py-4 border-b" style={{ borderColor: '#E8E4DC' }}>
                  <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                    Top Products by Revenue
                  </h2>
                </div>
                {!summary?.topProducts?.length ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>No product data yet</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: '#F0EDE8' }}>
                    {summary.topProducts.map((p, i) => (
                      <div key={p.productId || i} className="flex items-center gap-4 px-5 py-3">
                        <span
                          className="w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: i === 0 ? '#9D7D39' : '#F0EDE8',
                            color: i === 0 ? '#FAFAF8' : '#8A8A82',
                            fontFamily: 'Montserrat, sans-serif',
                          }}
                        >
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                            {p.name || `Product #${p.productId}`}
                          </p>
                          <p className="text-[10px]" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            {p.qty} units sold
                          </p>
                        </div>
                        <span className="text-sm font-medium italic flex-shrink-0" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                          {p.revenue.toFixed(3)} KWD
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Status Breakdown */}
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
                <div className="px-6 py-4 border-b" style={{ borderColor: '#E8E4DC' }}>
                  <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                    Orders by Status
                  </h2>
                </div>
                {!summary?.byStatus?.length ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>No order data yet</p>
                  </div>
                ) : (
                  <div className="p-4" style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summary.byStatus} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                        <XAxis
                          dataKey="status"
                          tick={{ fontSize: 9, fontFamily: 'Montserrat, sans-serif', fill: '#8A8A82' }}
                          tickLine={false}
                          axisLine={false}
                          angle={-30}
                          textAnchor="end"
                        />
                        <YAxis
                          tick={{ fontSize: 9, fontFamily: 'Montserrat, sans-serif', fill: '#8A8A82' }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          formatter={(v: any, name: string) => [v, name === 'count' ? 'Orders' : name]}
                          contentStyle={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, borderColor: '#E8E4DC' }}
                        />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          {summary.byStatus.map((entry, index) => (
                            <Cell key={index} fill={STATUS_COLORS[entry.status] || '#9D7D39'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Channel breakdown */}
                {summary?.byChannel && summary.byChannel.length > 0 && (
                  <div className="px-5 pb-4 border-t pt-4" style={{ borderColor: '#F0EDE8' }}>
                    <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                      By Channel
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {summary.byChannel.map(ch => (
                        <div key={ch.channel} className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: CHANNEL_COLORS[ch.channel || ''] || '#9D7D39' }}
                          />
                          <span className="text-xs capitalize" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                            {ch.channel || 'unknown'}: <strong>{ch.count}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Vendor Payables */}
            {vendorPayables.length > 0 && (
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: '#E8E4DC' }}>
                  <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>Vendor Payables</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Commission owed to vendors on completed orders</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b" style={{ borderColor: '#F0EDE8', backgroundColor: '#FAFAF8' }}>
                        <th className="text-left px-4 py-2 font-semibold tracking-wider uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', fontSize: '9px' }}>Vendor</th>
                        <th className="text-right px-4 py-2 font-semibold tracking-wider uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', fontSize: '9px' }}>Items Sold</th>
                        <th className="text-right px-4 py-2 font-semibold tracking-wider uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', fontSize: '9px' }}>Total Sales</th>
                        <th className="text-right px-4 py-2 font-semibold tracking-wider uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', fontSize: '9px' }}>Commission Owed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(vendorPayables as any[]).map((v: any) => (
                        <tr key={v.vendorId} className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#F0EDE8' }}>
                          <td className="px-4 py-2.5" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>
                            <div className="font-medium">{v.vendorName}</div>
                            {v.email && <div className="text-[10px]" style={{ color: '#8A8A82' }}>{v.email}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-right" style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}>{v.itemCount}</td>
                          <td className="px-4 py-2.5 text-right" style={{ color: '#242424', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{v.totalSales.toFixed(3)} KWD</td>
                          <td className="px-4 py-2.5 text-right font-semibold" style={{ color: '#9D7D39', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{v.commissionOwed.toFixed(3)} KWD</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
                        <td colSpan={3} className="px-4 py-2 text-right text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Total Commission Owed</td>
                        <td className="px-4 py-2 text-right font-semibold" style={{ color: '#9D7D39', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                          {(vendorPayables as any[]).reduce((s: number, v: any) => s + v.commissionOwed, 0).toFixed(3)} KWD
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
