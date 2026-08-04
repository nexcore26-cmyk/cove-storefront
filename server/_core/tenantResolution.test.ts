/**
 * Tenant resolution test.
 * Verifies that incoming requests are matched to the correct tenant by Host
 * header — the foundational piece multi-tenant query scoping depends on.
 *
 * Tests the pure matching logic directly (same pattern as
 * branchStockDeduction.test.ts), without needing a real DB connection.
 */
import { describe, it, expect } from 'vitest';
import { matchTenantForHost, type TenantDomainRow } from './context';

const tenantRows: TenantDomainRow[] = [
  { id: 1, rootDomain: 'coveinterior.com' },
  { id: 2, rootDomain: 'fabricshop.com' },
];

describe('matchTenantForHost', () => {
  it('matches a tenant root domain exactly', () => {
    expect(matchTenantForHost('coveinterior.com', tenantRows)).toBe(1);
    expect(matchTenantForHost('fabricshop.com', tenantRows)).toBe(2);
  });

  it('matches any subdomain of a tenant root domain', () => {
    expect(matchTenantForHost('app.coveinterior.com', tenantRows)).toBe(1);
    expect(matchTenantForHost('admin.coveinterior.com', tenantRows)).toBe(1);
    expect(matchTenantForHost('pos.coveinterior.com', tenantRows)).toBe(1);
  });

  it('is case-insensitive', () => {
    expect(matchTenantForHost('APP.COVEINTERIOR.COM', tenantRows)).toBe(1);
  });

  it('ignores a port number on the host header', () => {
    expect(matchTenantForHost('app.coveinterior.com:3001', tenantRows)).toBe(1);
  });

  it('does not match a totally unrelated domain', () => {
    expect(matchTenantForHost('totally-unrelated.xyz', tenantRows)).toBeNull();
  });

  it('does not match a domain that merely contains the root domain as a substring', () => {
    // "notcoveinterior.com" should NOT match "coveinterior.com" — it isn't
    // an exact match or a proper ".coveinterior.com" subdomain.
    expect(matchTenantForHost('notcoveinterior.com', tenantRows)).toBeNull();
  });

  it('returns null for an undefined host', () => {
    expect(matchTenantForHost(undefined, tenantRows)).toBeNull();
  });

  it('skips tenants with no rootDomain set', () => {
    const rows: TenantDomainRow[] = [{ id: 3, rootDomain: null }];
    expect(matchTenantForHost('anything.com', rows)).toBeNull();
  });
});
