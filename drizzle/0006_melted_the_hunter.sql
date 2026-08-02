CREATE TABLE `category_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`locale` enum('en','ar') NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `category_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `category_translations_cat_locale_unique` UNIQUE(`categoryId`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `product_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`locale` enum('en','ar') NOT NULL,
	`name` varchar(500) NOT NULL,
	`description` text,
	`shortDescription` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_translations_product_locale_unique` UNIQUE(`productId`,`locale`)
);
--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `type` enum('simple','variable','grouped','bundle','custom_box') NOT NULL DEFAULT 'simple';--> statement-breakpoint
ALTER TABLE `products` ADD `measurementType` enum('unit','meter','kg','roll','box') DEFAULT 'unit' NOT NULL;--> statement-breakpoint
CREATE INDEX `category_translations_categoryId_idx` ON `category_translations` (`categoryId`);--> statement-breakpoint
CREATE INDEX `product_translations_productId_idx` ON `product_translations` (`productId`);