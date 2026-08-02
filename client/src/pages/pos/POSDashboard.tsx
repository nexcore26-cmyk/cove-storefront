/**
 * POSDashboard — Landing page for POS staff after login.
 *
 * Shows:
 *  - Welcome header with staff name and terminal name
 *  - Today / This Month / All-Time sales KPI cards
 *  - Quick-launch grid: Terminal, Orders, Saved Carts, Transactions, Report, Settings
 *  - Today's hourly sales mini-chart
 *
 * Design: Obsidian Editorial — matches POS terminal and admin sidebar.
 */
import { Link } from 'wouter';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  Monitor,
  ShoppingBag,
  BookmarkCheck,
  CreditCard,
  BarChart3,
  Settings,
  TrendingUp,
  ShoppingCart,
  Clock,
  ArrowRight,
} from 'lucide-react';

function fmt(val: number) {
  return val.toLocaleString('en-KW', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' KWD';
}

const QUICK_LINKS = [
  {
    href: '/admin/pos',
    label: 'POS Terminal',
    description: 'Open the sell screen',
    icon: Monitor,
    accent: '#9D7D39',
  },
  {
    href: '/admin/pos?screen=orders',
    label: 'Orders',
    description: 'View today\'s POS orders',
    icon: ShoppingBag,
    accent: '#6B8E6B',
  },
  {
    href: '/admin/pos?screen=saved',
    label: 'Saved Carts',
    description: 'Resume a saved cart',
    icon: BookmarkCheck,
    accent: '#6B7A8E',
  },
  {
    href: '/admin/pos?screen=transactions',
    label: 'Transactions',
    description: 'Payment ledger',
    icon: CreditCard,
    accent: '#8E6B6B',
  },
  {
    href: '/admin/pos?screen=report',
    label: 'Report',
    description: 'Sales by method & seller',
    icon: BarChart3,
    accent: '#7A6B8E',
  },
  {
    href: '/admin/pos?screen=settings',
    label: 'Settings',
    description: 'Terminal & receipt config',
    icon: Settings,
    accent: '#6B8E8E',
  },
];

function POSDashboardContent() {
  const { user } = useAuth();
  const statsQuery = trpc.pos.myStats.useQuery();
  const hourlyQuery = trpc.pos.hourlySales.useQuery();
  const settingsQuery = trpc.settings.get.useQuery();

  const stats = statsQuery.data;
  const hourly = hourlyQuery.data ?? [];
  const terminalName = (settingsQuery.data as any)?.posTerminalName ?? 'Register 1';

  const maxSales = Math.max(...hourly.map(h => h.sales), 1);

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: '#F0EDE8' }}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-light tracking-wide"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#111110' }}
            >
              Welcome back, {user?.name || user?.email || 'Staff'}
            </h1>
            <p
              className="text-xs tracking-[0.2em] uppercase mt-1"
              style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}
            >
              {terminalName} &nbsp;·&nbsp; POS Dashboard
            </p>
          </div>
          <Link href="/admin/pos">
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded text-xs font-semibold tracking-[0.15em] uppercase cursor-pointer transition-all hover:opacity-90"
              style={{ backgroundColor: '#9D7D39', color: '#111110', fontFamily: 'Montserrat, sans-serif' }}
            >
              <Monitor size={14} />
              Open Terminal
            </div>
          </Link>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "Today's Sales", value: fmt(stats?.todaySales ?? 0), sub: `${stats?.todayOrders ?? 0} orders`, icon: TrendingUp },
            { label: 'This Month', value: fmt(stats?.monthSales ?? 0), sub: `${stats?.monthOrders ?? 0} orders`, icon: ShoppingCart },
            { label: 'All Time', value: fmt(stats?.totalSales ?? 0), sub: `${stats?.totalOrders ?? 0} orders`, icon: BarChart3 },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div
              key={label}
              className="rounded p-5"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(17,17,16,0.08)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-[10px] font-semibold tracking-[0.2em] uppercase"
                  style={{ color: 'rgba(17,17,16,0.4)', fontFamily: 'Montserrat, sans-serif' }}
                >
                  {label}
                </p>
                <Icon size={14} style={{ color: '#9D7D39' }} />
              </div>
              <p
                className="text-xl font-semibold"
                style={{ color: '#111110', fontFamily: 'Montserrat, sans-serif' }}
              >
                {value}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: 'rgba(17,17,16,0.4)', fontFamily: 'Montserrat, sans-serif' }}
              >
                {sub}
              </p>
            </div>
          ))}
        </div>

        {/* ── Quick Launch Grid ───────────────────────────────────────────── */}
        <div>
          <p
            className="text-[10px] font-semibold tracking-[0.25em] uppercase mb-3"
            style={{ color: 'rgba(17,17,16,0.4)', fontFamily: 'Montserrat, sans-serif' }}
          >
            Quick Access
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {QUICK_LINKS.map(({ href, label, description, icon: Icon, accent }) => (
              <Link key={href} href={href}>
                <div
                  className="group flex items-center gap-4 p-4 rounded cursor-pointer transition-all hover:shadow-sm"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(17,17,16,0.08)' }}
                >
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${accent}18` }}
                  >
                    <Icon size={16} style={{ color: accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-semibold tracking-wide"
                      style={{ color: '#111110', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-[10px] mt-0.5 truncate"
                      style={{ color: 'rgba(17,17,16,0.4)', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {description}
                    </p>
                  </div>
                  <ArrowRight
                    size={12}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: accent }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Today's Hourly Chart ────────────────────────────────────────── */}
        {hourly.length > 0 && (
          <div
            className="rounded p-5"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(17,17,16,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock size={13} style={{ color: '#9D7D39' }} />
              <p
                className="text-[10px] font-semibold tracking-[0.2em] uppercase"
                style={{ color: 'rgba(17,17,16,0.4)', fontFamily: 'Montserrat, sans-serif' }}
              >
                Today's Sales by Hour
              </p>
            </div>
            <div className="flex items-end gap-1 h-24">
              {hourly.map((h) => {
                const pct = maxSales > 0 ? (h.sales / maxSales) * 100 : 0;
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    {h.sales > 0 && (
                      <div
                        className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none"
                      >
                        <div
                          className="px-2 py-1 rounded text-[9px] whitespace-nowrap"
                          style={{ backgroundColor: '#111110', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
                        >
                          {fmt(h.sales)}
                        </div>
                      </div>
                    )}
                    <div className="w-full flex items-end" style={{ height: '80px' }}>
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          height: `${Math.max(pct, h.sales > 0 ? 4 : 1)}%`,
                          backgroundColor: h.sales > 0 ? '#9D7D39' : 'rgba(17,17,16,0.08)',
                        }}
                      />
                    </div>
                    <span
                      className="text-[8px] tracking-wide"
                      style={{ color: 'rgba(17,17,16,0.3)', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {h.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function POSDashboard() {
  return (
    <AdminLayout>
      <POSDashboardContent />
    </AdminLayout>
  );
}
