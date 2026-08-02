import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatKwd(value: unknown) {
  const amount = Number(value ?? 0);
  return `${amount.toFixed(3)} KWD`;
}

export default function VendorDashboard() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("vendor_token"));
  const queryInput = useMemo(() => token ? { token } : undefined, [token]);

  useEffect(() => {
    if (!token) navigate("/vendor/login");
  }, [token, navigate]);

  const profileQuery = trpc.vendor.me.useQuery(queryInput as { token: string }, { enabled: !!queryInput, retry: false });
  const productsQuery = trpc.vendor.getProducts.useQuery(queryInput as { token: string }, { enabled: !!queryInput, retry: false });
  const ordersQuery = trpc.vendor.getOrders.useQuery(queryInput ? { ...queryInput, page: 1, limit: 25 } : ({ token: "", page: 1, limit: 25 } as any), { enabled: !!queryInput, retry: false });
  const commissionQuery = trpc.vendor.getCommissionSummary.useQuery(queryInput as { token: string }, { enabled: !!queryInput, retry: false });

  const logout = () => {
    localStorage.removeItem("vendor_token");
    localStorage.removeItem("vendor_name");
    setToken(null);
    navigate("/vendor/login");
  };

  if (!token) return null;
  if (profileQuery.error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md w-full">
          <CardHeader><CardTitle>Vendor session expired</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-zinc-400">Please sign in again to access the vendor dashboard.</p>
            <Button onClick={logout} className="bg-[#9d7d39] hover:bg-[#8b6f31] text-white">Back to login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = profileQuery.data;
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const summary = commissionQuery.data ?? { totalEarned: 0, totalPending: 0, totalPaid: 0 };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
            <p className="text-zinc-400">{profile?.name ?? localStorage.getItem("vendor_name") ?? "Vendor"}</p>
          </div>
          <Button variant="outline" onClick={logout} className="border-zinc-700 text-zinc-200">Logout</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800"><CardHeader><CardTitle className="text-sm text-zinc-400">Status</CardTitle></CardHeader><CardContent><Badge className="bg-emerald-900 text-emerald-300">{profile?.status ?? "active"}</Badge></CardContent></Card>
          <Card className="bg-zinc-900 border-zinc-800"><CardHeader><CardTitle className="text-sm text-zinc-400">Products</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{products.length}</CardContent></Card>
          <Card className="bg-zinc-900 border-zinc-800"><CardHeader><CardTitle className="text-sm text-zinc-400">Pending Commission</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatKwd(summary.totalPending)}</CardContent></Card>
          <Card className="bg-zinc-900 border-zinc-800"><CardHeader><CardTitle className="text-sm text-zinc-400">Total Earned</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatKwd(summary.totalEarned)}</CardContent></Card>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><div className="text-zinc-500">Contact</div><div>{profile?.contactName ?? "—"}</div></div>
            <div><div className="text-zinc-500">Email</div><div>{profile?.email ?? "—"}</div></div>
            <div><div className="text-zinc-500">Phone</div><div>{profile?.phone ?? "—"}</div></div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Products</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow className="border-zinc-800"><TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Commission</TableHead></TableRow></TableHeader>
              <TableBody>
                {products.map((product: any) => (
                  <TableRow key={product.productId} className="border-zinc-800"><TableCell>{product.name}</TableCell><TableCell>{product.sku ?? "—"}</TableCell><TableCell>{product.status}</TableCell><TableCell className="text-right">{Number(product.commissionPercent ?? 0).toFixed(2)}%</TableCell></TableRow>
                ))}
                {products.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-zinc-500 py-8">No products assigned yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow className="border-zinc-800"><TableHead>Order</TableHead><TableHead>Item</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Line Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {orders.map((order: any, index: number) => (
                  <TableRow key={`${order.orderId}-${index}`} className="border-zinc-800"><TableCell>{order.orderNumber ?? order.orderId}</TableCell><TableCell>{order.itemName}</TableCell><TableCell>{order.status}</TableCell><TableCell className="text-right">{formatKwd(order.lineTotal)}</TableCell></TableRow>
                ))}
                {orders.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-zinc-500 py-8">No vendor order lines yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
