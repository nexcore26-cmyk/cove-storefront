CREATE TABLE `page_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`blockType` enum('hero_slider','text_html','category_grid','product_grid','banner','spacer','contact_form','image_gallery') NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isVisible` boolean NOT NULL DEFAULT true,
	`config` json NOT NULL DEFAULT ('{}'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `page_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title` varchar(255) NOT NULL,
	`titleAr` varchar(255),
	`isPublished` boolean NOT NULL DEFAULT true,
	`isSystem` boolean NOT NULL DEFAULT false,
	`metaTitle` varchar(255),
	`metaDescription` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `pages_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `page_blocks` ADD CONSTRAINT `page_blocks_pageId_pages_id_fk` FOREIGN KEY (`pageId`) REFERENCES `pages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `page_blocks_pageId_idx` ON `page_blocks` (`pageId`);