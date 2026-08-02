CREATE TABLE `homepage_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectionKey` varchar(64) NOT NULL,
	`title` varchar(512),
	`titleAr` varchar(512),
	`subtitle` text,
	`subtitleAr` text,
	`ctaText` varchar(256),
	`ctaTextAr` varchar(256),
	`ctaUrl` varchar(512),
	`imageUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `homepage_sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `homepage_sections_sectionKey_unique` UNIQUE(`sectionKey`)
);
