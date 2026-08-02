CREATE TABLE `carts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int,
  `sessionId` varchar(128),
  `couponCode` varchar(64),
  `shippingCountry` varchar(4),
  `shippingCity` varchar(128),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `expiresAt` timestamp,
  CONSTRAINT `carts_id` PRIMARY KEY(`id`)
);

CREATE TABLE `cart_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `cartId` int NOT NULL,
  `productId` int NOT NULL,
  `variantId` int,
  `quantity` int NOT NULL DEFAULT 1,
  `qtyValue` decimal(10,3) DEFAULT '1.000',
  `measurementType` enum('unit','meter','kg','roll','box') DEFAULT 'unit',
  `addedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `cart_items_id` PRIMARY KEY(`id`)
);

ALTER TABLE `carts` ADD CONSTRAINT `carts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cartId_carts_id_fk` FOREIGN KEY (`cartId`) REFERENCES `carts`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_variantId_product_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE cascade ON UPDATE no action;

CREATE INDEX `carts_userId_idx` ON `carts` (`userId`);
CREATE INDEX `carts_sessionId_idx` ON `carts` (`sessionId`);
CREATE INDEX `cart_items_cartId_idx` ON `cart_items` (`cartId`);
CREATE INDEX `cart_items_productId_idx` ON `cart_items` (`productId`);
