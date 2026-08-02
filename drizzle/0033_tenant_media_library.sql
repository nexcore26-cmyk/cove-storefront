CREATE TABLE IF NOT EXISTS `media_assets` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL DEFAULT 1,
  `key` varchar(1024) NOT NULL,
  `url` text NOT NULL,
  `sourceSystem` varchar(64) NOT NULL DEFAULT 'cove-admin',
  `mimeType` varchar(191) NOT NULL,
  `sizeBytes` int NOT NULL DEFAULT 0,
  `sha256` varchar(64),
  `originalFilename` varchar(512),
  `altText` varchar(512),
  `entityType` varchar(64),
  `entityId` int,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `media_assets_id` PRIMARY KEY (`id`)
);

CREATE INDEX `media_assets_tenant_active_idx` ON `media_assets` (`tenantId`, `isActive`);
CREATE INDEX `media_assets_tenant_created_idx` ON `media_assets` (`tenantId`, `createdAt`);
CREATE INDEX `media_assets_entity_idx` ON `media_assets` (`entityType`, `entityId`);
