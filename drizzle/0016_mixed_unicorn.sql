ALTER TABLE `order_items` ADD `isGift` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `giftNote` varchar(500);