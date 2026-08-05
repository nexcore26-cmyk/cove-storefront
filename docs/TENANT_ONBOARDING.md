# Tenant Onboarding Runbook

How to bring a brand-new tenant's domain online on `cove-storefront`. This is
almost entirely DNS + nginx + one database insert — there is **one shared
Node process** (currently running on `200.141.8.75`) serving every tenant.
No new deployment, no new code, per tenant. Multi-tenancy works by that one
process resolving which tenant a request belongs to purely from the `Host`
header (`matchTenantForHost()` in `server/_core/context.ts`, matched against
`tenants.rootDomain` — exact match or any subdomain of it).

Example throughout: onboarding `almazyadfabrics.com`.

## 1. DNS

On the tenant's domain's DNS provider, create A (and AAAA if the droplet has
IPv6) records pointing at the droplet's IP:

```
app.almazyadfabrics.com    A    200.141.8.75
admin.almazyadfabrics.com  A    200.141.8.75
pos.almazyadfabrics.com    A    200.141.8.75
```

If the domain is on Cloudflare, use **DNS-only (grey cloud)**, not proxied.
Proxying caused intermittent 404s during this project's own droplet
migration (see `docs/MIGRATION_PLAN.md`) — the established convention for
every subdomain on this project is DNS-only.

## 2. nginx

Add a new server block (or extend the existing one with more
`server_name` entries) proxying to the same upstream Node process — same
port, same app, just a different domain:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name app.almazyadfabrics.com admin.almazyadfabrics.com pos.almazyadfabrics.com;
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Include both the IPv4 and IPv6 `listen` directives — a new vhost missing
`listen [::]:80` was a real bug hit during the original droplet migration
(requests resolving to `::1` locally hit the wrong default server block).

## 3. TLS

```bash
certbot --nginx -d app.almazyadfabrics.com -d admin.almazyadfabrics.com -d pos.almazyadfabrics.com
```

Produces a separate cert for this tenant's domain names.

## 4. Database

Insert the tenant row:

```sql
INSERT INTO tenants (slug, name, rootDomain, status)
VALUES ('almazyad-fabrics', 'Al Mazyad Fabrics', 'almazyadfabrics.com', 'active');
```

`rootDomain` should be the bare domain — `matchTenantForHost()` matches it
exactly and matches any subdomain of it, so `app.`/`admin.`/`pos.` all
resolve automatically once this one row exists. No need for three separate
tenant rows or three separate `rootDomain` values.

Then insert the branding row (there's no admin UI for this yet — see
`docs/TENANT_SCOPING_PLAN.md`'s Phase E deferred items):

```sql
INSERT INTO tenant_branding
  (tenantId, businessName, logoUrl, faviconUrl, ogImageUrl,
   metaTitle, metaDescription, themeColors, headingFontFamily, bodyFontFamily,
   contactPhone, contactEmail, contactAddress, socialLinks, copyrightText)
VALUES
  (<new tenant id>, 'Al Mazyad Fabrics', '/brand/almazyad-logo.png', '/brand/almazyad-favicon.png',
   'https://app.almazyadfabrics.com/brand/og.png',
   'Al Mazyad Fabrics — Fine Fabrics by the Meter', 'Quality fabrics sold by the meter.',
   '{"primary":"#0F766E","secondary":"#134E4A","accent":"#2DD4BF","background":"#F0FDFA","foreground":"#134E4A"}',
   'Playfair Display', 'Inter',
   '+965XXXXXXXX', 'sales@almazyadfabrics.com', '<street address>',
   '{"instagram":"https://www.instagram.com/almazyadfabrics/"}',
   '{businessName} {year} all rights reserved.');
```

`themeColors` must be 5 hex values (primary/secondary/accent/background/
foreground) — these are what `TenantProvider` (`client/src/contexts/
TenantContext.tsx`) injects as `--brand-*` CSS custom properties at runtime.
`headingFontFamily`/`bodyFontFamily` must be real Google Fonts family names
(used to build the `<link>` tag server-side — see `buildFontLinks()` in
`server/tenantBranding.ts`). Logo/favicon files need to actually be uploaded
to those paths before go-live.

For a fabric/coffee-style tenant (sold by weight/length rather than per
item), set `measurementType` on each product to `meter`/`kg`/`roll`/`box`
as appropriate when creating it (`products.measurementType` — `unit` is the
default). Everything else — cart, checkout, shipping calc, POS, receipts —
already handles this correctly per-product, no other setup needed.

## 5. Verify

- `https://app.<domain>/` loads the storefront with the tenant's own
  branding (colors, logo, contact info, SEO title/favicon).
- `https://admin.<domain>/` and `https://pos.<domain>/` show the staff
  login screen (not the storefront homepage).
- View source on `https://app.<domain>/` — `<title>`, meta description,
  and OG tags should reflect the tenant's own `tenant_branding` row, not
  the previous tenant's.
- Add a product to cart and check out — totals should be correct,
  including for any non-unit (`measurementType != 'unit'`) products.

## Known gaps to be aware of before a second real tenant goes live

See `docs/TENANT_SCOPING_PLAN.md`'s Phase D/E "explicitly deferred" notes in
full. The two most likely to actually matter for a second live tenant:

- **Payment gateway config is a single global `.env` value** (MyFatoorah).
  A second tenant with their own payment account needs dedicated schema/
  design work that hasn't been done yet — don't onboard a tenant that
  needs to take real online payments under their own account until this
  is addressed.
- **`store_settings` (POS terminal name, warehouse assignments, receipt
  header/footer, language) is still a global singleton**, not tenant-scoped.
  A second tenant sharing this droplet would currently share these
  operational settings with tenant 1.
