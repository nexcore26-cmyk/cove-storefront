/**
 * Shared role-gated tRPC procedures.
 *
 * These wrappers enforce both user role and backend-owned tenant module flags.
 * Frontend hiding is never considered sufficient authorization.
 */
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";
import { requireTenantModule } from "../_core/tenantModules";

/** Admin only; requires the tenant admin module. */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  await requireTenantModule(ctx, "admin");
  return next({ ctx });
});

/** POS staff (role: 'pos' or 'admin'); requires the tenant POS module. */
export const posProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "pos") {
    throw new TRPCError({ code: "FORBIDDEN", message: "POS access required" });
  }
  await requireTenantModule(ctx, "pos");
  return next({ ctx });
});

/** Orders staff (role: 'orders' or 'admin'); requires the tenant orders module. */
export const ordersProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "orders") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Orders access required" });
  }
  await requireTenantModule(ctx, "orders");
  return next({ ctx });
});
