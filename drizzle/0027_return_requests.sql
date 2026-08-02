CREATE TABLE IF NOT EXISTS `return_requests` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int NOT NULL,
  `orderItemId` int,
  `requestedByUserId` int,
  `reason` varchar(512) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `resolvedByUserId` int,
  `resolvedAt` timestamp,
  `notes` varchar(1024),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `return_requests_id` PRIMARY KEY(`id`)
);
CREATE INDEX `return_requests_orderId_idx` ON `return_requests` (`orderId`);
CREATE INDEX `return_requests_status_idx` ON `return_requests` (`status`);
