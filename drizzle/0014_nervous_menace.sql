CREATE TABLE `kuwait_area_charges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`areaName` varchar(128) NOT NULL,
	`extraCharge` decimal(10,3) NOT NULL DEFAULT '0.000',
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kuwait_area_charges_id` PRIMARY KEY(`id`),
	CONSTRAINT `kuwait_area_charges_areaName_unique` UNIQUE(`areaName`)
);
