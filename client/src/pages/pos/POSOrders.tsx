/**
 * B3 — POS Orders: list of POS orders with detail view
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer, Search, ChevronRight, Package, User, CreditCard } from "lucide-react";
import { toast } from "sonner";

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

export default function POSOrders() {
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 30;

  const { data, isLoading } = trpc.pos.allOrders.useQuery({ limit, offset: page * limit });
  const { data: detail } = trpc.pos.orderDetail.useQuery(
    { orderId: selectedOrderId! },
    { enabled: !!selectedOrderId }
  );

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;

  const filtered = search
    ? orders.filter(o =>
        o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
        (o.customerName ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  const handlePrint = () => {
    if (!detail) return;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) { toast.error("Popup blocked — allow popups to print"); return; }
    const items = (detail.items ?? []).map((i: any) =>
      `<tr><td>${i.name}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${parseFloat(String(i.totalPrice)).toFixed(3)}</td></tr>`
    ).join("");
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>body{font-family:monospace;font-size:12px;width:300px;margin:0 auto}
      table{width:100%;border-collapse:collapse}td{padding:2px 4px}
      .total{font-weight:bold;font-size:14px}.divider{border-top:1px dashed #000;margin:6px 0}</style>
      </head><body>
      <div style="text-align:center;font-weight:bold;font-size:14px">${detail.orderNumber}</div>
      <div style="text-align:center;font-size:11px">${new Date(detail.createdAt).toLocaleString()}</div>
      <div class="divider"></div>
      <table><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th>Total</th></tr></thead>
      <tbody>${items}</tbody></table>
      <div class="divider"></div>
      ${parseFloat(String(detail.discountAmount ?? 0)) > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${parseFloat(String(detail.discountAmount)).toFixed(3)} KWD</span></div>` : ""}
      <div class="total" style="display:flex;justify-content:space-between"><span>TOTAL</span><span>${parseFloat(String(detail.total)).toFixed(3)} KWD</span></div>
      <div style="text-align:center;margin-top:12px;font-size:11px">Payment: ${PAYMENT_LABELS[detail.paymentMethod ?? ""] ?? detail.paymentMethod}</div>
      <div style="text-align:center;margin-top:8px;font-size:10px">Thank you!</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Orders list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-white">
          <h1 className="text-lg font-bold mb-3">POS Orders</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search order number or customer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Package className="w-10 h-10 mb-2" />
              <p>No orders found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((order) => {
                const orderTotal = parseFloat(String(order.total));
                const isSelected = selectedOrderId === order.id;
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${isSelected ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{order.orderNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[order.paymentMethod ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
                          {PAYMENT_LABELS[order.paymentMethod ?? ""] ?? order.paymentMethod}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {order.customerName && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />{order.customerName}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-green-700">{orderTotal.toFixed(3)} KWD</p>
                      <p className="text-xs text-muted-foreground">{order.cashierName}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="p-3 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{total} total orders</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Order detail panel */}
      {selectedOrderId && detail && (
        <div className="w-80 border-l bg-white flex flex-col overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-bold">{detail.orderNumber}</h2>
              <p className="text-xs text-muted-foreground">{new Date(detail.createdAt).toLocaleString()}</p>
            </div>
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" />
              Print
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Customer */}
            {detail.customerName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{detail.customerName}</span>
                {detail.customerPhone && <span className="text-muted-foreground">{detail.customerPhone}</span>}
              </div>
            )}

            {/* Payment */}
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span>{PAYMENT_LABELS[detail.paymentMethod ?? ""] ?? detail.paymentMethod}</span>
              {detail.paymentReference && <span className="text-muted-foreground text-xs">{detail.paymentReference}</span>}
            </div>

            {/* Cashier */}
            <div className="text-xs text-muted-foreground">Cashier: {detail.cashierName}</div>

            {/* Items */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Items</p>
              {(detail.items ?? []).map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                    <p className="font-medium">{parseFloat(String(item.totalPrice)).toFixed(3)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{parseFloat(String(detail.subtotal)).toFixed(3)} KWD</span>
              </div>
              {parseFloat(String(detail.discountAmount ?? 0)) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>-{parseFloat(String(detail.discountAmount)).toFixed(3)} KWD</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-green-700">{parseFloat(String(detail.total)).toFixed(3)} KWD</span>
              </div>
            </div>

            {/* Refund info */}
            {detail.refundAmount && parseFloat(String(detail.refundAmount)) > 0 && (
              <div className="bg-red-50 rounded-lg p-3 text-sm">
                <p className="font-semibold text-red-700">Refunded</p>
                <p className="text-red-600">{parseFloat(String(detail.refundAmount)).toFixed(3)} KWD</p>
                {detail.refundedAt && <p className="text-xs text-muted-foreground">{new Date(detail.refundedAt).toLocaleString()}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
