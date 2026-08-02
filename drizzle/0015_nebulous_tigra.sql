CREATE TABLE `order_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`category` varchar(128) NOT NULL,
	`description` varchar(255),
	`amount` decimal(10,3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_vendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`vendorId` int NOT NULL,
	`ownershipType` enum('own','consignment','commission') NOT NULL DEFAULT 'own',
	`commissionPercent` decimal(5,2) DEFAULT '0.00',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_vendors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`contactName` varchar(255),
	`email` varchar(255),
	`phone` varchar(64),
	`notes` text,
	`commissionPercent` decimal(5,2) DEFAULT '0.00',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_expenses` ADD CONSTRAINT `order_expenses_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_vendors` ADD CONSTRAINT `product_vendors_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_vendors` ADD CONSTRAINT `product_vendors_vendorId_vendors_id_fk` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_expenses_orderId_idx` ON `order_expenses` (`orderId`);--> statement-breakpoint
CREATE INDEX `product_vendors_productId_idx` ON `product_vendors` (`productId`);