import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, TrendingUp, ShoppingCart, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminSalesReport() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const { user } = useAuth();
  const isVendor = (user as any)?.role === 'vendor';
  const vendorId = isVendor ? (user as any)?.vendorId as number : undefined;
  const [queryInput, setQueryInput] = useState({ from: thirtyDaysAgo, to: today });

  const { data, isLoading } = trpc.analytics.salesReport.useQuery({ ...queryInput, vendorId });

  const handleApply = () => setQueryInput({ from, to });

  const handleExportByDate = () => {
    if (!data) return;
    exportCSV('sales-by-date.csv', ['Date', 'Revenue (KWD)', 'Orders'],
      data.byDate.map(r => [r.date, r.revenue.toFixed(3), r.orders]));
  };
  const handleExportByProduct = () => {
    if (!data) return;
    exportCSV('sales-by-product.csv', ['Product', 'Qty Sold', 'Revenue (KWD)'],
      data.byProduct.map(r => [r.name, r.qty, r.revenue.toFixed(3)]));
  };
  const handleExportByCategory = () => {
    if (!data) return;
    exportCSV('sales-by-category.csv', ['Category', 'Qty Sold', 'Revenue (KWD)'],
      data.byCategory.map(r => [r.name, r.qty, r.revenue.toFixed(3)]));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Sales Report</h1>
      </div>

      {/* Date filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={handleApply} size="sm" style={{ backgroundColor: '#9D7D39', color: 'white' }}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={32} style={{ color: '#9D7D39' }} /></div>
      ) : data ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Revenue</p>
                <p className="text-2xl font-bold" style={{ color: '#9D7D39' }}>{data.totals.revenue.toFixed(3)} <span className="text-sm font-normal">KWD</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Orders</p>
                <p className="text-2xl font-bold">{data.totals.orders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Avg Order Value</p>
                <p className="text-2xl font-bold">{data.totals.orders > 0 ? (data.totals.revenue / data.totals.orders).toFixed(3) : '0.000'} <span className="text-sm font-normal">KWD</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by day chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Revenue by Day</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportByDate}><Download size={14} className="mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              {data.byDate.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.byDate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(3)} KWD`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#9D7D39" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* By Category */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Revenue by Category</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportByCategory}><Download size={14} className="mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              {data.byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              ) : (
                <div className="space-y-2">
                  {data.byCategory.map((row, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="truncate font-medium">{row.name}</span>
                          <span className="text-muted-foreground ml-2 shrink-0">{row.revenue.toFixed(3)} KWD</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${data.byCategory[0].revenue > 0 ? (row.revenue / data.byCategory[0].revenue) * 100 : 0}%`, backgroundColor: '#9D7D39' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Product */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Top Products (by Revenue)</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportByProduct}><Download size={14} className="mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              {data.byProduct.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">#</th>
                        <th className="pb-2 font-medium">Product</th>
                        <th className="pb-2 font-medium text-right">Qty</th>
                        <th className="pb-2 font-medium text-right">Revenue (KWD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byProduct.map((row, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 text-muted-foreground">{i + 1}</td>
                          <td className="py-2 font-medium max-w-xs truncate">{row.name}</td>
                          <td className="py-2 text-right">{row.qty}</td>
                          <td className="py-2 text-right font-semibold" style={{ color: '#9D7D39' }}>{row.revenue.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
