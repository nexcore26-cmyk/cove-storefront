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

## Phase C: Scope existing catalog tables (DONE 2026-08-05)
~96 call sites across `server/routers.ts`, `server/routers/attributes.ts` (~25 sites), `server/routers/pos.ts`, `server/routers/bundles.ts`, `server/routers/cart.ts` need `eq(table.tenantId, ctx.tenantId)` added — for `products`, `categories`, `productVariants`, `attributes`, `attributeValues`, `product_translations`, `category_translations`, `attribute_value_stock`, `product_attributes`. The storefront browse path already goes through centralized helpers in `server/db.ts` (`getProducts`, `getCategories`, etc.) using a `conditions[]` array — inject tenant scoping there first (fewer places, highest traffic), then work through the raw inline call sites file by file.
- [x] Scope `server/db.ts` helpers (storefront browse path) — commit 7d0265f
- [x] Scope `server/routers/attributes.ts` (heaviest file) — commit 25e866e, includes insert/update/delete ownership fixes beyond just read-filtering
- [x] Scope `server/routers.ts` product/variant admin CRUD, bundle items, pre-orders — commit 36c5579. Also fixed `generateSku`/`checkSkuUnique` in `db.ts`, which were checking uniqueness *globally* across all tenants (a real correctness bug, not just a leak) — now per-tenant, matching the `products.slug` convention.
- [x] Scope `server/routers.ts` `translationsRouter` (product/category translations, incl. LLM auto-translate) — commit 121efa6. `upsertProduct`/`upsertCategory` previously had **zero tenant check at all** — any admin could write a translation onto another tenant's product/category by ID. Fixed with an ownership check before every write.
- [x] Add a cross-tenant isolation test — commit 6e08c66, `server/tenantIsolation.test.ts`, real DB test with a throwaway tenant, proves `getProducts`/`getProductById`/`getProductBySlug`/`getCategories`/`checkSkuUnique`/`generateSku` don't leak or false-conflict across tenants (including two products sharing an identical slug across tenants)
- [x] Scope `server/routers/bundles.ts` — commit 58d0a91. `setItems` previously had zero ownership check on either the bundle or its component variants — real cross-tenant write risk, closed. `searchVariants` admin typeahead and `listBundleProducts` were also unscoped.
- [x] Scope `server/routers/pos.ts` catalog reads (`categories`, `products`, `variants`, `branches`, `setActiveBranch`) — commit 869cecd. `setActiveBranch` previously had **zero tenant check** — any POS staff could select any branch by ID, including another tenant's, and operate against its warehouse.
- Note: `server/routers/cart.ts` was touched only for the `getProductStock` signature change (Phase C helper). Its deeper gaps (`carts.insert` missing `tenantId`, unscoped `cart_items` queries) are real but belong to **Phase D** (transactional/checkout path, deliberately deferred, not rushed in passing)
- Note: `wishlists` table (`wishlistRouter`, `server/db.ts` helpers) has the same gap as carts — not tenant-scoped yet, also Phase D, not fixed here beyond a defensive `products.tenantId` filter on the product-enrichment join in `wishlistRouter.get`
- Note: `pos.ts`'s order/checkout/reporting procedures (`searchCustomers`, `createOrder`, `myStats`, `hourlySales`, `myOrders`, `allOrders`, `orderDetail`, `transactions`, `report`, `savedCarts`, `saveCart`, `deleteCart`) all revolve around `orders`/`orderItems`/`customers` — deliberately left for Phase D, same reasoning as cart.ts
- **New finding**: `storeSettings` (POS terminal settings, warehouse defaults, etc. — `pos.getSettings`/`updateSettings` and other callers) is a **single global row with no `tenantId` column at all** — not even schema groundwork exists for it, unlike orders/customers/warehouses which got `tenantId` in Phase A. Needs a schema decision (most likely one settings row per tenant) before it can be scoped — flagging rather than deciding this mid-pass. Not part of Phase C or D as currently defined; needs its own slot.

**Phase C is now complete** — every catalog table (`products`, `categories`, `productVariants`, `attributes`, `attributeValues`, `product_translations`, `category_translations`, `attribute_value_stock`, `product_attributes`, `branches`) is genuinely tenant-isolated across the storefront, admin, POS, and bundle-management surfaces, verified with a real cross-tenant integration test (`server/tenantIsolation.test.ts`).

**Pattern found repeatedly across this pass, worth knowing for any future table**: many `insert()` calls didn't set `tenantId` explicitly at all, relying on the column's `DEFAULT 1` — meaning any future tenant's admin action would have silently written data as tenant 1's. This is a distinct bug class from "read isn't filtered" and was present on nearly every table touched (`attributes`, `products`, `productVariants`, `product_translations`, `category_translations`). Always check inserts explicitly, not just reads. Also recurring: several tables (`attribute_value_bundle_items`, `bundle_items`) have no `tenantId` column of their own — ownership was verified through a parent row instead (e.g. the attribute value or product variant it belongs to) rather than adding new columns mid-pass.

## Phase D: Scope newly-tenanted transactional tables (not started)
`orders`, `customers`, `warehouses`, `carts`, `cart_items`, `wishlists` — higher business risk (checkout/transactional paths), do this carefully with its own tests once Phase C is done and the pattern is proven. Phase C is now done, so this is the next real chunk of work.
- [ ] Scope order creation/lookup (`server/routers.ts` orders admin, `pos.ts` createOrder/myOrders/allOrders/orderDetail/transactions/report/savedCarts/saveCart/deleteCart, `cart.ts` checkout flow)
- [ ] Scope customer creation/lookup (`pos.ts` searchCustomers, and wherever customers are created/looked up elsewhere)
- [ ] Scope warehouse/stock queries beyond what Phase A/C already covered (warehouse creation/management itself, not just reads through it)
- [ ] Scope cart/cart_items (`cart.ts` — `carts.insert` currently relies on the `DEFAULT 1`, same bug class as everywhere else)
- [ ] Scope `wishlists` (currently has no tenantId at all — needs a Phase-A-style schema addition first)
- [ ] Tests for each (cross-tenant isolation test, same pattern as `tenantIsolation.test.ts`)

## Phase E: Per-tenant theming/UI (not started)
The original ask that started this whole project — shared core components + per-tenant theme config + pluggable product-type modules (per-item/weight/meter variations). Comes after C/D, once data isolation is actually real.

**Confirmed domain/login model (2026-08-04):** each tenant's apex domain is the public storefront; `app.<tenant-domain>` is that tenant's staff/admin dashboard login (e.g. `app.almazyadfabrics.com` for a future tenant). This already works for *tenant identification* today (any subdomain of `rootDomain` resolves to the right tenant — confirmed in Phase B). **Gap**: visiting `admin.coveinterior.com/` currently shows the storefront homepage, not a login screen — the client SPA (`client/src/App.tsx`) has one flat route table with no hostname-based branching, so subdomain doesn't yet change *what's shown at `/`*. Needs: detect the `app.`/`admin.` subdomain client- or server-side and route `/` straight to the login/dashboard for that case. Small, but not yet built — do this as part of Phase E (or earlier, since it directly affects the login UX for every new tenant).

## Not-yet-decided design points
- `warehouses.code` and a few other columns are still globally unique (not per-tenant) — same class of issue `products.slug` had before Phase 1a fixed it. Will need the same per-tenant-unique-index treatment before a second tenant can actually create their own warehouses/codes.

## Far-future milestone (not planned yet)
`coveinterior.com` (WordPress) → this multi-tenant system, once it's built out and validated. Not `app.coveinterior.com` — that's the staging domain for this app, not the live business.
