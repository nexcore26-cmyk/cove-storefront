# Migration Plan: cove-storefront → droplet 200.141.8.75

This tracks moving the app from 164.92.181.17 to 200.141.8.75, matching current
behavior exactly (no functional changes). `app.coveinterior.com` is a staging
domain, not the live business (`coveinterior.com`, WordPress, is separate and
untouched by this plan). Once this move is done and validated, the next
milestone is building real tenant-scoping logic on this new droplet — that is
a separate phase, not part of this migration.

Update this file (check boxes, add notes) as work happens, regardless of which
machine (home/office PC) is driving — this file is the shared source of truth.

## Phase 0: Write this plan into the repo
- [x] Add `docs/MIGRATION_PLAN.md`, commit, push

## Phase 1: Provision the target droplet (200.141.8.75)
- [x] Install `pnpm` (corepack, matching source lockfile version)
- [x] Install `certbot`
- [x] Sort out MySQL root access (check for existing password, reset via sudo if needed)
- [x] Create `cove_storefront` database + dedicated `cove_app` user/password
- [x] Generate dedicated read-only SSH deploy key for this droplet, add to GitHub repo
- [x] Clone `cove-storefront` to `/home/nexcore/cove-storefront`

## Phase 2: Transfer the database
- [x] `mysqldump` the `cove_storefront` DB from 164.92.181.17
- [x] Copy dump to 200.141.8.75, import into new `cove_storefront` database
- [x] Spot-check row counts (products, orders, tenants) against source

## Phase 3: Configure and build the app
- [x] Create `.env` on new droplet: copy secrets as-is, new `DATABASE_URL`, `PORT=3001`
- [x] `pnpm install`, `pnpm build`
- [x] Start via pm2 (`cove-storefront`), `pm2 save`, `pm2 startup systemd` under `nexcore`

## Phase 4: nginx + validation (no DNS change yet)
- [x] nginx server blocks for app/admin/pos.coveinterior.com → `127.0.0.1:3001`
- [x] Validate via `curl -H "Host: ..."` against the new droplet's IP before touching DNS
- [x] Confirm homepage, product pages, admin login, POS all work against the imported DB

## Phase 5: DNS cutover (low-risk, whenever ready)
- [ ] Update Cloudflare DNS for the three subdomains to point to `200.141.8.75`
- [ ] Run `certbot` once DNS has propagated
- [ ] Confirm HTTPS works end-to-end; compare a few pages against the old droplet for parity
- [ ] Leave the old droplet's copy stopped-but-present as a fallback (don't delete yet)

## Phase 6: Next milestone (separate from this plan)
- [ ] Begin actual tenant-scoping logic (query filtering by tenantId, tenant resolution, per-tenant theming) on 200.141.8.75
- [ ] (Much later) Plan the real `coveinterior.com` WordPress → multi-tenant cutover
