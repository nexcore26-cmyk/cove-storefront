// Detects which "surface" of the app a hostname is meant to serve, purely
// from the subdomain (admin.<domain> / pos.<domain> / everything else is the
// storefront). This is cosmetic routing convenience, not tenant *resolution*
// - that happens server-side per-request via Host-header matching against
// tenants.rootDomain (server/_core/context.ts). Every tenant's own domain
// gets its own admin./pos. subdomains following this same convention.
export type TenantSurface = 'admin' | 'pos' | 'store';

export function getTenantSurface(): TenantSurface {
  if (typeof window === 'undefined') return 'store';
  const hostname = window.location.hostname;
  if (hostname.startsWith('admin.')) return 'admin';
  if (hostname.startsWith('pos.')) return 'pos';
  return 'store';
}
