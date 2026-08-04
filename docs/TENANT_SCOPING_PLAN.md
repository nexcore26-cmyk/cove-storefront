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
- [x] Scope `server/db.ts` helpers (storefront browse path) — commit 7d0265f
- [x] Scope `server/routers/attributes.ts` (heaviest file) — commit 25e866e, includes insert/update/delete ownership fixes beyond just read-filtering
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

**Confirmed domain/login model (2026-08-04):** each tenant's apex domain is the public storefront; `app.<tenant-domain>` is that tenant's staff/admin dashboard login (e.g. `app.almazyadfabrics.com` for a future tenant). This already works for *tenant identification* today (any subdomain of `rootDomain` resolves to the right tenant — confirmed in Phase B). **Gap**: visiting `admin.coveinterior.com/` currently shows the storefront homepage, not a login screen — the client SPA (`client/src/App.tsx`) has one flat route table with no hostname-based branching, so subdomain doesn't yet change *what's shown at `/`*. Needs: detect the `app.`/`admin.` subdomain client- or server-side and route `/` straight to the login/dashboard for that case. Small, but not yet built — do this as part of Phase E (or earlier, since it directly affects the login UX for every new tenant).

## Not-yet-decided design points
- `warehouses.code` and a few other columns are still globally unique (not per-tenant) — same class of issue `products.slug` had before Phase 1a fixed it. Will need the same per-tenant-unique-index treatment before a second tenant can actually create their own warehouses/codes.

## Far-future milestone (not planned yet)
`coveinterior.com` (WordPress) → this multi-tenant system, once it's built out and validated. Not `app.coveinterior.com` — that's the staging domain for this app, not the live business.
