CREATE TABLE `branches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL DEFAULT '1',
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouseId` int NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `branches_warehouse_unique` (`warehouseId`),
  UNIQUE KEY `branches_tenant_code_unique` (`tenantId`, `code`),
  KEY `branches_tenant_idx` (`tenantId`),
  CONSTRAINT `branches_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`),
  CONSTRAINT `branches_warehouse_fk` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `branches` (`tenantId`, `name`, `code`, `warehouseId`, `isActive`)
VALUES (1, 'Brass Store - Homz Mall', 'BRASS-HOMZ', 3, 1);
