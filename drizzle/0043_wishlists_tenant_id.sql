-- Phase D2: add tenantId to wishlists (schema only — no query changes yet).
-- Unlike orders/customers/warehouses/carts/cart_items (which got tenantId in
-- Phase A), wishlists had no tenantId column at all. Same safe additive
-- pattern: defaults to 1, nothing changes behaviorally until Phase D6 scopes
-- the actual getWishlist/addToWishlist/removeFromWishlist queries.

ALTER TABLE `wishlists` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `wishlists` ADD KEY `wishlists_tenantId_idx` (`tenantId`);
