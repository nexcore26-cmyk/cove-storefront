-- Menu Builder / Navigation Control
-- Adds admin-managed storefront navigation with a safe default header menu.

CREATE TABLE IF NOT EXISTS `navigation_menus` (
  `id` int AUTO_INCREMENT NOT NULL,
  `key` varchar(80) NOT NULL,
  `name` varchar(160) NOT NULL,
  `location` enum('header','footer','mobile','custom') NOT NULL DEFAULT 'header',
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `navigation_menus_id` PRIMARY KEY(`id`),
  UNIQUE KEY `navigation_menus_key_unique` (`key`)
);

CREATE TABLE IF NOT EXISTS `navigation_menu_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `menuId` int NOT NULL,
  `parentId` int,
  `label` varchar(160) NOT NULL,
  `labelAr` varchar(160),
  `href` varchar(500) NOT NULL,
  `target` enum('self','blank') NOT NULL DEFAULT 'self',
  `sortOrder` int NOT NULL DEFAULT 0,
  `isVisible` boolean NOT NULL DEFAULT true,
  `icon` varchar(80),
  `meta` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `navigation_menu_items_id` PRIMARY KEY(`id`),
  KEY `navigation_menu_items_menuId_idx` (`menuId`),
  KEY `navigation_menu_items_parentId_idx` (`parentId`),
  CONSTRAINT `navigation_menu_items_menu_fk` FOREIGN KEY (`menuId`) REFERENCES `navigation_menus`(`id`) ON DELETE CASCADE
);

INSERT INTO `navigation_menus` (`key`, `name`, `location`, `isActive`)
VALUES ('header', 'Header Navigation', 'header', true)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `location` = VALUES(`location`), `isActive` = VALUES(`isActive`);

SET @headerMenuId := (SELECT `id` FROM `navigation_menus` WHERE `key` = 'header' LIMIT 1);

INSERT INTO `navigation_menu_items` (`menuId`, `label`, `labelAr`, `href`, `sortOrder`, `isVisible`)
SELECT @headerMenuId, 'Collections', 'المجموعات', '/pages/collections', 10, true
WHERE @headerMenuId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `navigation_menu_items` WHERE `menuId` = @headerMenuId AND `href` = '/pages/collections');
INSERT INTO `navigation_menu_items` (`menuId`, `label`, `labelAr`, `href`, `sortOrder`, `isVisible`)
SELECT @headerMenuId, 'Company Portfolio', 'معرض الأعمال', '/pages/projects', 20, true
WHERE @headerMenuId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `navigation_menu_items` WHERE `menuId` = @headerMenuId AND `href` = '/pages/projects');
INSERT INTO `navigation_menu_items` (`menuId`, `label`, `labelAr`, `href`, `sortOrder`, `isVisible`)
SELECT @headerMenuId, 'Client Services', 'خدمات العملاء', '/pages/client-services', 30, true
WHERE @headerMenuId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `navigation_menu_items` WHERE `menuId` = @headerMenuId AND `href` = '/pages/client-services');
INSERT INTO `navigation_menu_items` (`menuId`, `label`, `labelAr`, `href`, `sortOrder`, `isVisible`)
SELECT @headerMenuId, 'About', 'عن كوف', '/pages/about', 40, true
WHERE @headerMenuId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `navigation_menu_items` WHERE `menuId` = @headerMenuId AND `href` = '/pages/about');
INSERT INTO `navigation_menu_items` (`menuId`, `label`, `labelAr`, `href`, `sortOrder`, `isVisible`)
SELECT @headerMenuId, 'Events', 'الفعاليات', '/pages/events', 50, true
WHERE @headerMenuId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `navigation_menu_items` WHERE `menuId` = @headerMenuId AND `href` = '/pages/events');
INSERT INTO `navigation_menu_items` (`menuId`, `label`, `labelAr`, `href`, `sortOrder`, `isVisible`)
SELECT @headerMenuId, 'Contact', 'اتصل بنا', '/pages/contact', 60, true
WHERE @headerMenuId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `navigation_menu_items` WHERE `menuId` = @headerMenuId AND `href` = '/pages/contact');
