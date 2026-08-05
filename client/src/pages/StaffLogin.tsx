/**
 * StaffLogin — Username/password login page for admin and POS staff.
 * Replaces Manus OAuth for internal staff access.
 * Design: Obsidian Editorial — dark background, gold accents.
 */
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTenantConfig } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

function getSubdomain(): 'admin' | 'pos' | 'store' | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  if (hostname.startsWith('admin.')) return 'admin';
  if (hostname.startsWith('pos.')) return 'pos';
  if (hostname.startsWith('store.')) return 'store';
  return null;
}

export default function StaffLogin() {
  const { user, loading } = useAuth();
  const { config: tenantConfig } = useTenantConfig();
  const businessName = tenantConfig?.businessName || 'Store';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const subdomain = getSubdomain();

  // Get return path from URL query params
  const returnPath = (() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('return');
  })();

  // If already logged in, redirect to appropriate panel
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    // Determine redirect based on role and subdomain
    if (user.role === 'pos') {
      window.location.href = returnPath || '/admin/pos-dashboard';
    } else if (user.role === 'orders') {
      window.location.href = returnPath || '/admin/orders';
    } else if (user.role === 'admin') {
      window.location.href = returnPath || '/admin';
    } else if ((user as any).role === 'vendor') {
      window.location.href = returnPath || '/admin';
    } else {
      // Regular users shouldn't be here
      window.location.href = '/';
    }
  }, [user, loading, returnPath]);

  const loginMutation = trpc.auth.staffLogin.useMutation({
    onSuccess: (data) => {
      toast.success(`Welcome back, ${data.name || username}!`);
      // Redirect based on role
      if (data.role === 'pos') {
        window.location.href = returnPath || '/admin/pos-dashboard';
      } else if (data.role === 'orders') {
        window.location.href = returnPath || '/admin/orders';
      } else {
        window.location.href = returnPath || '/admin';
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Login failed. Please check your credentials.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter your username and password');
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--brand-secondary)' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--brand-primary)' }} />
      </div>
    );
  }

  const panelLabel = subdomain === 'pos' ? 'POS Terminal' : 'Admin Panel';

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: 'var(--brand-secondary)', fontFamily: 'Montserrat, sans-serif' }}
    >
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, var(--brand-primary) 0%, transparent 50%), radial-gradient(circle at 75% 75%, var(--brand-primary) 0%, transparent 50%)`,
        }}
      />

      <div className="relative w-full max-w-sm px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="text-2xl font-light tracking-[0.4em] uppercase mb-1"
            style={{ color: 'var(--brand-background)', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.75rem' }}
          >
            {businessName}
          </div>
          <div
            className="mt-4 text-xs tracking-[0.2em] uppercase"
            style={{ color: 'var(--brand-primary)' }}
          >
            {panelLabel}
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-sm p-8"
          style={{
            backgroundColor: 'rgba(250,250,248,0.04)',
            border: '1px solid rgba(250,250,248,0.08)',
          }}
        >
          <h1
            className="text-lg font-light mb-6 text-center"
            style={{ color: 'var(--brand-background)', letterSpacing: '0.05em' }}
          >
            Sign In
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label
                className="block text-xs tracking-[0.15em] uppercase mb-2"
                style={{ color: 'rgba(250,250,248,0.5)' }}
              >
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                className="w-full px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'rgba(250,250,248,0.06)',
                  border: '1px solid rgba(250,250,248,0.12)',
                  color: 'var(--brand-background)',
                  borderRadius: '2px',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(250,250,248,0.12)'; }}
                placeholder="Enter your username"
                disabled={loginMutation.isPending}
              />
            </div>

            {/* Password */}
            <div>
              <label
                className="block text-xs tracking-[0.15em] uppercase mb-2"
                style={{ color: 'rgba(250,250,248,0.5)' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: 'rgba(250,250,248,0.06)',
                    border: '1px solid rgba(250,250,248,0.12)',
                    color: 'var(--brand-background)',
                    borderRadius: '2px',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(250,250,248,0.12)'; }}
                  placeholder="Enter your password"
                  disabled={loginMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: "#000000" }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-3 mt-2 text-xs tracking-[0.2em] uppercase font-semibold transition-all flex items-center justify-center gap-2"
              style={{
                backgroundColor: loginMutation.isPending ? 'rgba(157,125,57,0.6)' : 'var(--brand-primary)',
                color: 'var(--brand-secondary)',
                borderRadius: '2px',
                cursor: loginMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          className="text-center mt-6 text-xs"
          style={{ color: 'rgba(250,250,248,0.2)' }}
        >
          {businessName} — Staff Access Only
        </p>
      </div>
    </div>
  );
}
