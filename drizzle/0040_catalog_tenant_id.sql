-- Phase 1a: tenantId on the core catalog tables (schema only — no query changes yet).
-- All default to 1 (Cove Interior, the only tenant today), so nothing changes
-- behaviorally until Phase 1e scopes the actual queries.

ALTER TABLE `categories` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `categories` ADD KEY `categories_tenantId_idx` (`tenantId`);

ALTER TABLE `products` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `products` DROP INDEX `products_slug_unique`;
ALTER TABLE `products` ADD UNIQUE KEY `products_tenant_slug_unique` (`tenantId`, `slug`);
ALTER TABLE `products` ADD KEY `products_tenantId_idx` (`tenantId`);

ALTER TABLE `product_variants` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `product_variants` ADD KEY `variants_tenantId_idx` (`tenantId`);

ALTER TABLE `attributes` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `attributes` ADD KEY `attributes_tenantId_idx` (`tenantId`);

ALTER TABLE `attribute_values` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `attribute_values` ADD KEY `attr_values_tenantId_idx` (`tenantId`);
