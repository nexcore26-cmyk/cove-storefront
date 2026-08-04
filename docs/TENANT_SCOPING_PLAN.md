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
- Note: `server/routers/cart.ts` and `wishlists` were only partially touched during Phase C (the `getProductStock` signature change, and a defensive product-enrichment filter respectively) — their full scoping happened in **Phase D** (D3/D4/D6 below), now done.
- Note: `pos.ts`'s order/checkout/reporting procedures (`searchCustomers`, `createOrder`, `myStats`, `hourlySales`, `myOrders`, `allOrders`, `orderDetail`, `transactions`, `report`, `savedCarts`, `saveCart`, `deleteCart`) all revolve around `orders`/`orderItems`/`customers` — `createOrder`/`saveCart` (the writes) were fixed in Phase D3; the read/reporting procedures listed here were intentionally left as-is since they're scoped to the requesting user/cashier already (`createdByUserId`) and lower-traffic than the admin-wide dashboards Phase D5 covered — revisit if this becomes a real gap.
- **New finding**: `storeSettings` (POS terminal settings, warehouse defaults, etc. — `pos.getSettings`/`updateSettings` and other callers) is a **single global row with no `tenantId` column at all** — not even schema groundwork exists for it, unlike orders/customers/warehouses which got `tenantId` in Phase A. Needs a schema decision (most likely one settings row per tenant) before it can be scoped — flagging rather than deciding this mid-pass. Not part of Phase C or D as currently defined; needs its own slot.

**Phase C is now complete** — every catalog table (`products`, `categories`, `productVariants`, `attributes`, `attributeValues`, `product_translations`, `category_translations`, `attribute_value_stock`, `product_attributes`, `branches`) is genuinely tenant-isolated across the storefront, admin, POS, and bundle-management surfaces, verified with a real cross-tenant integration test (`server/tenantIsolation.test.ts`).

**Pattern found repeatedly across this pass, worth knowing for any future table**: many `insert()` calls didn't set `tenantId` explicitly at all, relying on the column's `DEFAULT 1` — meaning any future tenant's admin action would have silently written data as tenant 1's. This is a distinct bug class from "read isn't filtered" and was present on nearly every table touched (`attributes`, `products`, `productVariants`, `product_translations`, `category_translations`). Always check inserts explicitly, not just reads. Also recurring: several tables (`attribute_value_bundle_items`, `bundle_items`) have no `tenantId` column of their own — ownership was verified through a parent row instead (e.g. the attribute value or product variant it belongs to) rather than adding new columns mid-pass.

## Phase D: Scope transactional tables (DONE 2026-08-05)
`orders`, `customers`, `carts`/`cart_items`, `wishlists` — higher business risk than Phase C (checkout/payment/PII paths). Sequenced by risk: fixed the worst leak first (D1), then a schema gap (D2), then writes before reads (D3-D6), same discipline as Phase C throughout.

- [x] **D1** — `customersRouter` (`server/routers/customers.ts`) — commit `02f6809`. **Most severe finding of the whole project**: `exportCsv` had no `WHERE` clause at all — a full, unfiltered export of every tenant's customer PII (name/email/phone/address/notes/spend) in one call. Fixed first, independent of sequencing. `list`/`byId`/`updateNotes`/`recalcTotals` also had zero tenant check (role-only `adminProcedure` guard, no tenant guard) — all fixed.
- [x] **D2** — `wishlists.tenantId` schema migration — commit `b26d8f6` (`drizzle/0043_wishlists_tenant_id.sql`). Same additive Phase-A-style pattern (default 1). Applied and verified on live DB (0 pre-existing rows, nothing to backfill).
- [x] **D3+D4** — order/cart write paths + complete `cart.ts` — commit `0f27563`. `createOrder()` (`server/db.ts`) now requires `tenantId` explicitly instead of relying on the DB default. `ordersRouter.place`'s customer lookup now scoped by `(email, tenantId)` — email isn't unique across tenants. `ordersRouter.exchange` verifies the original order's tenant and copies it to the replacement order. `pos.ts` `createOrder`/`saveCart`: the "update existing draft" branch had **zero ownership check** — any POS staff could overwrite another tenant's draft order by ID. All of `cart.ts` (7 procedures) scoped — `updateItem`/`removeItem` previously trusted a raw `cartItemId` with **zero ownership check whatsoever**; `mergeOnLogin` (flagged as highest-risk in the exploration) found a guest cart by `sessionId` alone with no tenant filter. Verified live: real add-to-cart flow end-to-end, and the exact `mergeOnLogin` risk proven closed (identical `sessionId` across two tenants no longer cross-contaminates).
- [x] **D5** — order admin/read paths, in 3 commits:
  - `ordersRouter` (all 15 procedures) — commit `bf63fe2`. `updateStatus` and `removeOrderItem` had **zero tenant check at all** (any orders-staff could change status or delete a gift line on another tenant's order by ID). `addGiftLine` had three separate unscoped lookups. `exportCsv` was the same full-unfiltered-export bug class as D1's customers fix. Verified live against a real order (`MAIN-20615`) via `orders.track`.
  - `analyticsRouter` (all 6 dashboards) — commit `5910467`. None had any tenant filter — would have blended every tenant's revenue/orders/inventory in one admin dashboard. `inventoryReport` didn't even destructure `ctx`.
  - `returnRequestsRouter` + `vendorPortalRouter` — commit `e834fe5`. All 5 return-request procedures had zero tenant check; `return_requests` has no `tenantId` column of its own, verified via join with the parent order instead. `vendorPortalRouter` uses a separate HMAC-signed vendor-token auth (not tRPC `ctx`) that already tenant-scopes the vendor lookup correctly — added defense-in-depth tenant filters on the joined products/orders so a data-integrity slip upstream (`product_vendors` linking cross-tenant) couldn't leak another tenant's catalog/sales into a vendor's dashboard.
- [x] **D6** — wishlists — commit `198ab9a`. `getWishlist`/`addToWishlist`/`removeFromWishlist` (`server/db.ts`) now require `tenantId`. Verified live end-to-end (real add+get) and isolation-tested (identical `sessionId` across two tenants no longer leaks).
- [x] **D7** — extended `server/tenantIsolation.test.ts` with orders + wishlist cross-tenant tests — commit `bb3ca79` (9 tests total, all passing, teardown verified clean). `cart.ts`/`customers.ts` have no standalone exported functions to unit test (inline tRPC procedures only) — verified instead via real live HTTP functional tests documented in the D1/D3/D4 commit messages.

**Phase D is now complete.** Every transactional table (`orders`, `order_items` via join, `customers`, `carts`/`cart_items`, `wishlists`) is genuinely tenant-isolated across checkout, POS, admin order management, analytics, returns, and the vendor portal.

**Still explicitly out of scope, flagged not fixed:**
- Per-tenant payment gateway configuration — MyFatoorah credentials are a single global `.env` value. A second tenant with their own payment account needs its own schema/design work.
- `findOrderIdForPaymentResult`'s webhook fallback path (`server/payment.ts`) still matches by payment reference across all tenants when the primary orderId-based lookup fails. Low-probability (only matters if two tenants' gateway references ever collided), and fixing it properly depends on the payment-infra decision above.
- `storeSettings` — still a single global row, no `tenantId` column at all, needs its own schema decision (most likely one row per tenant) before it can be scoped. Not part of C or D as defined; needs its own slot whenever it's prioritized.
- Warehouse *creation/management* itself (as opposed to reads through it, which Phase A/C/D all cover incidentally) wasn't separately audited — worth a dedicated look if warehouse admin CRUD becomes relevant before a second tenant needs their own warehouses.

## Phase E: Per-tenant theming/UI (not started)
The original ask that started this whole project — shared core components + per-tenant theme config + pluggable product-type modules (per-item/weight/meter variations). Comes after C/D, once data isolation is actually real.

**Confirmed domain/login model (2026-08-04):** each tenant's apex domain is the public storefront; `app.<tenant-domain>` is that tenant's staff/admin dashboard login (e.g. `app.almazyadfabrics.com` for a future tenant). This already works for *tenant identification* today (any subdomain of `rootDomain` resolves to the right tenant — confirmed in Phase B). **Gap**: visiting `admin.coveinterior.com/` currently shows the storefront homepage, not a login screen — the client SPA (`client/src/App.tsx`) has one flat route table with no hostname-based branching, so subdomain doesn't yet change *what's shown at `/`*. Needs: detect the `app.`/`admin.` subdomain client- or server-side and route `/` straight to the login/dashboard for that case. Small, but not yet built — do this as part of Phase E (or earlier, since it directly affects the login UX for every new tenant).

## Not-yet-decided design points
- `warehouses.code` and a few other columns are still globally unique (not per-tenant) — same class of issue `products.slug` had before Phase 1a fixed it. Will need the same per-tenant-unique-index treatment before a second tenant can actually create their own warehouses/codes.

## Far-future milestone (not planned yet)
`coveinterior.com` (WordPress) → this multi-tenant system, once it's built out and validated. Not `app.coveinterior.com` — that's the staging domain for this app, not the live business.
