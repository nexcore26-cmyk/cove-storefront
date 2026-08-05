import { eq } from "drizzle-orm";
import { tenantBranding, tenants } from "../drizzle/schema";
import type { TenantBranding } from "../drizzle/schema";
import { getDb } from "./db";
import { matchTenantForHost, DEFAULT_TENANT_ID } from "./_core/context";

// Single source of truth for reading a tenant's branding config, shared by
// the public tRPC procedure (tenantBranding.getPublic) and the server-side
// index.html templating middleware, so the lookup logic isn't duplicated.
//
// Short in-process cache: this is read on every HTML page load and every
// client app mount, so we avoid hitting MySQL per request. TTL is short
// enough that an admin edit shows up almost immediately.
const CACHE_TTL_MS = 30_000;
const cache = new Map<number, { row: TenantBranding | null; expiresAt: number }>();

export async function getTenantBranding(tenantId: number): Promise<TenantBranding | null> {
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.row;
  }

  const db = await getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(tenantBranding)
    .where(eq(tenantBranding.tenantId, tenantId))
    .limit(1);

  const result = row ?? null;
  cache.set(tenantId, { row: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export async function getTenantBrandingForHost(host: string | undefined): Promise<TenantBranding | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({ id: tenants.id, rootDomain: tenants.rootDomain })
    .from(tenants);

  const matchedId = matchTenantForHost(host, rows) ?? DEFAULT_TENANT_ID;
  return getTenantBranding(matchedId);
}

// Call after any admin write to tenant_branding so the change is visible
// immediately instead of waiting out the cache TTL.
export function invalidateTenantBrandingCache(tenantId: number): void {
  cache.delete(tenantId);
}
