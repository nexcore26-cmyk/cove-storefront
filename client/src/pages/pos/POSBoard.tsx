/**
 * B1 — POS Board: cashier dashboard with stats and hourly sales chart
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ShoppingBag, DollarSign, TrendingUp, Calendar } from "lucide-react";

export default function POSBoard({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const { user } = useAuth();
  const { data: stats } = trpc.pos.myStats.useQuery();
  const { data: hourly = [] } = trpc.pos.hourlySales.useQuery();
  const { data: settings } = trpc.pos.getSettings.useQuery();

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const tiles = [
    {
      label: "Today's Sales",
      value: `${(stats?.todaySales ?? 0).toFixed(3)} KWD`,
      sub: `${stats?.todayOrders ?? 0} orders`,
      icon: DollarSign,
      color: "bg-green-50 text-green-700 border-green-200",
      iconColor: "text-green-600",
    },
    {
      label: "This Month",
      value: `${(stats?.monthSales ?? 0).toFixed(3)} KWD`,
      sub: `${stats?.monthOrders ?? 0} orders`,
      icon: Calendar,
      color: "bg-blue-50 text-blue-700 border-blue-200",
      iconColor: "text-blue-600",
    },
    {
      label: "All Time",
      value: `${(stats?.totalSales ?? 0).toFixed(3)} KWD`,
      sub: `${stats?.totalOrders ?? 0} orders`,
      icon: TrendingUp,
      color: "bg-purple-50 text-purple-700 border-purple-200",
      iconColor: "text-purple-600",
    },
    {
      label: "New Sale",
      value: "Start Selling",
      sub: "Open sell screen",
      icon: ShoppingBag,
      color: "bg-orange-50 text-orange-700 border-orange-200 cursor-pointer hover:bg-orange-100",
      iconColor: "text-orange-600",
      onClick: () => onNavigate("sell"),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"},{" "}
            {user?.name?.split(" ")[0] ?? "Cashier"} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{dateStr}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{timeStr}</p>
          <p className="text-xs text-muted-foreground">{settings?.posTerminalName ?? "Register 1"}</p>
        </div>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`rounded-xl border p-4 space-y-2 transition-all ${tile.color}`}
            onClick={tile.onClick}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{tile.label}</p>
              <tile.icon className={`w-5 h-5 ${tile.iconColor}`} />
            </div>
            <p className="text-xl font-bold">{tile.value}</p>
            <p className="text-xs opacity-60">{tile.sub}</p>
          </div>
        ))}
      </div>

      {/* Hourly sales chart */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Today's Hourly Sales
        </h2>
        {hourly.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No sales data yet today
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={55} tickFormatter={(v) => `${v.toFixed(0)}`} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(3)} KWD`, "Sales"]}
                labelFormatter={(label) => `Hour: ${label}`}
              />
              <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Saved Carts", screen: "savedCarts", emoji: "🛒" },
          { label: "Today's Orders", screen: "orders", emoji: "📋" },
          { label: "Transactions", screen: "transactions", emoji: "💳" },
        ].map((action) => (
          <button
            key={action.screen}
            onClick={() => onNavigate(action.screen)}
            className="bg-white rounded-xl border p-4 text-center hover:bg-gray-50 transition-colors"
          >
            <div className="text-2xl mb-1">{action.emoji}</div>
            <p className="text-sm font-medium">{action.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
