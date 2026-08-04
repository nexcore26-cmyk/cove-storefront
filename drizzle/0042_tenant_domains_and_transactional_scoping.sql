-- Phase A (tenant resolution groundwork): add tenants.rootDomain for
-- Host-header-based tenant resolution, and add tenantId to the remaining
-- transactional tables that didn't get it in Phase 1a/1b (schema only —
-- no query changes yet, defaults to 1, nothing changes behaviorally).

ALTER TABLE `tenants` ADD COLUMN `rootDomain` varchar(255);
ALTER TABLE `tenants` ADD UNIQUE KEY `tenants_rootDomain_unique` (`rootDomain`);
UPDATE `tenants` SET `rootDomain` = 'coveinterior.com' WHERE `id` = 1;

ALTER TABLE `warehouses` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `warehouses` ADD KEY `warehouses_tenantId_idx` (`tenantId`);

ALTER TABLE `customers` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `customers` ADD KEY `customers_tenantId_idx` (`tenantId`);

ALTER TABLE `orders` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `orders` ADD KEY `orders_tenantId_idx` (`tenantId`);

ALTER TABLE `carts` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `carts` ADD KEY `carts_tenantId_idx` (`tenantId`);

ALTER TABLE `cart_items` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `cart_items` ADD KEY `cart_items_tenantId_idx` (`tenantId`);
