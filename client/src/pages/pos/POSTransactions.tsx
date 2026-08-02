/**
 * B4 — POS Transactions: payment ledger
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreditCard, ArrowDownLeft } from "lucide-react";

const PAYMENT_LABELS: Record<string, string> = {
  knet: "KNET",
  visa: "Visa/MC",
  cash: "Cash",
  other: "Other",
};

const PAYMENT_COLORS: Record<string, string> = {
  knet: "bg-blue-100 text-blue-700",
  visa: "bg-purple-100 text-purple-700",
  cash: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-700",
};

export default function POSTransactions() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = trpc.pos.transactions.useQuery({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit,
    offset: page * limit,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const todayTotal = data?.todayTotal ?? 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold">Transactions</h1>
            <p className="text-sm text-muted-foreground">
              Today's total: <span className="font-semibold text-green-700">{todayTotal.toFixed(3)} KWD</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{total} transactions</span>
          </div>
        </div>
        {/* Date filter */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">From</label>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">To</label>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} />
          </div>
          {(dateFrom || dateTo) && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}>
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <CreditCard className="w-10 h-10 mb-2" />
            <p>No transactions found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Order</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Method</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const amount = parseFloat(String(row.total));
                const refund = parseFloat(String(row.refundAmount ?? 0));
                const isRefunded = refund > 0;
                return (
                  <tr key={row.id} className={`hover:bg-gray-50 ${isRefunded ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{row.orderNumber}</p>
                      {row.paymentReference && (
                        <p className="text-xs text-muted-foreground">{row.paymentReference}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[row.paymentMethod ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
                        {PAYMENT_LABELS[row.paymentMethod ?? ""] ?? row.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <p className={`font-bold ${isRefunded ? "line-through text-muted-foreground" : "text-green-700"}`}>
                        {amount.toFixed(3)} KWD
                      </p>
                      {isRefunded && (
                        <p className="text-xs text-red-600 flex items-center justify-end gap-1">
                          <ArrowDownLeft className="w-3 h-3" />
                          -{refund.toFixed(3)} KWD
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="p-3 border-t flex items-center justify-between text-sm bg-white">
          <span className="text-muted-foreground">{total} total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
