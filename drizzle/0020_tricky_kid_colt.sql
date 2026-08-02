ALTER TABLE `categories` MODIFY COLUMN `channel` enum('web','store','online','pos','both','none') DEFAULT 'both';--> statement-breakpoint
ALTER TABLE `orders` ADD `createdByUserId` int;