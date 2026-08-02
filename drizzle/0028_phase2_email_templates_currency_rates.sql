-- Phase 2: Email Templates + Currency Rates tables
-- email_templates: admin-customisable overrides for transactional emails
CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `templateType` enum('order_confirmation','order_status_change','admin_new_order') NOT NULL,
  `subjectOverride` varchar(255),
  `headerText` varchar(512),
  `footerText` varchar(512),
  `brandColor` varchar(16),
  `bgColor` varchar(16),
  `statusMessages` json,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `email_templates_type_unique` (`templateType`)
);

-- currency_rates: cached exchange rates relative to KWD
CREATE TABLE IF NOT EXISTS `currency_rates` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `currency` varchar(8) NOT NULL,
  `rate` decimal(18,6) NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `currency_rates_currency_unique` (`currency`)
);
