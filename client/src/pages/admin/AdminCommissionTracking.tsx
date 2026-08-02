import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, Clock, CheckCircle } from "lucide-react";

export default function AdminCommissionTracking() {
  const [filter, setFilter] = useState("all");
  const commissionsQuery = trpc.vendors.getCommissionTracking.useQuery({ status: filter as any });
  const summaryQuery = trpc.vendors.getCommissionSummary.useQuery();
  const markAsPaidMutation = trpc.vendors.markAsPaid.useMutation();

  const handleMarkAsPaid = (vendorId: number) => {
    markAsPaidMutation.mutate({ vendorId }, {
      onSuccess: () => {
        commissionsQuery.refetch();
        summaryQuery.refetch();
      },
    });
  };

  const summary = summaryQuery.data;
  const commissions = commissionsQuery.data || [];

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-amber-600" />
            <div>
              <h1 className="text-2xl font-bold text-white">Commission Tracking</h1>
              <p className="text-sm text-zinc-400">Manage vendor commissions and payments</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-zinc-800 border-zinc-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Total Earned</p>
                  <p className="text-2xl font-bold text-amber-600">{summary.totalEarned.toFixed(3)} KWD</p>
                </div>
                <TrendingUp className="w-8 h-8 text-amber-600 opacity-50" />
              </div>
            </Card>

            <Card className="bg-zinc-800 border-zinc-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Pending Payment</p>
                  <p className="text-2xl font-bold text-yellow-500">{summary.totalPending.toFixed(3)} KWD</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
              </div>
            </Card>

            <Card className="bg-zinc-800 border-zinc-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Already Paid</p>
                  <p className="text-2xl font-bold text-green-500">{summary.totalPaid.toFixed(3)} KWD</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </Card>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2">
          {["all", "pending", "paid"].map((status) => (
            <Button
              key={status}
              onClick={() => setFilter(status)}
              variant={filter === status ? "default" : "outline"}
              className={filter === status ? "bg-amber-600 hover:bg-amber-700" : ""}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>

        {/* Commission List */}
        <Card className="bg-zinc-800 border-zinc-700 overflow-hidden">
          {commissionsQuery.isLoading ? (
            <div className="p-8 text-center text-zinc-400">Loading commissions...</div>
          ) : commissions.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">No commissions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700 bg-zinc-900">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Vendor</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Email</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-zinc-300">Commission</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((commission: any) => (
                    <tr key={commission.vendorId} className="border-b border-zinc-700 hover:bg-zinc-700/50">
                      <td className="px-6 py-4 text-sm text-white">{commission.vendorName}</td>
                      <td className="px-6 py-4 text-sm text-zinc-400">{commission.email}</td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-amber-600">
                        {commission.commissionAmount.toFixed(3)} KWD
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            commission.status === "paid"
                              ? "bg-green-900/30 text-green-400"
                              : "bg-yellow-900/30 text-yellow-400"
                          }`}
                        >
                          {commission.status === "paid" ? "Paid" : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {commission.status === "pending" && (
                          <Button
                            onClick={() => handleMarkAsPaid(commission.vendorId)}
                            disabled={markAsPaidMutation.isPending}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {markAsPaidMutation.isPending ? "Processing..." : "Mark Paid"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
