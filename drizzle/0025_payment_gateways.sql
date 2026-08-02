ALTER TABLE `store_settings` ADD `activeGateway` enum('myfatoorah','upayment','taly') NOT NULL DEFAULT 'myfatoorah';--> statement-breakpoint
ALTER TABLE `store_settings` ADD `myfatoorahApiKey` text;--> statement-breakpoint
ALTER TABLE `store_settings` ADD `myfatoorahIsTest` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `store_settings` ADD `upaymentApiKey` text;--> statement-breakpoint
ALTER TABLE `store_settings` ADD `talyApiKey` text;
