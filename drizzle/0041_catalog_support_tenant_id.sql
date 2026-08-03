ALTER TABLE `product_translations` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `product_translations` ADD KEY `product_translations_tenantId_idx` (`tenantId`);

ALTER TABLE `category_translations` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `category_translations` ADD KEY `category_translations_tenantId_idx` (`tenantId`);

ALTER TABLE `attribute_translations` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `attribute_translations` ADD KEY `attribute_translations_tenantId_idx` (`tenantId`);

ALTER TABLE `variant_name_translations` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `variant_name_translations` ADD KEY `variant_name_translations_tenantId_idx` (`tenantId`);

ALTER TABLE `attribute_value_stock` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `attribute_value_stock` ADD KEY `av_stock_tenantId_idx` (`tenantId`);

ALTER TABLE `product_attributes` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `product_attributes` ADD KEY `product_attributes_tenantId_idx` (`tenantId`);

ALTER TABLE `product_variant_localizations` ADD COLUMN `tenantId` int NOT NULL DEFAULT 1;
ALTER TABLE `product_variant_localizations` ADD KEY `variant_localizations_tenantId_idx` (`tenantId`);
