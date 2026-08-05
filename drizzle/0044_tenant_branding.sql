-- Phase E2: new tenant_branding table (additive only, nothing reads it yet).
-- Dedicated table rather than tenantId+columns on store_settings, since
-- store_settings mixes operational concerns (POS/warehouse/payment gateway)
-- deliberately left as a global singleton and out of scope for this phase.
-- headerSettings/footerSettings are duplicated here (not yet removed from
-- store_settings) - Phase E3 migrates the read/write path and drops them
-- from store_settings once the cutover is verified.

CREATE TABLE `tenant_branding` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `businessName` varchar(255) NOT NULL,
  `tagline` varchar(255),
  `logoUrl` varchar(500),
  `logoAltText` varchar(255),
  `faviconUrl` varchar(500),
  `ogImageUrl` varchar(500),
  `metaTitle` varchar(255),
  `metaDescription` varchar(500),
  `themeColors` json,
  `headingFontFamily` varchar(150),
  `bodyFontFamily` varchar(150),
  `contactPhone` varchar(50),
  `contactEmail` varchar(255),
  `contactAddress` varchar(500),
  `socialLinks` json,
  `copyrightText` varchar(255),
  `headerSettings` json,
  `footerSettings` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `tenant_branding_id` PRIMARY KEY(`id`),
  CONSTRAINT `tenant_branding_tenantId_unique` UNIQUE(`tenantId`)
);
