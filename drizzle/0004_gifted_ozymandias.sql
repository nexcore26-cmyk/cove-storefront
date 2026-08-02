CREATE TABLE `store_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`posEnabled` boolean NOT NULL DEFAULT false,
	`posWarehouseId` int,
	`mainWarehouseId` int,
	`onlineWarehouseId` int,
	`storeName` varchar(255) NOT NULL DEFAULT 'Cove Interior',
	`storeCurrency` varchar(8) NOT NULL DEFAULT 'KWD',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `warehouse_stock` ADD `outOfStockThresholdEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouse_stock` ADD `outOfStockThreshold` int DEFAULT 0 NOT NULL;