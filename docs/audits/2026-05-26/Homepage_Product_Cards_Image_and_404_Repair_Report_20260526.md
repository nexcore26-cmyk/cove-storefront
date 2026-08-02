# Cove Homepage Product Cards Image and 404 Repair Report

**Author:** Manus AI  
**Date:** 2026-05-26  
**Live site:** https://app.coveinterior.com/

## Summary

The homepage product-card issue shown in the screenshots was **not caused by the variation-parent database repair**. The variation repair fixed product variants, their prices, attributes, and images at the product/variant level. The homepage issue was a separate frontend rendering problem in the CMS product-grid block.

The live homepage was showing product names and prices, but the product image area was blank and product-card clicks opened the storefront 404 page. I confirmed two frontend causes in the homepage CMS renderer and deployed a safe fix to the live Node.js storefront.

| Area | Before Fix | After Fix |
|---|---|---|
| Homepage product images | Blank product image area because the renderer checked `product.image`, which was `null` | Product cards now resolve images from `product.images[0]`, with JSON/string fallback logic matching the shop cards |
| Homepage product links | Broken plural route `/products/{slug}` | Correct singular route `/product/{slug}` |
| Product click behavior | SPA loaded, then rendered `404 Page Not Found` | Product detail page renders normally |
| Deployment status | Not fixed | Built and restarted successfully on the live `cove-storefront` PM2 process |

## Root Cause

The active homepage CMS product-grid renderer was located at:

`client/src/components/cms/BlockRenderer.tsx`

The renderer had two mismatches compared with the working shop product cards. First, it rendered an image only if `product.image` existed, but the live product list API returned `image: null` for the affected migrated products while the real image paths were present in the `images` array. Second, it linked cards to `/products/{slug}`, while the live product-detail route is `/product/{slug}`.

| Product | API `image` Field | Valid Image Source Found | Old Link | Correct Link |
|---|---|---|---|---|
| Passage Lamp - Red | `null` | `/media/wordpress-migration/2025/05/Passage-Lamp-Red.jpeg` | `/products/passage-lamp-red` | `/product/passage-lamp-red` |
| Passage Refill Lamparfum - cachemire | `null` | `/media/wordpress-migration/2025/05/cachemire.jpeg` | `/products/passage-refill-lamparfum-cachemire` | `/product/passage-refill-lamparfum-cachemire` |
| Passage Mini Lighter - Silver | `null` | `/media/wordpress-migration/2025/05/mini-lighter-silver.jpeg` | `/products/passage-mini-lighter-silver` | `/product/passage-mini-lighter-silver` |
| Mini Roshina Beige | `null` | `/media/wordpress-migration/2025/02/Mini-Roshina-1.jpg` | `/products/mini-roshina-beige` | `/product/mini-roshina-beige` |

## Fix Applied

I patched the CMS product-grid block so homepage cards now use the same proven image fallback strategy as the shop product cards. The renderer now derives the main image from the product data safely instead of relying only on `product.image`.

The product-card link was also corrected from the invalid plural route to the valid singular product-detail route.

| File Patched | Change |
|---|---|
| `client/src/components/cms/BlockRenderer.tsx` | Added safe product image resolver for `image` and `images` fields |
| `client/src/components/cms/BlockRenderer.tsx` | Updated homepage product-card image rendering to use the resolved image |
| `client/src/components/cms/BlockRenderer.tsx` | Updated product-card navigation from `/products/${product.slug}` to `/product/${product.slug}` |

## Deployment Evidence

The live file was backed up before replacement. The deployment then rebuilt the storefront bundle and restarted the PM2 process.

| Item | Result |
|---|---|
| Remote backup | `/home/manus/cove-storefront/client/src/components/cms/BlockRenderer.tsx.backup_homepage_card_fix_20260526_1308` |
| Build command | `pnpm build` completed successfully |
| Frontend bundle | Rebuilt successfully with Vite |
| Server bundle | Rebuilt successfully with esbuild |
| Process manager | PM2 restarted `cove-storefront` |
| Runtime status | `cove-storefront` online |

## Validation Results

I reloaded the homepage with a cache-busting URL after deployment:

`https://app.coveinterior.com/?homepage_card_fix=20260526T1308`

The Featured Products block now renders visible images for the products that were blank in the screenshot. The rendered page also confirms product-card links now use `/product/{slug}`.

I also opened a corrected product route directly:

`https://app.coveinterior.com/product/passage-lamp-red?homepage_card_fix=20260526T1310`

The page rendered the real product detail view, including the product image, SKU, product title, price, quantity controls, and `ADD TO CART`. It did **not** render the 404 page.

| Validation Target | Result |
|---|---|
| Homepage Featured Products image rendering | Passed |
| Passage Lamp card image | Passed |
| Passage Refill card image | Passed |
| Passage Mini Lighter card image | Passed |
| Roshina/Mini Roshina card images | Passed |
| Product-card route format | Passed, now `/product/{slug}` |
| Direct product-detail route | Passed, no 404 |

## Notes

One product card, **Roshina 1 Beige Basic set + Roshina Mubkhar**, is currently using a safe placeholder image because its primary listing image data is not usable in the same way as the others. This is not the same as the previous blank-card bug: the card now displays an image area correctly and links correctly. If desired, the next cleanup step would be to assign a proper primary product image for any products still falling back to placeholders.

## Supporting Files

| File | Purpose |
|---|---|
| `/home/ubuntu/cove_work/wp_inventory/homepage_product_cards_issue_20260526.md` | Investigation notes, root-cause evidence, and validation log |
| `/home/ubuntu/cove_work/wp_inventory/homepage_product_cards_deploy_20260526.log` | Deployment build, backup, and PM2 restart log |
| `/home/ubuntu/cove_work/wp_inventory/Homepage_Product_Cards_Image_and_404_Repair_Report_20260526.md` | This completion report |
