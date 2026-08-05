/**
 * POS — Point of Sale interface
 *
 * Multi-screen layout with left icon sidebar:
 *  Board        (B1) — cashier dashboard with stats + hourly chart
 *  Sell               — product grid + cart (main sell screen)
 *  Saved Carts  (B2) — save/resume carts
 *  Orders       (B3) — POS orders list + detail
 *  Transactions (B4) — payment ledger
 *  Report       (B5) — sales by method / seller
 *  Settings     (B6) — terminal name, hours, receipt
 *
 *  Sell screen features:
 *  B7 — Print receipt after sale
 *  B8 — Discount modal (cart-level, amount or percent)
 *  B9 — Barcode scanner (Enter key triggers search)
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cleanName } from "@/lib/cleanName";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  Search,
  Trash2,
  ChevronLeft,
  Plus,
  Minus,
  CreditCard,
  X,
  CheckCircle2,
  Package,
  Truck,
  StickyNote,
  Loader2,
  Lock,
  LayoutDashboard,
  ShoppingBag,
  BookmarkCheck,
  ClipboardList,
  BarChart3,
  Settings,
  Printer,
  Percent,
  Scan,
} from "lucide-react";
import { toast } from "sonner";
import POSBoard from "./pos/POSBoard";
import POSSavedCarts from "./pos/POSSavedCarts";
import POSOrders from "./pos/POSOrders";
import POSTransactions from "./pos/POSTransactions";
import POSReport from "./pos/POSReport";
import POSSettings from "./pos/POSSettings";

// ─── Types ────────────────────────────────────────────────────────────────────

type MeasurementType = "unit" | "meter" | "kg" | "roll" | "box";

interface CartItem {
  productId: number;
  variantId?: number;
  name: string;
  sku?: string;
  quantity: number;
  qtyValue: number;
  measurementType: MeasurementType;
  unitPrice: number;
  variantAttributes?: Record<string, string>;
  variantLabel?: string;
}

interface PosProduct {
  id: number;
  name: string;
  sku: string | null;
  type: "simple" | "variable" | "grouped";
  price: string;
  salePrice: string | null;
  images: string[];
  posStock: number | null;
  categoryId: number | null;
  measurementType: MeasurementType;
}

type Screen = "board" | "sell" | "savedCarts" | "orders" | "transactions" | "report" | "settings";

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Screen; icon: React.ElementType; label: string }[] = [
  { id: "board", icon: LayoutDashboard, label: "Board" },
  { id: "sell", icon: ShoppingBag, label: "Sell" },
  { id: "savedCarts", icon: BookmarkCheck, label: "Saved" },
  { id: "orders", icon: ClipboardList, label: "Orders" },
  { id: "transactions", icon: CreditCard, label: "Trans." },
  { id: "report", icon: BarChart3, label: "Report" },
  { id: "settings", icon: Settings, label: "Settings" },
];

function Sidebar({
  screen,
  onNavigate,
  cartCount,
}: {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  cartCount: number;
}) {
  const { user } = useAuth();
  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-3 gap-1 shrink-0">
      {/* Logo */}
      <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center mb-2 shrink-0">
        <ShoppingBag className="w-5 h-5 text-white" />
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          title={label}
          className={`relative w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
            screen === id
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          <Icon className="w-5 h-5" />
          <span className="text-[9px] font-medium leading-none">{label}</span>
          {id === "sell" && cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar */}
      <div
        title={user?.name ?? "Staff"}
        className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold shrink-0"
      >
        {(user?.name ?? "S").charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

// ─── Numpad ───────────────────────────────────────────────────────────────────

function Numpad({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const handleKey = (key: string) => {
    if (key === "clear") { onChange(0); return; }
    if (key === "backspace") { onChange(Math.floor(value / 10)); return; }
    const next = value * 10 + parseInt(key);
    if (next <= 999) onChange(next);
  };
  const keys = ["1","2","3","4","5","6","7","8","9","0","backspace","clear"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map(k => (
        <button
          key={k}
          onClick={() => handleKey(k)}
          className={`h-14 rounded-lg text-lg font-semibold transition-colors ${
            k === "clear"
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : k === "backspace"
              ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
              : "bg-blue-50 text-blue-900 hover:bg-blue-100"
          }`}
        >
          {k === "backspace" ? "⌫" : k === "clear" ? "✕" : k}
        </button>
      ))}
    </div>
  );
}

// ─── Variation Picker Modal ───────────────────────────────────────────────────

function VariationModal({
  product,
  open,
  onClose,
  onAddToCart,
}: {
  product: PosProduct | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}) {
  const [qty, setQty] = useState(1);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});

  const { data: variants = [] } = trpc.pos.variants.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: open && !!product && product.type === "variable" }
  );

  useEffect(() => {
    if (open) { setQty(1); setSelectedAttrs({}); }
  }, [open, product?.id]);

  const attrMap = new Map<string, Set<string>>();
  variants.forEach(v => {
    const attrs = v.attributes as unknown as Array<{ name: string; option: string; slug: string }>;
    if (Array.isArray(attrs)) {
      attrs.forEach(a => {
        if (!attrMap.has(a.name)) attrMap.set(a.name, new Set());
        attrMap.get(a.name)!.add(a.option);
      });
    }
  });

  const matchedVariant = variants.find(v => {
    const attrs = v.attributes as unknown as Array<{ name: string; option: string }>;
    if (!Array.isArray(attrs)) return false;
    return attrs.every(a => selectedAttrs[a.name] === a.option);
  });

  const allSelected = attrMap.size > 0 && Object.keys(selectedAttrs).length === attrMap.size;
  const effectivePrice = matchedVariant
    ? parseFloat(String(matchedVariant.price))
    : parseFloat(String(product?.salePrice || product?.price || "0"));

  const handleAdd = () => {
    if (!product) return;
    if (product.type === "variable" && !allSelected) {
      toast.error("Please select all options");
      return;
    }
    const variantLabel = matchedVariant
      ? (matchedVariant.attributes as unknown as any[])?.map((a: any) => a.option).join(", ")
      : undefined;
    onAddToCart({
      productId: product.id,
      variantId: matchedVariant?.id,
      name: cleanName(product.name),
      sku: matchedVariant?.sku || product.sku || undefined,
      quantity: qty,
      qtyValue: qty,
      measurementType: "unit",
      unitPrice: effectivePrice,
      variantAttributes: allSelected ? selectedAttrs : undefined,
      variantLabel,
    });
    onClose();
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="flex gap-0">
          <div className="flex-1 p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{cleanName(product.name)}</DialogTitle>
              {matchedVariant?.sku && (
                <p className="text-sm text-muted-foreground">{matchedVariant.sku}</p>
              )}
            </DialogHeader>

            {Array.from(attrMap.entries()).map(([attrName, options]) => (
              <div key={attrName}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {attrName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(options).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setSelectedAttrs(prev => ({ ...prev, [attrName]: opt }))}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        selectedAttrs[attrName] === opt
                          ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                          : "border-border hover:border-blue-300"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {matchedVariant && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm font-bold text-green-700">
                  {effectivePrice.toFixed(3)} KWD
                  {matchedVariant.posStock !== null && (
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ({matchedVariant.posStock} in stock)
                    </span>
                  )}
                </p>
              </div>
            )}
            {!allSelected && product.type !== "variable" && (
              <div className="text-2xl font-bold text-green-700">
                {effectivePrice.toFixed(3)} KWD
              </div>
            )}

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleAdd}
              disabled={product.type === "variable" && !allSelected}
            >
              Add to Cart
            </Button>
          </div>

          <div className="w-56 bg-muted/40 p-4 flex flex-col gap-3 border-l">
            <p className="text-center font-semibold text-sm text-muted-foreground uppercase tracking-wide">Qty</p>
            <div className="text-center">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-muted"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-3xl font-bold w-12 text-center">{qty}</span>
                <button
                  onClick={() => setQty(q => Math.min(999, q + 1))}
                  className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-muted"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <Numpad value={qty} onChange={v => setQty(Math.max(1, v))} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Discount Modal (B8) ──────────────────────────────────────────────────────

function DiscountModal({
  open,
  currentDiscount,
  subtotal,
  onClose,
  onApply,
}: {
  open: boolean;
  currentDiscount: number;
  subtotal: number;
  onClose: () => void;
  onApply: (amount: number) => void;
}) {
  const [mode, setMode] = useState<"amount" | "percent">("amount");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) {
      setValue(currentDiscount > 0 ? String(currentDiscount) : "");
    }
  }, [open, currentDiscount]);

  const computed = mode === "percent"
    ? (subtotal * (parseFloat(value || "0") / 100))
    : parseFloat(value || "0");

  const handleApply = () => {
    const amount = Math.min(computed, subtotal);
    if (isNaN(amount) || amount < 0) { toast.error("Invalid discount"); return; }
    onApply(amount);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5" />
            Apply Discount
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setMode("amount")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "amount" ? "bg-blue-600 text-white" : "hover:bg-muted"}`}
            >
              Amount (KWD)
            </button>
            <button
              onClick={() => setMode("percent")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "percent" ? "bg-blue-600 text-white" : "hover:bg-muted"}`}
            >
              Percentage (%)
            </button>
          </div>

          <Input
            type="number"
            min="0"
            max={mode === "percent" ? "100" : String(subtotal)}
            step="0.001"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={mode === "percent" ? "e.g. 10" : "e.g. 2.500"}
            className="text-lg text-center font-bold"
            autoFocus
          />

          {mode === "percent" && (
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map(p => (
                <button
                  key={p}
                  onClick={() => setValue(String(p))}
                  className="py-2 rounded-lg border text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  {p}%
                </button>
              ))}
            </div>
          )}

          {value && !isNaN(computed) && computed > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-bold text-blue-700">{Math.min(computed, subtotal).toFixed(3)} KWD</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">New total</span>
                <span className="font-bold text-green-700">{Math.max(0, subtotal - Math.min(computed, subtotal)).toFixed(3)} KWD</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            {currentDiscount > 0 && (
              <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => { onApply(0); onClose(); }}>
                Remove
              </Button>
            )}
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({
  open,
  total,
  onClose,
  onPay,
  isPaying,
}: {
  open: boolean;
  total: number;
  onClose: () => void;
  onPay: (method: "knet" | "visa" | "cash", ref?: string) => void;
  isPaying: boolean;
}) {
  const [method, setMethod] = useState<"knet" | "visa" | "cash">("knet");
  const [ref, setRef] = useState("");
  const [cashGiven, setCashGiven] = useState("");

  const change = method === "cash" && cashGiven
    ? Math.max(0, parseFloat(cashGiven) - total)
    : null;

  const methods = [
    { id: "knet" as const, label: "KNET", icon: "💳" },
    { id: "visa" as const, label: "Visa / Mastercard", icon: "💳" },
    { id: "cash" as const, label: "Cash", icon: "💵" },
  ];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Payment</DialogTitle>
        </DialogHeader>
        <div className="text-center py-4">
          <p className="text-muted-foreground text-sm mb-1">Total Amount</p>
          <p className="text-4xl font-bold text-green-700">{total.toFixed(3)} KWD</p>
        </div>
        <div className="space-y-2">
          {methods.map(m => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`w-full px-4 py-3 rounded-lg border text-left font-medium transition-colors flex items-center gap-3 ${
                method === m.id
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-border hover:border-blue-300"
              }`}
            >
              <span className="text-lg">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
        {method === "cash" && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cash Given (KWD)</p>
            <Input
              type="number"
              step="0.001"
              min={total}
              placeholder={total.toFixed(3)}
              value={cashGiven}
              onChange={e => setCashGiven(e.target.value)}
            />
            {change !== null && change > 0 && (
              <div className="mt-2 bg-green-50 rounded-lg p-2 text-center">
                <p className="text-xs text-muted-foreground">Change</p>
                <p className="text-xl font-bold text-green-700">{change.toFixed(3)} KWD</p>
              </div>
            )}
          </div>
        )}
        {method !== "cash" && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Reference / Transaction ID (optional)
            </p>
            <Input
              placeholder="e.g. KNET-123456"
              value={ref}
              onChange={e => setRef(e.target.value)}
            />
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPaying}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={() => onPay(method, ref || undefined)}
            disabled={isPaying}
          >
            {isPaying ? "Processing..." : "Confirm Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Order Confirmation + Receipt (B7) ────────────────────────────────────────

function OrderConfirmation({
  open,
  orderNumber,
  total,
  items,
  paymentMethod,
  discountAmount,
  receiptHeader,
  receiptFooter,
  onClose,
}: {
  open: boolean;
  orderNumber: string;
  total: number;
  items: CartItem[];
  paymentMethod: string;
  discountAmount: number;
  receiptHeader?: string;
  receiptFooter?: string;
  onClose: () => void;
}) {
  const PAYMENT_LABELS: Record<string, string> = {
    knet: "KNET",
    visa: "Visa/MC",
    cash: "Cash",
    other: "Other",
  };

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) { toast.error("Popup blocked — allow popups to print"); return; }
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qtyValue, 0);
    const itemRows = items.map(i => {
      const qtyLabel = i.measurementType === "unit" ? String(i.quantity) : `${i.qtyValue} ${i.measurementType}`;
      return `<tr><td>${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}</td><td style="text-align:right">${qtyLabel}</td><td style="text-align:right">${(i.unitPrice * i.qtyValue).toFixed(3)}</td></tr>`;
    }).join("");
    win.document.write(`
      <html><head><title>Receipt ${orderNumber}</title>
      <style>
        body{font-family:monospace;font-size:12px;width:300px;margin:0 auto;padding:8px}
        table{width:100%;border-collapse:collapse}
        td,th{padding:2px 4px}
        .total{font-weight:bold;font-size:14px}
        .divider{border-top:1px dashed #000;margin:6px 0}
        .center{text-align:center}
        pre{font-family:monospace;font-size:11px;margin:0;white-space:pre-wrap}
      </style></head><body>
      ${receiptHeader ? `<pre class="center">${receiptHeader}</pre><div class="divider"></div>` : ""}
      <div class="center" style="font-weight:bold;font-size:14px">${orderNumber}</div>
      <div class="center" style="font-size:11px">${new Date().toLocaleString()}</div>
      <div class="divider"></div>
      <table>
        <thead><tr><th style="text-align:left">Item</th><th>Qty</th><th>Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="divider"></div>
      <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${subtotal.toFixed(3)} KWD</span></div>
      ${discountAmount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${discountAmount.toFixed(3)} KWD</span></div>` : ""}
      <div class="total" style="display:flex;justify-content:space-between;margin-top:4px"><span>TOTAL</span><span>${total.toFixed(3)} KWD</span></div>
      <div style="text-align:center;margin-top:8px;font-size:11px">Payment: ${PAYMENT_LABELS[paymentMethod] ?? paymentMethod}</div>
      ${receiptFooter ? `<div class="divider"></div><pre class="center">${receiptFooter}</pre>` : ""}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <div className="flex flex-col items-center gap-4 py-4">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
          <div>
            <h2 className="text-2xl font-bold">Order Complete!</h2>
            <p className="text-muted-foreground mt-1">{orderNumber}</p>
          </div>
          <p className="text-3xl font-bold text-green-700">{total.toFixed(3)} KWD</p>
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={onClose}>
              New Sale
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sell Screen ──────────────────────────────────────────────────────────────

function SellScreen({
  cart,
  setCart,
  onSaveCart,
}: {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onSaveCart: (items: CartItem[]) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [cartNote, setCartNote] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [variationProduct, setVariationProduct] = useState<PosProduct | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("knet");
  const [confirmation, setConfirmation] = useState<{
    orderNumber: string;
    total: number;
    items: CartItem[];
    paymentMethod: string;
    discountAmount: number;
  } | null>(null);

  const { data: categories = [] } = trpc.pos.categories.useQuery();
  const { data: productsData } = trpc.pos.products.useQuery({
    categoryId: selectedCategoryId ?? undefined,
    search: search || undefined,
    limit: 100,
  });
  const { data: posSettings } = trpc.pos.getSettings.useQuery();
  const products = productsData?.items ?? [];

  const createOrder = trpc.pos.createOrder.useMutation({
    onSuccess: (data) => {
      setConfirmation({
        orderNumber: data.orderNumber,
        total: cartTotal,
        items: [...cart],
        paymentMethod,
        discountAmount,
      });
      setShowPayment(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create order");
    },
  });

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.qtyValue, 0);
  const cartTotal = Math.max(0, subtotal + shippingCost - discountAmount);
  const cartCount = cart.reduce((sum, item) => sum + (item.measurementType === "unit" ? item.quantity : 1), 0);

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const key = `${item.productId}-${item.variantId ?? ""}`;
      const existing = prev.find(i => `${i.productId}-${i.variantId ?? ""}` === key);
      if (existing) {
        return prev.map(i =>
          `${i.productId}-${i.variantId ?? ""}` === key
            ? (i.measurementType === "unit"
                ? { ...i, quantity: i.quantity + item.quantity, qtyValue: i.qtyValue + item.qtyValue }
                : { ...i, qtyValue: parseFloat((i.qtyValue + item.qtyValue).toFixed(3)) })
            : i
        );
      }
      return [...prev, item];
    });
  }, [setCart]);

  const handleProductClick = (product: PosProduct) => {
    if (product.type === "variable") {
      setVariationProduct(product);
    } else {
      const measurementType = product.measurementType || "unit";
      addToCart({
        productId: product.id,
        name: cleanName(product.name),
        sku: product.sku ?? undefined,
        quantity: 1,
        qtyValue: 1,
        measurementType,
        unitPrice: parseFloat(String(product.salePrice || product.price)),
      });
    }
  };

  const updateQty = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], quantity: newQty, qtyValue: newQty };
      }
      return updated;
    });
  };

  const updateQtyValue = (index: number, qtyValue: number) => {
    setCart(prev => {
      const updated = [...prev];
      if (qtyValue <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], qtyValue: Math.max(0.001, qtyValue) };
      }
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // B9: Barcode scanner — detect rapid keystrokes ending with Enter
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === searchRef.current) return;
      if (e.key === "Enter" && barcodeBuffer.length > 2) {
        setSearch(barcodeBuffer);
        setSelectedCategoryId(null);
        setBarcodeBuffer("");
        searchRef.current?.focus();
        return;
      }
      if (e.key.length === 1) {
        setBarcodeBuffer(prev => prev + e.key);
        clearTimeout(timer);
        timer = setTimeout(() => setBarcodeBuffer(""), 200);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); clearTimeout(timer); };
  }, [barcodeBuffer]);

  const handlePay = (method: "knet" | "visa" | "cash", ref?: string) => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    setPaymentMethod(method);
    createOrder.mutate({
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      note: cartNote || undefined,
      shippingCost,
      discountAmount,
      paymentMethod: method,
      paymentReference: ref,
      items: cart.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        name: cleanName(item.name),
        sku: item.sku,
        quantity: item.quantity,
        qtyValue: item.qtyValue,
        measurementType: item.measurementType,
        unitPrice: item.unitPrice,
        variantAttributes: item.variantAttributes,
      })),
    });
  };

  const handleNewSale = () => {
    setCart([]);
    setCartNote("");
    setShippingCost(0);
    setDiscountAmount(0);
    setCustomerName("");
    setCustomerPhone("");
    setConfirmation(null);
    setSelectedCategoryId(null);
    setSearch("");
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Left panel: categories + products ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
          {selectedCategoryId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSelectedCategoryId(null); setSearch(""); }}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Scan className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-label="Barcode scanner ready" />
            <Input
              ref={searchRef}
              placeholder="Search by name, SKU, or scan barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && search) setSelectedCategoryId(null);
              }}
              className="pl-9 pr-9"
            />
          </div>
          {search && (
            <Button variant="ghost" size="icon" onClick={() => setSearch("")}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedCategoryId && !search ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Categories</p>
              {categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Package className="w-10 h-10 mb-2" />
                  <p>No categories found</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className="aspect-square rounded-xl border bg-white hover:border-blue-400 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-2 p-3"
                    >
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="w-10 h-10 object-cover rounded-lg" />
                      ) : (
                        <Package className="w-8 h-8 text-muted-foreground" />
                      )}
                      <span className="text-xs font-medium text-center leading-tight line-clamp-2">{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {selectedCategoryId && !search && (
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {categories.find(c => c.id === selectedCategoryId)?.name ?? "Products"}
                </p>
              )}
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Package className="w-10 h-10 mb-2" />
                  <p>No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {products.map(product => {
                    const price = parseFloat(String(product.salePrice || product.price));
                    const hasSale = !!product.salePrice && parseFloat(String(product.salePrice)) < parseFloat(String(product.price));
                    const outOfStock = product.posStock !== null && product.posStock <= 0;
                    const imgs = product.images as unknown as string[];
                    const img = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
                    return (
                      <button
                        key={product.id}
                        onClick={() => !outOfStock && handleProductClick(product as PosProduct)}
                        disabled={outOfStock}
                        className={`rounded-xl border bg-white flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-blue-400 ${
                          outOfStock ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <div className="aspect-square bg-gray-100 relative">
                          {img ? (
                            <img src={img} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          {outOfStock && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="text-white text-xs font-bold bg-red-600 px-2 py-0.5 rounded">OUT</span>
                            </div>
                          )}
                          {product.posStock !== null && product.posStock > 0 && product.posStock <= 5 && (
                            <div className="absolute top-1 right-1">
                              <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded">
                                {product.posStock} left
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium leading-tight line-clamp-2">{cleanName(product.name)}</p>
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-sm font-bold text-green-700">{price.toFixed(3)}</span>
                            {hasSale && (
                              <span className="text-xs text-muted-foreground line-through">
                                {parseFloat(String(product.price)).toFixed(3)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: cart ── */}
      <div className="w-80 bg-white border-l flex flex-col overflow-hidden">
        {/* Cart header */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Cart
              {cartCount > 0 && (
                <Badge variant="secondary" className="text-xs">{cartCount}</Badge>
              )}
            </h2>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => onSaveCart(cart)}
                title="Save cart for later"
              >
                <BookmarkCheck className="w-3.5 h-3.5 mr-1" />
                Save
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Customer name"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="text-xs h-8"
            />
            <Input
              placeholder="Phone"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              className="text-xs h-8 w-28"
            />
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Tap a product to add it</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.name}</p>
                      {item.variantLabel && (
                        <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                      )}
                      {item.sku && (
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {item.measurementType === "unit" ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(index, -1)}
                          className="w-6 h-6 rounded-full border flex items-center justify-center hover:bg-muted"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(index, 1)}
                          className="w-6 h-6 rounded-full border flex items-center justify-center hover:bg-muted"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0.001"
                          step="0.5"
                          value={item.qtyValue}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (v > 0) updateQtyValue(index, v);
                          }}
                          className="w-16 h-6 text-sm text-center border rounded outline-none"
                        />
                        <span className="text-xs text-muted-foreground">{item.measurementType}</span>
                      </div>
                    )}
                    <p className="text-sm font-bold text-green-700">
                      {(item.unitPrice * item.qtyValue).toFixed(3)} KWD
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart footer */}
        <div className="border-t px-4 py-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <button
              className="flex flex-col items-center gap-1 py-2 rounded-lg border hover:bg-muted transition-colors text-xs"
              onClick={() => {
                const note = window.prompt("Add note:", cartNote);
                if (note !== null) setCartNote(note);
              }}
            >
              <StickyNote className="w-4 h-4" />
              Note
            </button>
            <button
              className="flex flex-col items-center gap-1 py-2 rounded-lg border hover:bg-muted transition-colors text-xs"
              onClick={() => {
                const val = window.prompt("Shipping cost (KWD):", String(shippingCost));
                if (val !== null) setShippingCost(parseFloat(val) || 0);
              }}
            >
              <Truck className="w-4 h-4" />
              Shipping
            </button>
            <button
              className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition-colors text-xs ${
                discountAmount > 0
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "hover:bg-muted"
              }`}
              onClick={() => setShowDiscount(true)}
            >
              <Percent className="w-4 h-4" />
              {discountAmount > 0 ? `${discountAmount.toFixed(3)}` : "Discount"}
            </button>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sub Total</span>
              <span className="font-medium">{subtotal.toFixed(3)} KWD</span>
            </div>
            {shippingCost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium">+{shippingCost.toFixed(3)} KWD</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium text-red-600">-{discountAmount.toFixed(3)} KWD</span>
              </div>
            )}
            {cartNote && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Note:</span>
                <span className="truncate ml-2 max-w-[200px]">{cartNote}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-base"
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {cartTotal.toFixed(3)} KWD
            </Button>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <VariationModal
        product={variationProduct}
        open={!!variationProduct}
        onClose={() => setVariationProduct(null)}
        onAddToCart={addToCart}
      />
      <DiscountModal
        open={showDiscount}
        currentDiscount={discountAmount}
        subtotal={subtotal}
        onClose={() => setShowDiscount(false)}
        onApply={setDiscountAmount}
      />
      <PaymentModal
        open={showPayment}
        total={cartTotal}
        onClose={() => setShowPayment(false)}
        onPay={handlePay}
        isPaying={createOrder.isPending}
      />
      {confirmation && (
        <OrderConfirmation
          open={!!confirmation}
          orderNumber={confirmation.orderNumber}
          total={confirmation.total}
          items={confirmation.items}
          paymentMethod={confirmation.paymentMethod}
          discountAmount={confirmation.discountAmount}
          receiptHeader={posSettings?.posReceiptHeader ?? undefined}
          receiptFooter={posSettings?.posReceiptFooter ?? undefined}
          onClose={handleNewSale}
        />
      )}
    </div>
  );
}

// ─── Main POS Component ───────────────────────────────────────────────────────

export default function POS() {
  const [screen, setScreen] = useState<Screen>("board");
  const [cart, setCart] = useState<CartItem[]>([]);
  const utils = trpc.useUtils();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const returnParam = encodeURIComponent('/admin/pos');
      window.location.href = `/staff-login?return=${returnParam}`;
    }
  }, [user, loading]);

  const saveCart = trpc.pos.saveCart.useMutation({
    onSuccess: () => {
      utils.pos.savedCarts.invalidate();
      toast.success("Cart saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveCart = (items: CartItem[]) => {
    if (items.length === 0) { toast.error("Cart is empty"); return; }
    saveCart.mutate({
      items: items.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
        name: i.name,
        sku: i.sku,
        quantity: i.quantity,
        qtyValue: i.qtyValue,
        measurementType: i.measurementType,
        unitPrice: i.unitPrice,
      })),
    });
  };

  const handleResumeCart = (items: CartItem[], _cartId: number) => {
    setCart(items);
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3 text-gray-600">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs font-semibold uppercase tracking-widest">Authenticating POS access...</p>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin' && user.role !== 'pos') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 px-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <Lock className="mx-auto mb-4 h-8 w-8 text-amber-700" />
          <h1 className="text-2xl font-semibold text-gray-900">POS Access Required</h1>
          <p className="mt-3 text-sm text-gray-600">
            This terminal is restricted to admin and POS staff accounts. Please sign in with an authorized staff account.
          </p>
          <button
            type="button"
            onClick={() => { window.location.href = '/staff-login?return=%2Fadmin%2Fpos'; }}
            className="mt-6 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-gray-800"
          >
            Staff Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar screen={screen} onNavigate={(s) => setScreen(s as Screen)} cartCount={cartCount} />
      <div className="flex flex-1 overflow-hidden">
        {screen === "board" && <POSBoard onNavigate={(s) => setScreen(s as Screen)} />}
        {screen === "sell" && (
          <SellScreen cart={cart} setCart={setCart} onSaveCart={handleSaveCart} />
        )}
        {screen === "savedCarts" && (
          <POSSavedCarts onResumeCart={handleResumeCart} onNavigate={(s) => setScreen(s as Screen)} />
        )}
        {screen === "orders" && <POSOrders />}
        {screen === "transactions" && <POSTransactions />}
        {screen === "report" && <POSReport />}
        {screen === "settings" && <POSSettings />}
      </div>
    </div>
  );
}
