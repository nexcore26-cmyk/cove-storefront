CREATE TABLE `attribute_value_bundle_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attributeValueId` int NOT NULL,
	`productId` int NOT NULL,
	`qty` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attribute_value_bundle_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attribute_value_stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attributeValueId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attribute_value_stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `av_stock_value_warehouse_unique` UNIQUE(`attributeValueId`,`warehouseId`)
);
--> statement-breakpoint
CREATE TABLE `attribute_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attributeId` int NOT NULL,
	`labelEn` varchar(255) NOT NULL,
	`labelAr` varchar(255),
	`swatch` varchar(512),
	`image` text,
	`galleryImages` json DEFAULT ('[]'),
	`price` decimal(12,3),
	`salePrice` decimal(12,3),
	`cog` decimal(12,3),
	`shippingClass` varchar(128),
	`weight` decimal(8,3),
	`dimL` decimal(8,2),
	`dimW` decimal(8,2),
	`dimH` decimal(8,2),
	`isBundle` boolean NOT NULL DEFAULT false,
	`manageStock` boolean NOT NULL DEFAULT false,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attribute_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`displayType` enum('button','color','image') NOT NULL DEFAULT 'button',
	`descriptionEn` text,
	`descriptionAr` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attributes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_attributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`attributeId` int NOT NULL,
	`activeValueIds` json DEFAULT ('[]'),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_attributes_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_attributes_product_attr_unique` UNIQUE(`productId`,`attributeId`)
);
--> statement-breakpoint
CREATE INDEX `avbi_attributeValueId_idx` ON `attribute_value_bundle_items` (`attributeValueId`);--> statement-breakpoint
CREATE INDEX `avbi_productId_idx` ON `attribute_value_bundle_items` (`productId`);--> statement-breakpoint
CREATE INDEX `attr_values_attributeId_idx` ON `attribute_values` (`attributeId`);--> statement-breakpoint
CREATE INDEX `product_attributes_productId_idx` ON `product_attributes` (`productId`);