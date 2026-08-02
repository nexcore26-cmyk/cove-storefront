CREATE TABLE `kuwait_city_surcharges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cityName` varchar(128) NOT NULL,
	`cityNameAr` varchar(128),
	`surcharge` decimal(10,3) NOT NULL DEFAULT '0.000',
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kuwait_city_surcharges_id` PRIMARY KEY(`id`),
	CONSTRAINT `kuwait_city_surcharges_cityName_unique` UNIQUE(`cityName`)
);
--> statement-breakpoint
CREATE TABLE `shipping_classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`description` text,
	`kuwaitCost` decimal(10,3) NOT NULL DEFAULT '2.000',
	`gccCostPerUnit` decimal(10,3) NOT NULL DEFAULT '0.000',
	`kuwaitOnly` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipping_classes_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `attribute_values` ADD `shippingClassId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `shippingClassId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `kuwaitOnly` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shipping_zones` ADD `baseCost` decimal(10,3) DEFAULT '0.000' NOT NULL;--> statement-breakpoint
ALTER TABLE `shipping_zones` ADD `citySurchargesEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shipping_zones` ADD `shippingClassCostsEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `shipping_zones` ADD `costCalculationType` enum('order','class') DEFAULT 'class' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_settings` ADD `shippingTableRateEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `store_settings` ADD `kuwaitBaseDeliveryCost` decimal(10,3) DEFAULT '2.000' NOT NULL;--> statement-breakpoint
CREATE INDEX `shipping_classes_slug_idx` ON `shipping_classes` (`slug`);