# Homepage Product Cards Issue — Initial Evidence

Live URL inspected: `https://app.coveinterior.com/`

The homepage `Featured Products` CMS block rendered product cards with links using the plural path pattern `/products/{slug}`. The active product-detail route in the client application is `/product/:slug`, so the plural homepage links lead to the storefront 404 page.

Live DOM inspection of the first featured products showed no `<img>` elements inside the product-card links. This matches the user's screenshots showing blank pale image placeholders. The card text and prices were present, but the image source was absent, not merely a failed image download.

Representative live card evidence:

| Card Text | Generated Link | Image Element |
|---|---|---|
| Passage Lamp - Red / KWD 29.000 | `https://app.coveinterior.com/products/passage-lamp-red` | none |
| Passage Refill Lamparfum - cachemire / KWD 8.000 | `https://app.coveinterior.com/products/passage-refill-lamparfum-cachemire` | none |
| Passage Mini Lighter - Silver / KWD 3.300 | `https://app.coveinterior.com/products/passage-mini-lighter-silver` | none |
| Roshina 1 Beige Basic set + Roshina Mubkhar / KWD 59.000 | `https://app.coveinterior.com/products/basic-set-roshina-mubkhar` | none |

Local source inspection identified `client/src/components/cms/BlockRenderer.tsx` as the homepage CMS product-grid renderer. Its product grid currently uses `href={`/products/${product.slug}`}` and renders only `product.image`, while the working shop product cards use `/product/${product.slug}` and derive the main image from `product.images[0]` with JSON parsing fallback.

## Live API Evidence

A live request to `products.list` for the homepage product grid returned products with `image: null` but populated `images` arrays. The CMS product-grid renderer only checked `product.image`, so no `<img>` was rendered even when valid migrated media existed in `product.images[0]`.

| Product | Slug | `image` | First `images` Entry |
|---|---|---|---|
| Passage Lamp - Red | `passage-lamp-red` | null | `/media/wordpress-migration/2025/05/Passage-Lamp-Red.jpeg` |
| Passage Refill Lamparfum - cachemire | `passage-refill-lamparfum-cachemire` | null | `/media/wordpress-migration/2025/05/cachemire.jpeg` |
| Passage Mini Lighter - Silver | `passage-mini-lighter-silver` | null | `/media/wordpress-migration/2025/05/mini-lighter-silver.jpeg` |
| Mini Roshina Beige | `mini-roshina-beige` | null | `/media/wordpress-migration/2025/02/Mini-Roshina-1.jpg` |
| Roshina Mubkhar Petrol | `roshina-mubkhar-petrol` | null | `/media/wordpress-migration/2025/02/Mubkhar-petrol.jpg` |

Root cause is now confirmed as a CMS product-grid frontend rendering bug: it uses the wrong image field and the wrong route prefix. The product image data itself exists for most of the affected products.

## Route and Media Verification

A representative migrated media URL returned HTTP `200`, confirming the product image file itself exists and is publicly reachable:

`https://app.coveinterior.com/media/wordpress-migration/2025/05/Passage-Lamp-Red.jpeg`

The singular route pattern is the valid product-detail route:

| URL | HTTP Status | Application Result |
|---|---:|---|
| `https://app.coveinterior.com/product/passage-lamp-red` | 200 | Valid SPA product route |
| `https://app.coveinterior.com/products/passage-lamp-red` | 200 | SPA shell loads, but rendered content contains `404 Page Not Found` |

This confirms the second root cause: homepage cards were linking to a route path not registered by the live application.


## Post-deployment homepage validation — 2026-05-26 13:08 GMT+3

After deploying the active `client/src/components/cms/BlockRenderer.tsx` patch and rebuilding/restarting `cove-storefront`, the live homepage was reloaded with a cache-busting URL: `https://app.coveinterior.com/?homepage_card_fix=20260526T1308`.

The rendered homepage now shows product-card `<img>` output for the Featured Products block. The first cards use the real media paths from the product `images` array, for example `/media/wordpress-migration/2025/05/Passage-Lamp-Red.jpeg`, `/media/wordpress-migration/2025/05/cachemire.jpeg`, and `/media/wordpress-migration/2025/05/mini-lighter-silver.jpeg`. One product without a usable primary image now shows the safe placeholder rather than a blank white product area.

The Featured Products links now use the live singular product route format, for example `/product/passage-lamp-red`, `/product/passage-refill-lamparfum-cachemire`, `/product/passage-mini-lighter-silver`, and `/product/basic-set-roshina-mubkhar`. This replaces the broken `/products/{slug}` route that produced the storefront 404 page.


The browser viewport after deployment visually confirmed that the Featured Products grid is no longer blank: product images are visible for Passage Lamp, Passage Refill, Passage Mini Lighter, Mini Roshina Beige, and the Roshina Mubkhar products. The rendered Markdown and visible element list both confirm the links are now singular `/product/{slug}` routes.


A corrected product-card destination was opened directly at `https://app.coveinterior.com/product/passage-lamp-red?homepage_card_fix=20260526T1310`. The page rendered the real product detail view, including breadcrumb `Home / Shop / Passage Lamp - Red`, product image `/media/wordpress-migration/2025/05/Passage-Lamp-Red.jpeg`, SKU `12774`, price `29.000 KWD`, quantity controls, and `ADD TO CART`. It did not render the 404 page.
