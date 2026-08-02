CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wcId` int,
	`wcSource` enum('main','brass'),
	`name` varchar(255) NOT NULL,
	`nameAr` varchar(255),
	`slug` varchar(255) NOT NULL,
	`parentId` int,
	`description` text,
	`image` text,
	`channel` enum('online','pos','both','none') NOT NULL DEFAULT 'none',
	`displayOrder` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wcId` int,
	`wcSource` enum('main','brass'),
	`code` varchar(128) NOT NULL,
	`description` text,
	`type` enum('percent','fixed_cart','fixed_product') NOT NULL DEFAULT 'percent',
	`amount` decimal(10,3) NOT NULL DEFAULT '0.000',
	`minimumAmount` decimal(10,3),
	`maximumAmount` decimal(10,3),
	`usageLimit` int,
	`usageCount` int DEFAULT 0,
	`usageLimitPerUser` int,
	`individualUse` boolean DEFAULT false,
	`freeShipping` boolean DEFAULT false,
	`expiryDate` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`wcCustomerId` int,
	`wcSource` enum('main','brass'),
	`firstName` varchar(128),
	`lastName` varchar(128),
	`email` varchar(320),
	`phone` varchar(32),
	`country` varchar(4) DEFAULT 'KW',
	`area` varchar(128),
	`block` varchar(32),
	`street` varchar(128),
	`avenue` varchar(128),
	`house` varchar(128),
	`paci` varchar(64),
	`notes` text,
	`totalOrders` int DEFAULT 0,
	`totalSpent` decimal(14,3) DEFAULT '0.000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`variantId` int,
	`wcProductId` int,
	`name` varchar(500) NOT NULL,
	`sku` varchar(128),
	`image` text,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(12,3) NOT NULL,
	`totalPrice` decimal(14,3) NOT NULL,
	`cog` decimal(12,3),
	`variantAttributes` json,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(64) NOT NULL,
	`wcOrderId` int,
	`wcSource` enum('main','brass'),
	`customerId` int,
	`customerName` varchar(256),
	`customerEmail` varchar(320),
	`customerPhone` varchar(32),
	`shippingCountry` varchar(4) DEFAULT 'KW',
	`shippingArea` varchar(128),
	`shippingBlock` varchar(32),
	`shippingStreet` varchar(128),
	`shippingAvenue` varchar(128),
	`shippingHouse` varchar(128),
	`shippingPaci` varchar(64),
	`shippingNotes` text,
	`subtotal` decimal(14,3) NOT NULL DEFAULT '0.000',
	`shippingCost` decimal(10,3) DEFAULT '0.000',
	`discountAmount` decimal(10,3) DEFAULT '0.000',
	`total` decimal(14,3) NOT NULL DEFAULT '0.000',
	`currency` varchar(8) NOT NULL DEFAULT 'KWD',
	`couponCode` varchar(64),
	`status` enum('pending','processing','on_hold','completed','cancelled','refunded','failed','shipped','delivered') NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(64),
	`paymentStatus` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`paymentReference` varchar(256),
	`shippingMethod` varchar(128),
	`trackingNumber` varchar(256),
	`channel` enum('online','pos') NOT NULL DEFAULT 'online',
	`paidAt` timestamp,
	`shippedAt` timestamp,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`wcVariantId` int,
	`sku` varchar(128),
	`name` varchar(255) NOT NULL,
	`attributes` json DEFAULT ('{}'),
	`price` decimal(12,3) NOT NULL DEFAULT '0.000',
	`salePrice` decimal(12,3),
	`cog` decimal(12,3),
	`image` text,
	`weight` decimal(8,3),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wcId` int,
	`wcSource` enum('main','brass'),
	`name` varchar(500) NOT NULL,
	`nameAr` varchar(500),
	`slug` varchar(500) NOT NULL,
	`sku` varchar(128),
	`description` text,
	`shortDescription` text,
	`price` decimal(12,3) NOT NULL DEFAULT '0.000',
	`salePrice` decimal(12,3),
	`cog` decimal(12,3),
	`currency` varchar(8) NOT NULL DEFAULT 'KWD',
	`images` json DEFAULT ('[]'),
	`categoryId` int,
	`tags` json DEFAULT ('[]'),
	`status` enum('active','draft','archived') NOT NULL DEFAULT 'active',
	`type` enum('simple','variable','grouped') NOT NULL DEFAULT 'simple',
	`isFeatured` boolean NOT NULL DEFAULT false,
	`isNew` boolean NOT NULL DEFAULT false,
	`weight` decimal(8,3),
	`dimensionsJson` json,
	`wcRawData` json,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `shipping_zones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wcZoneId` int,
	`name` varchar(128) NOT NULL,
	`countries` json DEFAULT ('[]'),
	`methods` json DEFAULT ('[]'),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromWarehouseId` int NOT NULL,
	`toWarehouseId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`quantity` int NOT NULL,
	`reason` varchar(255),
	`notes` text,
	`status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'completed',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `stock_transfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('main','brass') NOT NULL,
	`type` enum('products','categories','orders','customers','coupons','shipping_zones','full') NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`itemsSynced` int DEFAULT 0,
	`itemsFailed` int DEFAULT 0,
	`errorLog` json DEFAULT ('[]'),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`triggeredBy` int,
	CONSTRAINT `sync_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`warehouseId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`quantity` int NOT NULL DEFAULT 0,
	`reservedQty` int NOT NULL DEFAULT 0,
	`reorderPoint` int DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouse_stock_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`code` varchar(32) NOT NULL,
	`type` enum('main','online','pos') NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`),
	CONSTRAINT `warehouses_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(128),
	`productId` int NOT NULL,
	`variantId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wishlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `wcCustomerId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `wcSource` enum('main','brass');--> statement-breakpoint
CREATE INDEX `categories_slug_idx` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_wcId_idx` ON `categories` (`wcId`);--> statement-breakpoint
CREATE INDEX `coupons_code_idx` ON `coupons` (`code`);--> statement-breakpoint
CREATE INDEX `customers_email_idx` ON `customers` (`email`);--> statement-breakpoint
CREATE INDEX `customers_wcId_idx` ON `customers` (`wcCustomerId`);--> statement-breakpoint
CREATE INDEX `order_items_orderId_idx` ON `order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `orders_orderNumber_idx` ON `orders` (`orderNumber`);--> statement-breakpoint
CREATE INDEX `orders_customerId_idx` ON `orders` (`customerId`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_createdAt_idx` ON `orders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `variants_productId_idx` ON `product_variants` (`productId`);--> statement-breakpoint
CREATE INDEX `products_slug_idx` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_wcId_idx` ON `products` (`wcId`);--> statement-breakpoint
CREATE INDEX `products_sku_idx` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_categoryId_idx` ON `products` (`categoryId`);--> statement-breakpoint
CREATE INDEX `transfers_product_idx` ON `stock_transfers` (`productId`);--> statement-breakpoint
CREATE INDEX `transfers_createdAt_idx` ON `stock_transfers` (`createdAt`);--> statement-breakpoint
CREATE INDEX `stock_warehouse_product_idx` ON `warehouse_stock` (`warehouseId`,`productId`);--> statement-breakpoint
CREATE INDEX `wishlists_userId_idx` ON `wishlists` (`userId`);--> statement-breakpoint
CREATE INDEX `wishlists_sessionId_idx` ON `wishlists` (`sessionId`);