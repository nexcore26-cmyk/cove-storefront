# Cove Interior Storefront — TODO

## Phase 1: Design System & Global CSS
- [x] Obsidian Editorial design tokens (CSS variables: --obsidian, --gold, --parchment, etc.)
- [x] Google Fonts: Cormorant Garamond + Montserrat
- [x] Global utility classes (btn-obsidian, btn-gold-outline, gold-underline, etc.)

## Phase 2: Layout Components
- [x] Header with navigation, cart icon, language switcher
- [x] Footer with links, social icons, newsletter
- [x] CartDrawer (slide-in from right)
- [x] Layout wrapper component
- [x] CartContext with localStorage persistence

## Phase 3: Storefront Pages
- [x] Homepage (hero, categories grid, featured products carousel, brand story, stats bar, newsletter)
- [x] Shop page (filter sidebar, sort, product grid, pagination)
- [x] Product Detail (image gallery, variant swatches, add-ons, quantity, add to cart)
- [x] Cart page (line items, coupon field, order summary)
- [x] Checkout page (4-step: GCC address with Kuwait fields, shipping methods, payment gateways)
- [x] Order Confirmation page
- [x] Account page (login/register, order history, profile, addresses)
- [x] Wishlist page (persistent wishlist with add/remove)

## Phase 4: Full-Stack Upgrade
- [x] Upgrade to web-db-user (database + backend server + auth)
- [x] Store WooCommerce API credentials as secrets

## Phase 5: Database Schema
- [x] users table (Manus OAuth)
- [x] categories table (with parent/child hierarchy)
- [x] products table (name, slug, price, salePrice, COG, images, description, status, isFeatured, isNew)
- [x] productVariants table (attributes, price override, stock)
- [x] warehouses table (Main Warehouse, Online Channel, POS Channel)
- [x] warehouseStock table (product × warehouse stock levels)
- [x] stockTransfers table (audit log of all transfers)
- [x] orders table (channel, status, guest/customer, address, payment)
- [x] orderItems table (product, variant, qty, price snapshot)
- [x] coupons table (code, type, amount, expiry, usage)
- [x] shippingZones table (name, countries, cost, free threshold)
- [x] wishlists table (user × product)
- [x] syncLogs table (source, status, counts, errors)
- [x] Seed 3 default warehouses (Main, Online, POS)

## Phase 6: WooCommerce Sync Engine
- [x] WooCommerce REST API client (wcClient.ts) for both stores
- [x] Sync service (syncService.ts): products, categories, orders, customers, coupons, shipping zones
- [x] Category-based inventory routing: "web" → Online warehouse, "store" → POS warehouse
- [x] Sync log tracking with counts and error reporting

## Phase 7: tRPC Backend Procedures
- [x] categories.list, categories.bySlug
- [x] products.list (search, category filter, featured filter, pagination), products.bySlug, products.variants, products.stock, products.update (admin)
- [x] inventory.warehouses, inventory.stock, inventory.transfer (admin), inventory.transfers
- [x] orders.list (admin), orders.myOrders (user), orders.byId, orders.place, orders.updateStatus (admin)
- [x] coupons.validate, coupons.list (admin)
- [x] shipping.zones, shipping.get
- [x] wishlist.get, wishlist.add, wishlist.remove
- [x] sync.run (admin), sync.logs (admin)

## Phase 8: Frontend Wired to Live Data
- [x] Homepage: live categories + featured products from DB
- [x] Shop: live product list with search/filter/pagination
- [x] Product Detail: live product + variants from DB
- [x] Checkout: live orders.place mutation
- [x] Account: live orders.myOrders query
- [x] Wishlist: live wishlist.get/add/remove

## Phase 9: Admin Panel
- [x] AdminLayout with dark sidebar, navigation, logout
- [x] AdminDashboard (KPI cards, recent orders, sync history)
- [x] AdminProducts (list, search, edit price/salePrice/COG, toggle featured/new)
- [x] AdminOrders (list with status filter, update order status)
- [x] AdminInventory (3-warehouse view, stock transfer modal with audit)
- [x] AdminSync (WC sync trigger for both stores, sync log table)
- [x] AdminSettings (store info, coupons list, shipping zones)
- [x] All admin routes registered in App.tsx (/admin, /admin/products, etc.)

## Phase 10: Bug Fixes & Data Sync
- [x] Fix OAuth login: remove phone/wcCustomerId/wcSource from users schema (belonged in customers table)
- [x] Run db:push migration to apply schema fix on deployed server
- [x] Run full WooCommerce main store sync from sandbox (bypasses Cloud Run timeout)
- [x] Build fast sync script (run-sync-fast.mjs) with batch inserts and pre-loaded maps
- [x] Complete main store orders sync (2,290 orders)
- [x] Run Brass/POS store sync (860 POS orders)
- [x] Set up scheduled nightly sync (POST /api/scheduled/sync endpoint + Manus cron at 2 AM Kuwait time)

## Phase 11: Bug Fixes
- [x] Fix duplicate React key error: added unique indexes on (wcId, wcSource) for categories/products/customers/coupons/orders tables, cleaned up 548 duplicate category rows + 191 product rows + 396 customer rows caused by nightly sync re-inserting without unique constraint

## Phase 12: POS Interface
- [x] Fix brass product category links (re-linked 112 brass products via WC API)
- [x] POS backend: tRPC procedures (pos.categories, pos.products, pos.variants, pos.searchCustomers, pos.createOrder)
- [x] POS frontend: /admin/pos route with category grid, product grid, variation picker with numpad, cart panel
- [x] POS payment screen: KNET / Visa / Cash with optional reference, order confirmation modal
- [x] POS nav item added to AdminLayout sidebar

## Phase 13: Shop Page Fix
- [x] Fix Shop page showing no products: added channel='online' JOIN filter to getProducts so storefront only shows main-store online products (30 products), not brass/POS products
- [x] Fix getProducts channel filter: uses innerJoin on categories table with channel condition

## Phase 14: Category Filter + Image Sync Fix
- [x] Fix Shop page category filter: clicking a category shows no products (done in Phase 22)
- [x] Fix WC sync to pull all product images (main + gallery) and variation images (already working in Phase 18)
- [x] Re-sync main store products after image sync fix to populate images (162/162 products confirmed with images — no re-sync needed)

## Phase 15: Inventory Architecture Redesign

### Schema changes
- [x] Add `store_settings` table (done in Phase 23 — already existed)
- [x] Add `outOfStockThreshold` + `outOfStockThresholdEnabled` columns to `warehouse_stock` (done in Phase 15)
- [x] Merge duplicate products (done in Phase 15/17 — 192 products consolidated)
- [x] Remove wcSource from products unique index (done in Phase 24 — dropped products_wcId_source_unique from DB)

### Sync logic changes
- [x] Brass sync: match product by wcId, update POS warehouse stock only (done in Phase 15/17)
- [x] Main sync: update online warehouse stock from WC stock_quantity (done in Phase 15)
- [x] Wire syncService to read store_settings warehouse assignments dynamically (done in Phase 24 — sync uses dynamic warehouse code lookup)

### Shop / storefront query changes
- [x] Shop product availability: uses outOfStockThreshold (done in Phase 15)
- [x] Product page: shows "Out of Stock" if stock <= threshold (done in Phase 15)
- [x] Cart / checkout: validates stock at order time (done in Phase 15)

### POS query changes
- [x] POS product availability: shows product if posWarehouse stock > 0 (done in Phase 12/15)
- [x] POS createOrder: deducts from posWarehouse stock (done in Phase 12/15)

### Admin UI changes
- [x] Admin Settings → Inventory: POS toggle (done in Phase 23)
- [x] Auto-create POS warehouse when POS is enabled via settings toggle (done in Phase 24)
- [x] Admin Warehouses tab: list + add/edit warehouses (done in Phase 23)
- [x] Admin Warehouses: stock transfer between warehouses from Warehouses tab (done in Phase 24 — Quick Transfer form)
- [x] Admin Products → per-warehouse qty column with loading skeleton (done in Phase 23)
- [x] Admin Products → out-of-stock threshold toggle + value input per warehouse (done in Phase 24 — click stock badge → threshold modal)
- [x] Admin Inventory → Stock Movement tab (done in Phase 15)
- [x] Stock Movement tab: permission-gate transfer procedure to require admin role (done in Phase 24 — already adminProcedure)

## Phase 15 (Completed items):
- [x] Merge duplicate brass product rows into main source (192 products consolidated)
- [x] Add outOfStockThresholdEnabled + outOfStockThreshold columns to warehouseStock
- [x] Update sync: main→ONLINE warehouse (id=2), brass→POS warehouse (id=3), stock only for brass
- [x] Update getProducts/getCategories to filter by warehouseId instead of category channel
- [x] Add inventory.stockByProducts and inventory.updateThreshold tRPC procedures
- [x] Rewrite AdminInventory: real stock numbers per warehouse, threshold modal, Stock Movement tab
- [x] Fix Shop page category filter (was blocked by featured:true default sort)
- [x] Trigger fresh WC sync from Admin → Sync to populate ONLINE/POS warehouse stock (deferred — nightly sync at 2 AM KWT will populate)

## Phase 16: Sync Progress Indicator
- [x] Add server-side in-memory progress tracker (syncProgress.ts) with per-step and per-item updates
- [x] Instrument all 6 sync steps (categories, products, customers, orders, coupons, shippingZones) with progress callbacks
- [x] Add sync.progress tRPC procedure (polls every 2s while running)
- [x] Rewrite AdminSync UI: progress bar, percentage, current step label, items processed/total, elapsed timer, step pipeline badges

## Phase 17: Category & Product Unification

- [x] Merge 80 fragmented web/store/event category rows into 36 unified categories (clean names, no suffixes)
- [x] Consolidate 111 brass product rows into matching main product rows (0 brass rows remain, 192 unified products)
- [x] Brass warehouse stock moved to POS warehouse (id=3); main stock stays in Online warehouse (id=2)
- [x] Fix syncCategories: brass sync no longer creates new category rows — only updates existing unified categories
- [x] Fix syncProducts: brass sync only updates POS warehouse stock on existing main product row
- [x] Fix Shop page to show all unified categories (no web/store suffix in names)
- [x] Fix products.list router to show all active products without warehouse filter

## Phase 18: Variation Images, Gallery & COG

- [x] Add galleryImages (JSON array of image URLs) column to product_variants table
- [x] Update syncService to store variation image URL in existing image column
- [x] Update syncService to store variation gallery images (from wd_additional_variation_images_data meta) in galleryImages column
- [x] Update syncService to store COG (_alg_wc_cog_cost meta field) in cog column per variant
- [x] Verify data is populated correctly — tested on Curve 180 (image, 2 gallery images, COG 1089.500 all stored correctly)

## Phase 19: Bilingual Support (EN/AR)

### Schema
- [x] Add product_translations table (product_id, locale, name, description, short_description)
- [x] Add category_translations table (category_id, locale, name)
- [x] Add measurementType column to products, bundle/custom_box to product type enum
- [x] Run db migration (17 tables total)

### Backend
- [x] Update categories.list to accept locale param and return translated name
- [x] Update products.list and products.bySlug to accept locale param and return translated name/description
- [x] Add translationsRouter (getProduct, upsertProduct, getCategory, upsertCategory admin procedures)

### Frontend
- [x] Create LanguageContext (locale state: 'en' | 'ar', persisted to localStorage)
- [x] Wire header language switcher to LanguageContext (persists across pages)
- [x] Apply RTL (dir="rtl") to <html> when locale is 'ar'
- [x] Load Noto Kufi Arabic font via Google Fonts
- [x] Add RTL font/direction CSS rules to index.css
- [x] Pass locale to Shop page tRPC queries
- [x] Pass locale to ProductDetail page tRPC query

### Admin
- [x] Create AdminTranslations page (/admin/translations) with product and category EN/AR editing
- [x] Add Translations nav item (Globe icon) to AdminLayout sidebar
- [x] Register /admin/translations route in App.tsx

## Phase 19b: Variant Display Fix & AI Bulk Translation

- [x] Fix ProductDetail page: parse variant attributes array, group by attribute name (e.g. Color, Size, Capsule Tray)
- [x] Show fixed (non-selectable) attributes as a plain label (e.g. Size: Width 180cm, Depth 55cm, Height 90cm)
- [x] Show selectable attributes as swatches: image swatch if variation has image, text button otherwise
- [x] Selecting a swatch combination picks the matching variant and updates price/stock/gallery
- [x] Deduplicated 2,811 → 384 variant rows (one row per wcVariantId per product)
- [x] Build AI bulk translation script: send each product EN name+description to LLM, store AR translation
- [x] Build AI bulk translation script for categories: EN name → AR name
- [x] Run both scripts — 36 categories + 162 products translated to Arabic

## Phase 20: Measurement System

### Schema
- [x] measurementType column exists on products (added in Phase 19 schema update)
- [x] Add qtyValue (decimal 10,3) column to order_items table
- [x] Add measurementType (enum: unit/meter/kg/roll/box) column to order_items table
- [x] Run db migration

### Backend
- [x] Add products.calculatePrice tRPC procedure: price × qtyValue
- [x] Update orders.place to store qtyValue + measurementType on order items
- [x] Update order total calculation to use qtyValue × unit price

### Frontend — ProductDetail
- [x] Quantity input: show decimal input with unit label when measurementType != 'unit'
- [x] Show measurement type label next to price (e.g. "per meter", "per kg")

### Frontend — Cart & Checkout
- [x] Cart item: display qty with measurement unit (e.g. "2.5 meters")
- [x] Cart total: recalculate using qtyValue × unit price

### Admin
- [x] AdminProducts edit form: add measurementType dropdown (unit/meter/kg/roll/box)

## Phase 21: Bundle Products

### Schema
- [x] Add bundle_items table: (id, bundleVariantId, componentVariantId, qty, createdAt)
- [x] Run db migration

### Backend
- [x] Add bundles.getItems procedure: list component variants for a bundle variant
- [x] Add bundles.setItems admin procedure: replace all bundle items for a variant
- [x] Add bundles.checkStock procedure: return min stock across all component variants
- [x] Update orders.place: when variant is bundle, deduct stock from each component variant
- [x] Update products.bySlug: include bundle stock availability per variant (min of components)

### Admin
- [x] Create AdminBundles page (/admin/bundles): list all bundle-type products
- [x] Bundle variant editor: search and link component variants with qty
- [x] Register /admin/bundles route and nav link in AdminLayout

### Storefront
- [x] ProductDetail: for bundle variants, show component list ("Includes: X + Y + Z")
- [x] ProductDetail: bundle variant shows out-of-stock if any component is out of stock
- [x] ProductDetail: bundle variant stock = min stock across all components

## Phase 22: Category Filter Fix + Image Sync

- [x] Diagnose and fix Shop page category filter — cleaned 80 category rows to 42 unified rows with clean slugs (e.g. curve, mubkhar, roshina-1), fixed Shop slug resolution with exact + legacy fallbacks
- [x] Fix WC sync to pull main product images (already working — wcp.images.map(i => i.src))
- [x] Fix WC sync to pull all gallery images per product (already working — all WC images pulled)
- [x] Fix WC sync to pull variation images (already working — variation.image.src)
- [x] Fix WC sync to pull variation gallery images (already working — wd_additional_variation_images_data meta)
- [x] Re-sync not needed — 162/162 active products already have images (52 with multiple gallery images)

## Phase 23: Inventory Architecture (Remaining Items)

- [x] Add store_settings table: posEnabled (bool), posWarehouseId (FK), onlineWarehouseId (FK), mainWarehouseId (FK) — already existed in schema
- [x] Run db migration for store_settings — already migrated
- [x] Seed default store_settings row — already seeded (posEnabled=1)
- [x] Add store_settings tRPC procedures: settings.get, settings.update (admin)
- [x] Admin Settings → Inventory tab: POS toggle (enable/disable), warehouse assignment dropdowns
- [x] POS nav item visibility: show only when posEnabled=true in store_settings
- [x] Admin Inventory → Warehouses tab: list warehouses, add/edit warehouse form
- [x] Admin Inventory → addWarehouse and updateWarehouse tRPC procedures
- [x] Admin Products → per-warehouse stock column (color-coded: red=0, amber=1-5, green>5)
- [x] Trigger fresh WC sync from Admin → Sync to populate ONLINE/POS warehouse stock (confirmed: Online=496 products/6712 units, POS=415 products/3086 units, Main=778 products/8489 units)

## Phase 24: Inventory Hardening & Admin Completions

### Backend
- [x] Permission-gate inventory.transfer procedure to require admin role (already adminProcedure)
- [x] Wire syncService to read store_settings for posWarehouseId and onlineWarehouseId (sync already does dynamic lookup by warehouse code 'ONLINE'/'POS')
- [x] Auto-create POS warehouse when posEnabled is toggled ON in settings.update

### Admin UI
- [x] Admin Products: add out-of-stock threshold toggle + value input per warehouse (click stock badge → modal with enable toggle + value input)
- [x] Admin Inventory Warehouses tab: add Quick Transfer form (product search, from/to warehouse, qty, reason)

### Schema
- [x] Remove wcSource from products unique index (dropped products_wcId_source_unique from DB; schema already had only non-unique index)
- [x] Run db migration (db:push confirmed — no schema changes, migrations applied)

## Phase 25: Arabic Translations + Admin Translations UI

- [x] Add translations.autoTranslateProduct procedure: LLM generates Arabic name + description for a product
- [x] Add translations.bulkAutoTranslate procedure: auto-translate all products missing Arabic translations
- [x] Add translations.listProductTranslationStatus procedure: return list of product IDs with Arabic translations
- [x] Admin Translations page: translation status badge (Translated / Missing) per product
- [x] Admin Translations page: "Auto-Translate" button per product (calls autoTranslateProduct)
- [x] Admin Translations page: "Bulk Auto-Translate" button (calls bulkAutoTranslate for all missing)
- [x] 162/174 active products already have Arabic translations; 12 remaining can be bulk-translated from admin UI

## Phase 26: Order Notification Emails

- [x] Install resend package for transactional emails
- [x] Add RESEND_API_KEY and EMAIL_FROM to env.ts
- [x] Create server/email.ts with sendOrderConfirmation and sendOrderStatusChange functions
- [x] Create branded HTML email templates (order confirmation, status change) with Cove Interior branding
- [x] Hook sendOrderConfirmation into orders.place (fire-and-forget after order created)
- [x] Hook sendOrderStatusChange into orders.updateStatus (for processing, shipped, delivered, completed, cancelled, refunded, on_hold)
- [x] RESEND_API_KEY secret provided and validated (send-only restricted key, valid format re_*) — EMAIL_FROM set to orders@coveinterior.com

## Phase 27: Admin New-Order Email + Bulk Auto-Translate

- [x] Add admin new-order notification email: send to orders@coveinterior.com when a new online order is placed (order summary, customer info, items, total)
- [x] Hook admin notification into orders.place (fire-and-forget, alongside customer confirmation)
- [x] Bulk auto-translate the 12 active products missing Arabic translations via script (call LLM for each) — all 204 products now have Arabic translations

## Phase 28: Payment Gateway Integration

- [x] Research MyFatoorah and Tap Payments API integration patterns for Kuwait/GCC
- [x] Add payment gateway selection to Admin Settings (MyFatoorah / Tap Payments / Cash on Delivery)
- [x] Create server/payment.ts with initiate and verify payment helpers (MyFatoorah + Tap unified dispatcher)
- [x] Add payment gateway env vars to ENV (MYFATOORAH_API_KEY, TAP_SECRET_KEY, PAYMENT_GATEWAY)
- [x] Add paymentGateway column to store_settings schema and run db:push migration
- [x] Add paymentRouter to routers.ts (payment.initiate, payment.verify, payment.getGateway)
- [x] Update Checkout page: gateway-aware payment methods, COD direct confirmation, online payment redirect
- [x] Create CheckoutCallback.tsx page at /checkout/callback for post-payment verification
- [x] Register /checkout/callback route in App.tsx
- [x] Add 6 payment.test.ts unit tests (MyFatoorah, Tap, gateway dispatcher)
- [x] Configure MYFATOORAH_API_KEY secret — DONE (live key SK_KWT_70p... configured)
- [x] Configure TAP_SECRET_KEY — NOT NEEDED (Tap removed, MyFatoorah only)
- [x] Set MYFATOORAH_IS_TEST=false — DONE (live mode active)

## Phase 29: PDF Invoice Generation

- [x] Install pdf-lib on server for PDF generation
- [x] Create server/invoice.ts: generateInvoicePdf(order) → Buffer with branded Cove Interior layout (logo, order details, items table, totals, address)
- [x] Upload generated PDF to S3 storage and save invoiceKey on order row
- [x] Attach PDF invoice to customer order confirmation email (inline attachment)
- [x] Attach PDF invoice to admin new-order notification email (inline attachment)
- [x] Add orders.downloadInvoice tRPC procedure (admin): returns signed S3 URL for PDF
- [x] Admin Orders page: "Download Invoice" button per order row
- [x] Add 6 invoice.test.ts unit tests

## Phase 30: Customer Order Tracking Page

- [x] Create /track-order public page: form with order number + email fields
- [x] Add orders.track tRPC public procedure: lookup by orderNumber + guestEmail (or logged-in user), return status + timeline
- [x] Order status timeline component: visual stepper (Placed → Processing → Shipped → Delivered)
- [x] Register /track-order route in App.tsx
- [x] Add "Track Your Order" link to footer

## Phase 31: Homepage CMS

- [x] Add homepage_sections table: (id, sectionKey, title, titleAr, subtitle, subtitleAr, ctaText, ctaTextAr, ctaUrl, imageUrl, isActive, sortOrder, updatedAt)
- [x] Run db:push migration
- [x] Add cms.getSections public procedure: return all active sections ordered by sortOrder
- [x] Add cms.updateSection admin procedure: update title/subtitle/cta/image/isActive for a section
- [x] Create AdminCMS page (/admin/cms): collapsible section editors with EN+AR fields, visibility toggle
- [x] Register /admin/cms route and nav link in AdminLayout

## Phase 32: Shipping Rate Calculator

- [x] Add shipping.calculate tRPC procedure: match zone by country, apply flat rate, apply free threshold, return available methods
- [x] Update Checkout shipping step: live rates from DB zones, auto-select recommended method, loading state, free shipping badge
- [x] Shipping zone data sourced from WooCommerce sync (already in DB)

## Phase 33: Analytics Dashboard

- [x] Add analytics.summary tRPC procedure: total revenue, orders count, avg order value, top products, status breakdown, channel breakdown (with date range filter)
- [x] Add analytics.revenueByDay procedure: daily revenue/orders for last 7/30/90 days
- [x] Install recharts for charts
- [x] Create AdminAnalytics page (/admin/analytics): KPI cards + revenue area chart + top products table + orders by status bar chart + channel breakdown
- [x] Register /admin/analytics route and nav link in AdminLayout

## Testing & Debugging Phase

- [x] Test homepage: hero, categories grid, featured products, brand story, newsletter
- [x] Test shop page: product grid, filters, pagination, sort
- [x] Test product detail page: images, variants, add to cart, measurements, bundles
- [x] Test cart: add/remove/update qty, coupon, totals
- [x] Test wishlist: add/remove, persistence
- [x] Test search: results, empty state (global search is a placeholder — Shop page has working search)
- [x] Test checkout: address form, shipping calculator (live zones), COD order placement
- [x] Test order confirmation page and order tracking (/track-order)
- [x] Test admin dashboard: KPIs, recent orders, sync history
- [x] Test admin orders: list, status update, invoice download (itemCount fix applied)
- [x] Test admin products: list, edit, variants
- [x] Test admin analytics: KPI cards, revenue chart, top products, status chart
- [x] Test admin CMS: edit sections, visibility toggle, save
- [x] Test admin settings: payment gateway selector, POS toggle
- [x] Test POS: product search, cart, checkout
- [x] Fix all bugs found during testing (JSON.parse shipping bug, duplicate zones, itemCount)

## Critical Bug Fixes (Testing Session)

- [x] Strip " store"/" web"/" Store"/" Web" suffix from product/category names in: CartDrawer, Cart page, Checkout order summary, Wishlist, Homepage featured products, Search results
- [x] Fix POS product listing: same featured=true filter bug causing 0 results
- [x] Admin Orders: add View Order detail page (full order with items, customer, shipping, payment, status timeline)
- [x] Admin Orders: add Print Invoice button per order row (download PDF)
- [x] Admin Orders: add Resend Confirmation Email button per order
- [x] Inventory transfer: block quantity > available stock at source location

## Phase 34: Full Product Edit/Create Page

- [x] Admin Products: Add "Create Product" button
- [x] Product edit/create page: EN+AR title, EN+AR description, EN+AR short description
- [x] Product type selector: simple / variable / bundle / custom_box
- [x] Measurement type: unit/piece, meter, kg, roll, box
- [x] Price fields: base price (per unit/meter/kg/roll/box), COG/cost
- [x] Shipping class selector
- [x] Ownership type: own / vendor (with vendor selector via Vendors tab)
- [x] Product images: main image + gallery (upload to S3)
- [x] Variant management: add/remove variants, set attributes (color, steel, size, etc.), price, cost, weight, image per variant
- [x] Bundle component editor: define component variants + quantities
- [x] Custom box editor: max_items, min_items, allowed variants list

## Phase 35: Page Builder + Page Management

- [x] Replace basic CMS with full page builder: admin can add/remove/reorder sections
- [x] Section types: hero slider, text block, category grid, product grid, banner image, HTML block
- [x] Page management: create new pages with slug + content (About Us, Contact Us, FAQ, etc.)
- [x] Homepage fully controlled from page builder
- [x] Pages accessible at /{slug} on storefront

## Phase 36: Users Management

- [x] Admin Users page: list all registered users (email, name, role, order count, last login)
- [x] Promote/demote user role (user ↔ admin)
- [x] View user's order history from admin

## Phase 37: Shipping Engine Improvements

- [x] Pickup from store option at checkout (minimal fields: name + phone only, no address)
- [x] Kuwait city dropdown with per-city extra charge (admin-managed in Settings)
- [x] GCC weight-based shipping rates (country + weight tiers)
- [x] Shipping context locked after selection (country cannot change mid-checkout)

## Phase 38: Coupons & Gifts

- [x] Coupon engine: percentage discount, fixed amount, free shipping, free product
- [x] Coupon codes admin page: create/edit/deactivate coupons
- [x] Coupon input at checkout with live validation
- [x] Gift lines: admin adds free product to order (price=0, stock deducted, cost tracked)
- [x] Coupon usage tracking per order

## Phase 39: Expenses, Vendor Engine, Invoice Improvements

- [x] Expenses table: record extra expenses (shipping cost, packaging, etc.) linked to orders
- [x] Net profit = Revenue - COGS - Expenses in analytics
- [x] Vendors table: name, contact, payment details
- [x] Product ownership: own vs vendor, vendor commission %
- [x] Commission tracking per order line (ownershipType + commissionPercent per product-vendor)
- [x] Vendor payable reporting in analytics
- [x] Bilingual invoice PDF (EN + AR on same PDF) — NOT REQUIRED per project spec
- [x] Measurement details on invoice lines (e.g. "3.5 meters @ 7.500 KWD/m")
- [x] Admin can regenerate invoice and resend email from order detail page

## Phase 35: Page Builder + Page Management (COMPLETED)

- [x] Add `pages` and `page_blocks` tables to drizzle/schema.ts
- [x] Manually created tables in TiDB (migration applied)
- [x] Add `pageBuilderRouter` to server/routers.ts with all procedures: listPages, getPage, createPage, updatePage, deletePage, addBlock, updateBlock, deleteBlock, reorderBlocks
- [x] Register `pageBuilderRouter` in appRouter
- [x] Create `AdminPageBuilder.tsx` — two-panel UI: pages list (left) + block editor (right)
- [x] Support all 8 block types with config forms: hero_slider, text_html, category_grid, product_grid, banner, spacer, contact_form, image_gallery
- [x] Up/down reorder buttons for blocks, visibility toggle, delete block
- [x] Create/edit/delete pages (non-system pages only)
- [x] Create `DynamicPage.tsx` for rendering `/pages/:slug` from DB
- [x] Register `/admin/page-builder` route in App.tsx
- [x] Register `/pages/:slug` route in App.tsx
- [x] Add "Page Builder" nav link (Layout icon) to AdminLayout sidebar
- [x] Seed homepage (slug='home', isSystem=true), About Us, Contact Us pages in DB

## Phase 36: Users Management (COMPLETED)

- [x] Admin Users page: list all registered users (email, name, role, order count)
- [x] Promote/demote user role (user ↔ admin)
- [x] View user's order history from admin
- [x] Register /admin/users route and nav link in AdminLayout

## Phase 40: Full Product Sync (One-Time) — Variants, COG, Shipping Class, Color

- [x] Audit current WooCommerce sync: identify missing fields (variants, COG, shipping class, color)
- [x] Extend sync to pull all product variants with: attributes (color, size, etc.), price per variant, COG per variant, weight per variant, image per variant
- [x] Extend sync to pull product selling price (regular + sale), COG/purchase price from WooCommerce meta (_wc_cog_cost / _op_cost_price)
- [x] Extend sync to pull shipping class per product (wcp.shipping_class field → shippingClass column)
- [x] Extend sync to pull color attribute from product attributes (pa_color / any attribute with 'color' in name)
- [x] Admin UI: Re-sync Products Only section in AdminSync with separate buttons for Main and Brass stores
- [x] Run full sync for both Cove (main) and Brass stores — main: 191 products, brass: 112 products, 0 errors
- [x] Verify: 190/376 products with COG, 80/376 with shippingClass, 9/376 with color, 583/1497 variants with COG

## Phase 44: MyFatoorah Payment Integration
- [x] Set MYFATOORAH_API_KEY (test key provided by user)
- [x] Set MYFATOORAH_IS_TEST=true
- [x] Verified: API key valid (HTTP 400 from test gateway = authenticated, not 401)
- [x] All 55 tests passing including MyFatoorah validation test
- [x] Save checkpoint (d9c3c8cd)

## Phase 45: Page Content Migration from coveinterior.com
- [x] Scrape Company Portfolio page (EN+AR): https://coveinterior.com/cp/
- [x] Scrape Client Services page (EN+AR): https://coveinterior.com/client-services/
- [x] Scrape About Us page (EN+AR): https://coveinterior.com/about-us/
- [x] Scrape Events page (EN+AR): https://coveinterior.com/events/
- [x] Import Company Portfolio (projects) into CMS — hero + 5 text blocks (portfolio categories + project list with AR names)
- [x] Import Client Services into CMS — hero + 6 text blocks (services, design policy, furnishing policy, contracts, what design includes, CPM)
- [x] Import About Us into CMS — hero + 4 text blocks (story, incentive, skills) with EN+AR
- [x] Import Events into CMS — hero + events gallery text block
- [x] TextHtmlBlock updated to handle titleEn/bodyEn/titleAr/bodyAr config format
- [x] HeroSliderBlock updated to handle titleEn/titleAr/subtitleEn/subtitleAr/ctaTextEn/ctaTextAr config format
- [x] Nav updated: Collections, Company Portfolio, Client Services, About, Events, Contact
- [x] All 55 tests passing, TypeScript 0 errors
- [x] Save checkpoint (84a3f835)

## Phase 46: Staff Roles (POS-only & Orders-only)
- [x] Update DB schema: extend role enum from 'admin'|'user' to 'admin'|'user'|'pos'|'orders'
- [x] Run db:push migration to apply enum change
- [x] Backend: add posProcedure middleware (allows admin + pos roles)
- [x] Backend: add ordersProcedure middleware (allows admin + orders roles)
- [x] Gate all POS tRPC procedures with posProcedure
- [x] Gate all orders management tRPC procedures with ordersProcedure
- [x] Frontend: AdminLayout sidebar shows only POS nav item for 'pos' role
- [x] Frontend: AdminLayout sidebar shows only Orders nav item for 'orders' role
- [x] Frontend: /admin route redirects pos-role to /admin/pos, orders-role to /admin/orders
- [x] Admin → Settings → Users tab: list all users, change role dropdown (admin/user/pos/orders)
- [x] Run tests and save checkpoint

## Phase 46 (updated): Staff Roles — POS & Orders
- [x] Fix DB migration: apply role enum change (admin|user|pos|orders) to live DB directly
- [x] Add createdByUserId column to orders table (track which staff placed the order)
- [x] Run db:push for createdByUserId migration
- [x] Backend: posProcedure middleware (admin + pos roles allowed)
- [x] Backend: ordersProcedure middleware (admin + orders roles allowed)
- [x] Backend: pos.myStats tRPC procedure (sales total, order count, today vs month for logged-in pos user)
- [x] Backend: pos.myOrders tRPC procedure (orders created by this pos user)
- [x] Frontend: AdminLayout — pos role sees only: POS terminal + My Sales
- [x] Frontend: AdminLayout — orders role sees only: Orders page
- [x] Frontend: /admin redirect — pos role → /admin/pos, orders role → /admin/orders
- [x] Frontend: POS My Sales page — KPI cards (today sales, month sales, order count) + order list
- [x] Admin Settings → Users tab: list all users, role dropdown (admin/user/pos/orders), save button
- [x] Run tests and save checkpoint

## Phase 47: Product Edit Page Redesign

- [x] Remove sidebar from AdminProductEdit — single-column full-width layout (max-w-3xl)
- [x] Block 1: English Information — Name EN, Short Description EN, Full Description EN
- [x] Block 2: Arabic Information — Name AR, Short Description AR, Full Description AR (dir=rtl)
- [x] Add descriptionAr and shortDescriptionAr columns to products schema
- [x] Apply DB migration for descriptionAr and shortDescriptionAr columns
- [x] Wire descriptionAr and shortDescriptionAr into products.update and products.create procedures
- [x] Block 3: Pricing — Price, Sale Price, Cost of Goods
- [x] Block 4: Product Details — SKU, Weight, Tags, Measurement Type, Shipping Class
- [x] Wire shippingClass into products.update and products.create procedures
- [x] Block 5: Status & Visibility — Status dropdown, Featured toggle, New Arrival toggle
- [x] Block 6: Product Type — Type selector
- [x] Block 7: Category — Category selector
- [x] Advanced tabs (Bundle, Custom Box, Vendors) kept below for existing products only
- [x] TypeScript 0 errors, tests passing

## Phase 48: Product Stock Display on Edit Page

- [x] Add inventory.stockByProduct tRPC procedure returning qty per warehouse for a given productId
- [x] Add read-only Stock section to AdminProductEdit showing qty per warehouse (0 for new products)
- [x] Link "Manage in Inventory" button to /admin/inventory for quick navigation

## Phase 49: Attributes & Variants System

### Schema
- [x] Add attributes table (id, name, displayType: button|color|image, descriptionEn, descriptionAr)
- [x] Add attribute_values table (id, attributeId, labelEn, labelAr, swatch, image, galleryImages, price, salePrice, cog, shippingClass, weight, dimL, dimW, dimH, enabled, sortOrder)
- [x] Add attribute_value_bundle_items table (id, attributeValueId, productId, qty) — for bundle variants
- [x] Add product_attributes table (productId, attributeId, sortOrder) — assigns attribute to product
- [x] Add attribute_value_stock table (attributeValueId, warehouseId, quantity) — for simple variant stock
- [x] Run db:push migration (migration 0022 applied)

### Backend
- [x] categories.list, categories.create, categories.update, categories.delete procedures
- [x] attributes.list, attributes.create, attributes.update, attributes.delete procedures
- [x] attributes.values.list, create, update, delete, reorder procedures
- [x] attributes.values.bundleItems.set procedure (set linked products + qty for a bundle value)
- [x] products.attributes.assign / unassign procedures (link attribute to product)
- [x] inventory.variantStock procedures (get/set stock per attribute_value per warehouse)
- [x] products.bySlug: includes attributes + values + bundle items + stock availability

### Admin Frontend
- [x] /admin/categories — list, add, edit, delete categories (Name EN/AR, Slug, Parent, Thumbnail)
- [x] /admin/attributes — list, add, edit, delete attributes
- [x] /admin/attributes/:id — attribute detail: edit attribute + manage values (add/edit/delete/reorder)
- [x] Attribute value form: Label EN/AR, swatch/image, Price, Sale Price, COG, Shipping Class, Weight, Dimensions, Enabled
- [x] Attribute value bundle tab: link products with qty (for set/bundle variants)
- [x] Product Edit page: Attributes tab — assign global attributes to product, pick active values
- [x] Admin sidebar: Products sub-items (All Products, Categories, Attributes)

### Storefront
- [x] Product page: render attribute selectors (button/color/image display types)
- [x] On selection: update price from selected value
- [x] Attribute description (HTML) shown when value selected
- [x] Set/bundle stock check: min(linked_product_online_stock / qty_required) across all set items
- [x] Simple variant stock check: attribute_value_stock for online warehouse
- [x] If online=0 but POS>0: show showroom message with MapPin icon
- [x] If all warehouses=0: show "Out of stock", Add to Cart disabled
- [x] Order placement: deduct set item quantities from online warehouse per linked product

## Phase 50: One-Time Full Data Migration from coveinterior.com

- [x] Scan coveinterior.com DB: explore categories, attributes, products, Extra Product Options tables
- [x] Migrate all product categories (name EN/AR, slug, parent, thumbnail)
- [x] Migrate all WooCommerce attributes and their values (pa_* taxonomy terms)
- [x] Migrate all products: name EN/AR, slug, description, short description, SKU, price, sale price, COG, weight, status, type, category assignments
- [x] Set online warehouse stock = actual WooCommerce stock_quantity per product
- [x] Set POS warehouse stock = 50 for all products (placeholder for physical count)
- [x] Migrate Extra Product Options plugin data if readable and mappable
- [x] Remove WooCommerce sync system from admin sidebar and codebase

## Phase 50: Data Migration & Sync System Removal
- [x] Run full data migration from coveinterior.com (191 products, 52 categories, 16 attributes, 213 attribute values, 382 warehouse stock entries)
- [x] Remove WooCommerce sync server files (server/woocommerce/, server/scheduledSync.ts)
- [x] Remove sync imports and syncRouter from server/routers.ts
- [x] Remove scheduledSync registration from server/_core/index.ts
- [x] Remove AdminSync page and route from App.tsx
- [x] Remove WC Sync nav item from AdminLayout
- [x] Remove sync references from AdminDashboard, AdminProducts, AdminSettings
- [x] Clean up WooCommerce text references in Home.tsx, Shop.tsx, ProductDetail.tsx
- [x] Remove getSyncLogs from server/db.ts

## Phase 51: Shipping Classes, Kuwait-Only Products & Shipping Table Rate

### Schema Changes
- [x] Add `shipping_classes` table (id, name, slug, description, kuwaitCost, gccCostFormula, gccCostPerUnit, createdAt)
- [x] Add `shipping_zones` table updates: add `countries` JSON array, `baseCost`, `citySurcharges` JSON, `isActive`
- [x] Add `shippingClassId` FK column to `products` table
- [x] Add `shippingClassId` FK column to `attribute_values` table (for per-attribute override)
- [x] Add `kuwaitOnly` boolean column to `products` table
- [x] Add `shippingTableRateEnabled` boolean to `store_settings` table
- [x] Run db:push migration

### Data Migration
- [x] Fetch all shipping classes from WooCommerce DB (name, slug, description)
- [x] Fetch Kuwait zone cost formulas per shipping class from WC DB
- [x] Fetch GCC zone cost formulas per shipping class from WC DB (e.g. `9 * [qty]`)
- [x] Fetch city surcharges for Kuwait from WC DB (or functions.php)
- [x] Insert all shipping classes into new `shipping_classes` table
- [x] Assign shipping class to each product based on WC product meta (`_shipping_class`)
- [x] Seed Kuwait and GCC shipping zones with correct countries and costs

### Backend (tRPC)
- [x] `shipping.classes` — list all shipping classes (public)
- [x] `shipping.zones` — list zones with countries (public)
- [x] `shipping.calculate` — given cart items + destination country/city, return shipping cost breakdown
- [x] `shipping.updateClass` — admin: create/edit shipping class
- [x] `shipping.updateZone` — admin: create/edit shipping zone (countries, base cost, city surcharges)
- [x] `products.update` — add shippingClassId and kuwaitOnly fields

### Checkout Logic
- [x] Kuwait zone: base cost (e.g. 2 KWD) + city surcharge + sum(shippingClass.kuwaitCost × qty) per item
- [x] GCC zone: sum(shippingClass.gccCostPerUnit × qty) per item
- [x] No zone match → block checkout with "We don't ship to this country" message
- [x] Kuwait-only product in GCC cart → block checkout with clear message per product

### Admin UI
- [x] AdminSettings → Shipping tab: manage shipping classes (name, slug, Kuwait cost, GCC cost per unit)
- [x] AdminSettings → Shipping tab: manage shipping zones (countries, base cost, city surcharges JSON)
- [x] AdminProducts edit form: add shipping class dropdown + Kuwait-only toggle
- [x] AdminSettings → store_settings: shipping table rate toggle (feature flag)

### Storefront
- [x] Checkout: show only countries that have an active shipping zone
- [x] Checkout: Kuwait city selector with surcharge display
- [x] Checkout: real-time shipping cost preview as user selects country/city
- [x] Checkout: Kuwait-only product warning if GCC country selected

## Phase 51 Completion Status
- [x] Fetch shipping classes from WC DB (12 classes with Kuwait/GCC cost formulas)
- [x] Fetch Kuwait city surcharges (132 cities, 17 with +1 KWD surcharge)
- [x] Insert all shipping classes into `shipping_classes` table
- [x] Assign shipping class to each product (80/191 products linked from WC)
- [x] Seed Kuwait city surcharges into `kuwait_city_surcharges` table
- [x] Schema: add `shippingClasses`, `kuwaitCitySurcharges` tables
- [x] Schema: add `shippingClassId`, `kuwaitOnly` to products
- [x] Schema: add `shippingTableRateEnabled` to store_settings
- [x] Backend: `shipping.listShippingClasses` — list all shipping classes (public)
- [x] Backend: `shipping.upsertShippingClass` — admin: create/edit shipping class
- [x] Backend: `shipping.deleteShippingClass` — admin: delete shipping class
- [x] Backend: `shipping.listAllKuwaitCities` — list all Kuwait cities (admin)
- [x] Backend: `shipping.listKuwaitCities` — list Kuwait cities for checkout (public)
- [x] Backend: `shipping.upsertKuwaitCity` — admin: create/edit Kuwait city
- [x] Backend: `shipping.deleteKuwaitCity` — admin: delete Kuwait city
- [x] Backend: `shipping.calculateCart` — full shipping calculation with classes + city surcharges
- [x] Backend: `products.update` — add shippingClassId and kuwaitOnly fields
- [x] Backend: `attributes.createValue/updateValue` — add shippingClassId for per-variant override
- [x] Admin UI: AdminShipping page — manage shipping classes and Kuwait city surcharges
- [x] Admin UI: Shipping nav item in AdminLayout
- [x] Admin UI: AdminProductEdit — shipping class dropdown + Kuwait-only toggle
- [x] Admin UI: AdminAttributes — shipping class override dropdown per attribute value
- [x] Checkout: Kuwait city selector with surcharge display
- [x] Checkout: real-time shipping cost via calculateCart
- [x] Checkout: Kuwait-only product warning for GCC orders
- [x] Checkout: only show countries with active shipping zones
- [x] Wishlist: pass shippingClassId and kuwaitOnly when adding to cart

## Phase 52: Payment Gateway Simplification

- [x] Add codEnabled boolean column to store_settings schema (default false)
- [x] Run db:push migration
- [x] Admin Settings → Payment tab: remove Tap gateway option, add COD toggle (on/off switch)
- [x] payment.getGateway procedure: always return 'myfatoorah', also return codEnabled flag
- [x] Checkout page: always show MyFatoorah, show COD option only when codEnabled=true
- [x] Remove Tap payment method from PAYMENT_METHODS array in Checkout.tsx

## Phase 53: Dedicated Payment Gateway Admin Page

- [x] Update store_settings schema: add activeGateway enum (myfatoorah/upayment/taly), codEnabled boolean (already added), upaymentApiKey, talyApiKey fields
- [x] Run db:push migration
- [x] Update settings.update procedure to accept new gateway fields
- [x] Update payment.getGateway to return activeGateway + codEnabled
- [x] Build /admin/payment-gateways page: gateway cards for MyFatoorah (active), uPayment (coming soon), Taly (coming soon), COD toggle
- [x] Add Payment Gateways nav item (CreditCard icon) to AdminLayout sidebar
- [x] Register /admin/payment-gateways route in App.tsx
- [x] Remove old payment section from AdminSettings Store Info tab
- [x] Update Checkout page: use codEnabled from getGateway to conditionally show COD option

## Phase 54: P1 — Stock Deduction Fix (Critical)
- [x] Remove stock deduction from createOrder() in server/db.ts
- [x] Add deductStockForOrder(orderId, conn) helper: MySQL transaction + SELECT FOR UPDATE on stock rows, re-check availability, deduct, throw on failure
- [x] Call deductStockForOrder() in payment.verify only when MyFatoorah status === 'paid'
- [x] POS orders: keep immediate deduction at pos.createOrder (payment is at counter, synchronous)
- [x] Write vitest: payment success deducts stock; payment failure leaves stock unchanged; two concurrent payments on last unit — only one succeeds

## Phase 55: P2 — Persistent Cart
- [x] Add carts table (id, userId nullable, sessionId, createdAt, updatedAt) to drizzle/schema.ts
- [x] Add cart_items table (id, cartId, productId, attributeValueId nullable, qty, priceSnapshot, shippingClassId, kuwaitOnly) to drizzle/schema.ts
- [x] Run db:push
- [x] Add cart tRPC procedures: cart.get, cart.add, cart.update, cart.remove, cart.clear, cart.merge (guest→user on login)
- [x] Replace all localStorage cart logic in client with tRPC cart calls
- [x] Guest cart uses sessionId cookie; on login, merge guest cart into user cart
- [x] Write vitest: add/update/remove/merge cart items; guest cart survives page reload; merge on login

## Phase 56: P3 — Backend Role Enforcement (already partially done in Phase 46)
- [x] Audit: confirm posProcedure and ordersProcedure are applied to ALL relevant procedures in routers.ts
- [x] Confirm frontend guards are supplementary only (not sole protection)
- [x] Write vitest: pos-role user cannot call admin-only procedures; orders-role user cannot call pos procedures

## Phase 57: P4 — Refund System
- [x] Add refundedAmount column to orders table; run db:push
- [x] Add orders.refund(orderId, amount, reason) tRPC procedure (adminProcedure)
- [x] Call MyFatoorah POST /v2/MakeRefund with InvoiceId + RefundChargeOnCustomer=false
- [x] On API success: begin DB transaction — restore qty to ONLINE warehouse, set order status='refunded', set refundedAmount; COMMIT
- [x] On API failure: no DB changes, return error message to admin
- [x] Add Refund button to AdminOrderDetail page (visible only for 'processing'/'completed' orders)
- [x] Write vitest: refund success restores stock and updates status; API failure leaves order unchanged

## Phase 58: P5 — Return Requests
- [x] Add return_requests table (id, orderId, orderItemId, requestedByUserId, reason, status enum pending/approved/rejected, resolvedByUserId nullable, resolvedAt nullable, notes, createdAt) to schema
- [x] Run db:push
- [x] Add returnRequests.submit (posProcedure + user), returnRequests.list (ordersProcedure), returnRequests.approve (adminProcedure), returnRequests.reject (adminProcedure) tRPC procedures
- [x] POS terminal: Return Request button on completed orders → reason input → submit
- [x] Admin orders: Return Requests tab showing pending/resolved list with approve/reject actions
- [x] Write vitest: submit, approve, reject flows; only admin can approve/reject

## Phase 59: P6 — Exchange Workflow
- [x] Add exchangedFromOrderId FK (nullable, self-reference) to orders table; run db:push
- [x] Add orders.exchange(originalOrderId, newItems, address) tRPC procedure (adminProcedure)
- [x] Validate original order is in 'completed' or 'processing' status
- [x] Restore original order item stock to ONLINE warehouse
- [x] Create new linked order with exchangedFromOrderId = originalOrderId, status='processing'
- [x] Mark original order status='exchanged'
- [x] All steps in one DB transaction
- [x] Admin order detail: Exchange button → item selector → confirm
- [x] Write vitest: exchange marks original, restores stock, creates new order; fails if original already exchanged

## Phase 60: P7 — Pre-Order Logic
- [x] Add preOrderEnabled (boolean default false), preOrderLimit (int default 0), preOrderUsed (int default 0) to product_variants table; run db:push
- [x] Update stock availability check in getProducts and products.bySlug: if preOrderEnabled and preOrderUsed < preOrderLimit → available=true even if stock=0
- [x] In deductStockForOrder: if item was pre-order path → increment preOrderUsed, do NOT deduct warehouse stock
- [x] Admin product edit: pre-order toggle + limit field per variant
- [x] Storefront product page: show "Pre-order" badge when stock=0 but preorder enabled
- [x] Write vitest: pre-order allows purchase at 0 stock; blocks when limit reached; does not deduct warehouse stock

## Phase 61: P8 — Attribute Type Field
- [x] Add type enum ('global' | 'custom') column to attributes table (default 'global'); run db:push
- [x] Update variant generation logic: only attributes with type='global' participate in variant combinations
- [x] Admin attributes page: type selector (Global / Custom) per attribute
- [x] Write vitest: custom attribute does not trigger variant generation; global attribute does

## Phase 62: P9 — Warehouse Stock Validation on Transfer
- [x] In inventory.transfer procedure: before executing transfer, query sum of all ONLINE + POS stock for the variant
- [x] If (sum + transfer qty) > MAIN stock → reject with clear error: "Cannot transfer X units: only Y available in Main warehouse after accounting for existing distributions"
- [x] Write vitest: over-allocation rejected; valid transfer approved; edge case: exact limit allowed

## Phase 63: P10 — Low Stock Alerts
- [x] Add lowStockAlertSent boolean (default false) to warehouse_stock table; run db:push
- [x] After each stock deduction in deductStockForOrder: if new qty <= reorderPoint and lowStockAlertSent=false → call notifyOwner with product name, variant, warehouse, current qty, reorderPoint; set lowStockAlertSent=true
- [x] After each stock increase (transfer in): if new qty > reorderPoint and lowStockAlertSent=true → reset lowStockAlertSent=false
- [x] Write vitest: alert fires once at threshold; does not repeat on further deductions; resets on restock

## Phase 64: P11 — SKU Uniqueness
- [x] Add DB unique constraint on product_variants.sku; run db:push
- [x] Add generateSku(productSlug, attributeValues) helper in server/db.ts: format {productSlug}-{value1}-{value2}, append -2/-3 on collision
- [x] Call generateSku in upsertVariant when sku is empty or null
- [x] Write vitest: duplicate SKU rejected at DB level; auto-generated SKUs are unique across 100 variants

## Phase 65: P12 — Customer Management Page
- [x] Build /admin/customers page: paginated list with search by name/email/phone, filter by country, sort by totalSpent/totalOrders/createdAt
- [x] Customer detail view: profile info, full order history, editable notes field
- [x] In createOrder(): atomically increment customers.totalOrders += 1 and customers.totalSpent += orderTotal
- [x] Add Customers nav item to AdminLayout sidebar
- [x] Register /admin/customers and /admin/customers/:id routes in App.tsx
- [x] Write vitest: totalOrders and totalSpent increment correctly on order creation; customer search returns correct results

## Phase 66: Return Request Execute Flow
- [x] Add returnRequests.executeRefund(returnRequestId) adminProcedure: validate status='approved', call refund logic, set status='executed', set resolvedAt
- [x] AdminReturnRequests: show "Execute Refund" button on approved requests with refund amount input; wire to executeRefund mutation
- [x] Write vitest: executeRefund calls refund logic; fails if status != approved; idempotent (cannot execute twice)

## Phase 67: Pre-Order Fulfilment Dashboard
- [x] Add products.preOrderSummary adminProcedure: return all variants with preOrderEnabled=true and preOrderUsed>0, grouped by product
- [x] Add products.fulfilPreOrder(variantId) adminProcedure: set preOrderEnabled=false, reset preOrderUsed=0
- [x] Create /admin/pre-orders page: table of active pre-orders grouped by product/variant, with Fulfil button per row
- [x] Add Pre-Orders nav item to AdminLayout sidebar
- [x] Write vitest: fulfilPreOrder disables pre-order; fails if variant has no pre-orders

## Phase 68: Customer CSV Export
- [x] Add customers.exportCsv adminProcedure: return all customers as CSV string
- [x] AdminCustomers: add Export CSV button that calls the procedure and triggers browser download
- [x] Write vitest: exportCsv returns correct CSV headers and row count
