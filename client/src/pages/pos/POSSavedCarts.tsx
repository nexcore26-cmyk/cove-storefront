/**
 * B2 — Saved Carts: list and resume saved carts
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Trash2, Clock, User } from "lucide-react";
import { toast } from "sonner";

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

interface POSSavedCartsProps {
  onResumeCart: (items: CartItem[], cartId: number) => void;
  onNavigate: (screen: string) => void;
}

export default function POSSavedCarts({ onResumeCart, onNavigate }: POSSavedCartsProps) {
  const utils = trpc.useUtils();
  const { data: savedCarts = [], isLoading } = trpc.pos.savedCarts.useQuery();
  const deleteCart = trpc.pos.deleteCart.useMutation({
    onSuccess: () => {
      utils.pos.savedCarts.invalidate();
      toast.success("Cart deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleResume = (cart: typeof savedCarts[0]) => {
    const items: CartItem[] = (cart.items ?? []).map((item: any) => ({
      productId: item.productId,
      variantId: item.variantId ?? undefined,
      name: item.name,
      sku: item.sku ?? undefined,
      quantity: item.quantity,
      qtyValue: item.qtyValue != null ? parseFloat(String(item.qtyValue)) : item.quantity,
      measurementType: item.measurementType || "unit",
      unitPrice: parseFloat(String(item.unitPrice)),
    }));
    onResumeCart(items, cart.id);
    onNavigate("sell");
    toast.success("Cart resumed");
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Saved Carts</h1>
          <p className="text-sm text-muted-foreground">{savedCarts.length} cart{savedCarts.length !== 1 ? "s" : ""} saved</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onNavigate("sell")}>
          <ShoppingCart className="w-4 h-4 mr-2" />
          New Sale
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : savedCarts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <ShoppingCart className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="font-medium text-muted-foreground">No saved carts</p>
          <p className="text-sm text-muted-foreground mt-1">Save a cart from the sell screen to resume it later</p>
          <Button className="mt-4" onClick={() => onNavigate("sell")}>Start Selling</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {savedCarts.map((cart) => {
            const itemCount = (cart.items ?? []).reduce((s: number, i: any) => s + i.quantity, 0);
            const total = parseFloat(String(cart.total));
            const age = Date.now() - new Date(cart.createdAt).getTime();
            const ageStr = age < 60000 ? "just now"
              : age < 3600000 ? `${Math.floor(age / 60000)}m ago`
              : age < 86400000 ? `${Math.floor(age / 3600000)}h ago`
              : `${Math.floor(age / 86400000)}d ago`;

            return (
              <div key={cart.id} className="bg-white rounded-xl border p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{cart.orderNumber}</p>
                    {cart.customerName && (
                      <Badge variant="secondary" className="text-xs">
                        <User className="w-3 h-3 mr-1" />
                        {cart.customerName}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />{ageStr}
                    </span>
                  </div>
                  {(cart.items ?? []).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {(cart.items as any[]).slice(0, 3).map((i: any) => i.name).join(", ")}
                      {(cart.items as any[]).length > 3 ? ` +${(cart.items as any[]).length - 3} more` : ""}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-green-700">{total.toFixed(3)} KWD</p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                      onClick={() => deleteCart.mutate({ cartId: cart.id })}
                      disabled={deleteCart.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-3 bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleResume(cart)}
                    >
                      Resume
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
