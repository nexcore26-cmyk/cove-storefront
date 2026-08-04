import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { tenantModules } from "../../drizzle/schema";
import { getDb } from "../db";
import type { TrpcContext } from "./context";

export const TENANT_MODULE_KEYS = [
  "storefront",
  "admin",
  "pos",
  "orders",
  "vendors",
  "reports",
  "returns",
  "cms",
  "settings",
] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];

export function getTenantId(ctx: Pick<TrpcContext, "user" | "tenantId">): number {
  // ctx.tenantId is resolved once per request in createContext() (from the
  // Host header, works for both anonymous and authenticated requests) and
  // should always be present. ctx.user?.tenantId is kept as a fallback only
  // for any caller passing a partial/older-shaped context.
  const tenantId = ctx.tenantId ?? ctx.user?.tenantId;
  if (!tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tenant context is required",
    });
  }
  return tenantId;
}

export async function requireTenantModule(
  ctx: Pick<TrpcContext, "user" | "tenantId">,
  moduleKey: TenantModuleKey,
): Promise<void> {
  const tenantId = getTenantId(ctx);
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database unavailable for tenant module check",
    });
  }

  const rows = await db
    .select({ isEnabled: tenantModules.isEnabled })
    .from(tenantModules)
    .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.moduleKey, moduleKey)))
    .limit(1);

  if (!rows[0]?.isEnabled) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Tenant module disabled: ${moduleKey}`,
    });
  }
}
