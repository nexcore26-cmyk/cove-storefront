/**
 * B5 — POS Report: sales by payment method and seller
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { TrendingUp, Users, Tag, ArrowDownLeft } from "lucide-react";

const METHOD_COLORS: Record<string, string> = {
  knet: "#3b82f6",
  visa: "#8b5cf6",
  cash: "#22c55e",
  other: "#94a3b8",
};

const METHOD_LABELS: Record<string, string> = {
  knet: "KNET",
  visa: "Visa/MC",
  cash: "Cash",
  other: "Other",
};

export default function POSReport() {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const { data, isLoading } = trpc.pos.report.useQuery({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const byMethod = data?.byPaymentMethod ?? [];
  const bySeller = data?.bySeller ?? [];
  const totalDiscount = data?.totalDiscount ?? 0;
  const totalRefund = data?.totalRefund ?? 0;
  const grandTotal = byMethod.reduce((s, r) => s + r.sales, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sales Report</h1>
        <div className="flex items-center gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">From</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">To</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => { setDateFrom(today); setDateTo(today); }}>
              Today
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gross Sales</p>
              </div>
              <p className="text-2xl font-bold text-green-700">{grandTotal.toFixed(3)} KWD</p>
              <p className="text-xs text-muted-foreground mt-1">
                {byMethod.reduce((s, r) => s + r.count, 0)} orders
              </p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-orange-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Discounts</p>
              </div>
              <p className="text-2xl font-bold text-orange-600">-{totalDiscount.toFixed(3)} KWD</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownLeft className="w-4 h-4 text-red-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Refunds</p>
              </div>
              <p className="text-2xl font-bold text-red-600">-{totalRefund.toFixed(3)} KWD</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Net Sales</p>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {Math.max(0, grandTotal - totalDiscount - totalRefund).toFixed(3)} KWD
              </p>
            </div>
          </div>

          {/* By payment method */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Sales by Payment Method
            </h2>
            {byMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data for this period</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byMethod.map(r => ({ ...r, label: METHOD_LABELS[r.method] ?? r.method }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={v => v.toFixed(0)} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(3)} KWD`, "Sales"]} />
                    <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                      {byMethod.map((r, i) => (
                        <Cell key={i} fill={METHOD_COLORS[r.method] ?? "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {byMethod.map((r) => (
                    <div key={r.method} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: METHOD_COLORS[r.method] ?? "#94a3b8" }}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{METHOD_LABELS[r.method] ?? r.method}</span>
                          <span className="font-bold text-green-700">{r.sales.toFixed(3)} KWD</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{r.count} orders</span>
                          {r.refund > 0 && <span className="text-red-500">-{r.refund.toFixed(3)} refunded</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* By seller */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Sales by Cashier
            </h2>
            {bySeller.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data for this period</p>
            ) : (
              <div className="space-y-3">
                {bySeller.sort((a, b) => b.sales - a.sales).map((seller, i) => {
                  const pct = grandTotal > 0 ? (seller.sales / grandTotal) * 100 : 0;
                  return (
                    <div key={seller.userId ?? i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{seller.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{seller.count} orders</span>
                          <span className="font-bold text-green-700">{seller.sales.toFixed(3)} KWD</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
