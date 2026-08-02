DROP INDEX `categories_wcId_idx` ON `categories`;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_wcId_source_unique` UNIQUE(`wcId`,`wcSource`);