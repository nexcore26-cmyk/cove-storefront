CREATE TABLE `bundle_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundleVariantId` int NOT NULL,
	`componentVariantId` int NOT NULL,
	`qty` decimal(10,3) NOT NULL DEFAULT '1.000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bundle_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bundle_items_bundleVariantId_idx` ON `bundle_items` (`bundleVariantId`);--> statement-breakpoint
CREATE INDEX `bundle_items_componentVariantId_idx` ON `bundle_items` (`componentVariantId`);