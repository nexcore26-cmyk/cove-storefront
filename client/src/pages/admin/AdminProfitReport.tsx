import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold" style={{ color: color || 'inherit' }}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminProfitReport() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [queryInput, setQueryInput] = useState({ from: thirtyDaysAgo, to: today });

  const { data, isLoading } = trpc.analytics.profitReport.useQuery(queryInput);

  const handleApply = () => setQueryInput({ from, to });

  const handleExport = () => {
    if (!data) return;
    exportCSV('profit-report.csv',
      ['Date', 'Revenue (KWD)', 'COG (KWD)', 'Gross Profit (KWD)'],
      data.byDate.map(r => [r.date, r.revenue.toFixed(3), r.cog.toFixed(3), r.grossProfit.toFixed(3)]));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Profit Report</h1>
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
            <Button onClick={handleApply} size="sm" style={{ backgroundColor: '#9D7D39', color: 'white' }}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={32} style={{ color: '#9D7D39' }} /></div>
      ) : data ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard label="Revenue" value={`${data.totals.revenue.toFixed(3)} KWD`} color="#9D7D39" />
            <KPICard label="Cost of Goods" value={`${data.totals.cog.toFixed(3)} KWD`} color="#6B7280" />
            <KPICard label="Expenses" value={`${data.totals.expenses.toFixed(3)} KWD`} color="#6B7280" />
            <KPICard
              label="Gross Profit"
              value={`${data.totals.grossProfit.toFixed(3)} KWD`}
              sub={`Margin: ${data.totals.grossMarginPct.toFixed(1)}%`}
              color={data.totals.grossProfit >= 0 ? '#16A34A' : '#DC2626'}
            />
            <KPICard
              label="Net Profit"
              value={`${data.totals.netProfit.toFixed(3)} KWD`}
              color={data.totals.netProfit >= 0 ? '#16A34A' : '#DC2626'}
            />
          </div>

          {/* Gross margin indicator */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Gross Margin</p>
                <p className="text-sm font-bold" style={{ color: data.totals.grossMarginPct >= 30 ? '#16A34A' : data.totals.grossMarginPct >= 15 ? '#D97706' : '#DC2626' }}>
                  {data.totals.grossMarginPct.toFixed(1)}%
                </p>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, data.totals.grossMarginPct))}%`,
                    backgroundColor: data.totals.grossMarginPct >= 30 ? '#16A34A' : data.totals.grossMarginPct >= 15 ? '#D97706' : '#DC2626'
                  }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span className="text-amber-600">15% (fair)</span>
                <span className="text-green-600">30%+ (healthy)</span>
                <span>100%</span>
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Revenue vs Cost of Goods by Day</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExport}><Download size={14} className="mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              {data.byDate.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.byDate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(3)} KWD`} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#9D7D39" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cog" name="Cost of Goods" fill="#D1D5DB" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="grossProfit" name="Gross Profit" fill="#16A34A" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Daily breakdown table */}
          {data.byDate.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium text-right">Revenue</th>
                        <th className="px-4 py-3 font-medium text-right">COG</th>
                        <th className="px-4 py-3 font-medium text-right">Gross Profit</th>
                        <th className="px-4 py-3 font-medium text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byDate.map((row, i: number) => {
                        const margin = row.revenue > 0 ? (row.grossProfit / row.revenue) * 100 : 0;
                        return (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-mono text-xs">{row.date}</td>
                            <td className="px-4 py-2.5 text-right" style={{ color: '#9D7D39' }}>{row.revenue.toFixed(3)}</td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">{row.cog.toFixed(3)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold" style={{ color: row.grossProfit >= 0 ? '#16A34A' : '#DC2626' }}>{row.grossProfit.toFixed(3)}</td>
                            <td className="px-4 py-2.5 text-right text-xs" style={{ color: margin >= 30 ? '#16A34A' : margin >= 15 ? '#D97706' : '#DC2626' }}>{margin.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
