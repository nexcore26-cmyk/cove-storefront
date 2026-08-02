/**
 * Account — Login/Register + Order history
 * Design: Obsidian Editorial
 */
import { useState } from 'react';
import { Package, User, MapPin, LogOut, ChevronRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { toast } from 'sonner';

type AccountView = 'auth' | 'dashboard' | 'orders' | 'profile' | 'addresses';

const mockOrders = [
  { id: 'CVE-001234', date: '2025-04-15', status: 'Delivered', total: 285.000, items: 1 },
  { id: 'CVE-001189', date: '2025-03-28', status: 'Processing', total: 430.500, items: 2 },
  { id: 'CVE-001042', date: '2025-02-10', status: 'Delivered', total: 145.000, items: 1 },
];

const statusColors: Record<string, string> = {
  Delivered: '#4CAF50',
  Processing: '#9D7D39',
  Shipped: '#2196F3',
  Cancelled: '#F44336',
};

export default function Account() {
  const [view, setView] = useState<AccountView>('auth');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Please fill in all fields'); return; }
    setIsLoggedIn(true);
    setView('dashboard');
    toast.success('Welcome back!');
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.firstName) { toast.error('Please fill in all required fields'); return; }
    setIsLoggedIn(true);
    setView('dashboard');
    toast.success('Account created successfully!');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setView('auth');
    toast.info('Logged out');
  };

  if (!isLoggedIn) {
    return (
      <Layout>
        <div className="container py-16 max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <p
              className="text-xs font-semibold tracking-[0.25em] uppercase mb-3"
              style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}
            >
              My Account
            </p>
            <h1
              className="text-4xl font-light"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}
            >
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
          </div>

          {/* Auth toggle */}
          <div className="flex border-b mb-8" style={{ borderColor: '#E8E4DC' }}>
            {(['login', 'register'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAuthMode(mode)}
                className="flex-1 py-3 text-xs font-semibold tracking-widest uppercase border-b-2 transition-all duration-200"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  color: authMode === mode ? '#9D7D39' : '#8A8A82',
                  borderBottomColor: authMode === mode ? '#9D7D39' : 'transparent',
                  marginBottom: '-1px',
                }}
              >
                {mode === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Login form */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39] transition-colors"
                  style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39] transition-colors"
                  style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs transition-colors hover:text-[#9D7D39]"
                  style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                  onClick={() => toast.info('Password reset coming soon')}
                >
                  Forgot password?
                </button>
              </div>
              <button type="submit" className="btn-obsidian w-full mt-2">
                Sign In
              </button>
            </form>
          )}

          {/* Register form */}
          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                    className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39] transition-colors"
                    style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39] transition-colors"
                    style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39] transition-colors"
                  style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+965 XXXX XXXX"
                  className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39] transition-colors"
                  style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                  Password *
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39] transition-colors"
                  style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                />
              </div>
              <button type="submit" className="btn-obsidian w-full mt-2">
                Create Account
              </button>
            </form>
          )}
        </div>
      </Layout>
    );
  }

  // ── Dashboard ──
  return (
    <Layout>
      <div
        className="py-12 border-b"
        style={{ backgroundColor: '#111110', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="container">
          <p
            className="text-xs font-semibold tracking-[0.25em] uppercase mb-2"
            style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}
          >
            My Account
          </p>
          <h1
            className="text-4xl font-light"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#FAFAF8' }}
          >
            Welcome, {form.firstName || 'Guest'}
          </h1>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Sidebar nav */}
          <aside className="md:col-span-1">
            <nav className="space-y-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: <User size={16} /> },
                { id: 'orders', label: 'My Orders', icon: <Package size={16} /> },
                { id: 'addresses', label: 'Addresses', icon: <MapPin size={16} /> },
                { id: 'profile', label: 'Profile', icon: <User size={16} /> },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as AccountView)}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm transition-all duration-150"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    color: view === item.id ? '#9D7D39' : '#242424',
                    backgroundColor: view === item.id ? 'rgba(157,125,57,0.06)' : 'transparent',
                    borderLeft: `2px solid ${view === item.id ? '#9D7D39' : 'transparent'}`,
                  }}
                >
                  <span className="flex items-center gap-3">
                    {item.icon}
                    {item.label}
                  </span>
                  <ChevronRight size={14} style={{ color: '#8A8A82' }} />
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors hover:text-red-500"
                style={{ fontFamily: 'Montserrat, sans-serif', color: '#8A8A82' }}
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </nav>
          </aside>

          {/* Main content */}
          <div className="md:col-span-3">
            {view === 'dashboard' && (
              <div>
                <h2
                  className="text-2xl font-light mb-8"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}
                >
                  Account Overview
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                  {[
                    { label: 'Total Orders', value: mockOrders.length.toString() },
                    { label: 'Total Spent', value: `${mockOrders.reduce((s, o) => s + o.total, 0).toFixed(3)} KWD` },
                    { label: 'Wishlist Items', value: '3' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="p-6 text-center"
                      style={{ backgroundColor: '#F0EDE8' }}
                    >
                      <p
                        className="text-3xl font-light mb-1"
                        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}
                      >
                        {stat.value}
                      </p>
                      <p
                        className="text-xs font-semibold tracking-widest uppercase"
                        style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                      >
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setView('orders')}
                  className="btn-gold-outline"
                >
                  View All Orders
                </button>
              </div>
            )}

            {view === 'orders' && (
              <div>
                <h2
                  className="text-2xl font-light mb-8"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}
                >
                  My Orders
                </h2>
                <div className="space-y-4">
                  {mockOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-5 border flex items-center justify-between gap-4"
                      style={{ borderColor: '#E8E4DC' }}
                    >
                      <div>
                        <p
                          className="text-sm font-medium mb-1"
                          style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                        >
                          {order.id}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                        >
                          {order.date} · {order.items} {order.items === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className="inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-1 mb-1"
                          style={{
                            backgroundColor: `${statusColors[order.status]}20`,
                            color: statusColors[order.status],
                            fontFamily: 'Montserrat, sans-serif',
                          }}
                        >
                          {order.status}
                        </span>
                        <p
                          className="text-lg font-medium italic"
                          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}
                        >
                          {order.total.toFixed(3)} KWD
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === 'profile' && (
              <div>
                <h2
                  className="text-2xl font-light mb-8"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}
                >
                  Profile Settings
                </h2>
                <div className="space-y-4 max-w-md">
                  {[
                    { label: 'First Name', value: form.firstName, key: 'firstName' },
                    { label: 'Last Name', value: form.lastName, key: 'lastName' },
                    { label: 'Email', value: form.email, key: 'email' },
                    { label: 'Phone', value: form.phone, key: 'phone' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label
                        className="block text-xs font-semibold tracking-wider uppercase mb-2"
                        style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                      >
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        className="w-full px-4 py-3 text-sm border bg-transparent outline-none focus:border-[#9D7D39] transition-colors"
                        style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => toast.success('Profile updated')}
                    className="btn-obsidian mt-4"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {view === 'addresses' && (
              <div>
                <h2
                  className="text-2xl font-light mb-8"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}
                >
                  Saved Addresses
                </h2>
                <div
                  className="p-6 border border-dashed text-center"
                  style={{ borderColor: '#D4C9B8' }}
                >
                  <p
                    className="text-sm mb-4"
                    style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    No saved addresses yet
                  </p>
                  <button
                    onClick={() => toast.info('Add address coming soon')}
                    className="btn-gold-outline"
                  >
                    Add New Address
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
