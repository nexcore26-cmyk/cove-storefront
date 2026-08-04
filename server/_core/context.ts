import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { tenants } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getDb } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  tenantId: number;
};

export const DEFAULT_TENANT_ID = 1;

export interface TenantDomainRow {
  id: number;
  rootDomain: string | null;
}

// Pure matching logic, kept separate from the DB fetch so it's directly
// testable (see server/_core/tenantResolution.test.ts). Host header is
// matched against each tenant's rootDomain: exact match, or any subdomain
// of it — e.g. rootDomain "coveinterior.com" also matches
// app./admin./pos.coveinterior.com.
export function matchTenantForHost(
  host: string | undefined,
  tenantRows: TenantDomainRow[],
): number | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();

  const match = tenantRows.find((t) => {
    if (!t.rootDomain) return false;
    const root = t.rootDomain.toLowerCase();
    return hostname === root || hostname.endsWith(`.${root}`);
  });

  return match ? match.id : null;
}

// Resolves which tenant an incoming request belongs to. Falls back to the
// default tenant if nothing matches, so existing single-tenant behavior is
// preserved during the transition; unmatched hosts are logged so real gaps
// are visible once more tenants exist.
async function resolveTenantId(host: string | undefined): Promise<number> {
  const db = await getDb();
  if (!db) return DEFAULT_TENANT_ID;

  const rows = await db
    .select({ id: tenants.id, rootDomain: tenants.rootDomain })
    .from(tenants);

  const matchedId = matchTenantForHost(host, rows);
  if (matchedId === null) {
    console.warn(`[tenant] No tenant matched host "${host}", defaulting to tenant ${DEFAULT_TENANT_ID}`);
    return DEFAULT_TENANT_ID;
  }
  return matchedId;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const tenantId = await resolveTenantId(opts.req.headers.host);

  return {
    req: opts.req,
    res: opts.res,
    user,
    tenantId,
  };
}
