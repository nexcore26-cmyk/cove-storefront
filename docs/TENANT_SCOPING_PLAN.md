# Tenant Scoping Plan

Tracks turning `cove-storefront` from single-tenant (schema has `tenantId`
everywhere, but nothing filters by it) into a real multi-tenant platform.
Runs on `200.141.8.75` (see `docs/MIGRATION_PLAN.md` for how it got there).
Update this file as work happens, regardless of which machine is driving —
same convention as the migration plan.

Each tenant gets its own custom domain (confirmed with user) — resolved via
`tenants.rootDomain`, matched against the incoming Host header (exact match
or any subdomain, so `app./admin./pos.coveinterior.com` all resolve to
tenant 1 without needing three separate domain rows).

## Phase A: Schema completion
- [x] `tenants.rootDomain` column added, unique, backfilled to `coveinterior.com` for tenant 1
- [x] `tenantId` (default 1) added to `orders`, `customers`, `warehouses`, `carts`, `cart_items`
- [x] Applied to live DB, verified, committed (`3484c4e`)

## Phase B: Tenant resolution middleware
- [x] `TrpcContext` extended with `tenantId`, resolved in `createContext()` from the Host header
- [x] Pure matching logic extracted to `matchTenantForHost()` in `server/_core/context.ts` (unit tested)
- [x] `getTenantId()` in `server/_core/tenantModules.ts` now prefers `ctx.tenantId`
- [x] Verified end-to-end with a throwaway second tenant (`test2.example.com` → resolved to tenant 2, since removed)
- [x] Regression-checked: app/admin/pos.coveinterior.com all still work identically, no behavior change
- [x] Committed (`a430c80`)

**Status: `ctx.tenantId` is now reliably available on every request (public and authenticated). No query anywhere actually filters by it yet — that's Phase C/D below.**

## Phase C: Scope existing catalog tables (not started)
~96 call sites across `server/routers.ts`, `server/routers/attributes.ts` (~25 sites), `server/routers/pos.ts`, `server/routers/bundles.ts`, `server/routers/cart.ts` need `eq(table.tenantId, ctx.tenantId)` added — for `products`, `categories`, `productVariants`, `attributes`, `attributeValues`, `product_translations`, `category_translations`, `attribute_value_stock`, `product_attributes`. The storefront browse path already goes through centralized helpers in `server/db.ts` (`getProducts`, `getCategories`, etc.) using a `conditions[]` array — inject tenant scoping there first (fewer places, highest traffic), then work through the raw inline call sites file by file.
- [ ] Scope `server/db.ts` helpers (storefront browse path)
- [ ] Scope `server/routers/attributes.ts` (heaviest file)
- [ ] Scope remaining `server/routers.ts` call sites (admin CRUD, translations)
- [ ] Scope `server/routers/pos.ts`, `bundles.ts`, `cart.ts`
- [ ] Add a cross-tenant isolation test (tenant 1 query never sees tenant 2 data)

## Phase D: Scope newly-tenanted transactional tables (not started)
`orders`, `customers`, `warehouses`, `carts`, `cart_items` — higher business risk (checkout/transactional paths), do this carefully with its own tests once Phase C is done and the pattern is proven.
- [ ] Scope order creation/lookup
- [ ] Scope customer creation/lookup
- [ ] Scope warehouse/stock queries
- [ ] Scope cart/cart_items
- [ ] Tests for each

## Phase E: Per-tenant theming/UI (not started)
The original ask that started this whole project — shared core components + per-tenant theme config + pluggable product-type modules (per-item/weight/meter variations). Comes after C/D, once data isolation is actually real.

## Far-future milestone (not planned yet)
`coveinterior.com` (WordPress) → this multi-tenant system, once it's built out and validated. Not `app.coveinterior.com` — that's the staging domain for this app, not the live business.
