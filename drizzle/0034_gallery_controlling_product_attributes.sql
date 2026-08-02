-- Add WordPress-equivalent selector metadata and product-level gallery controller support.
ALTER TABLE `attributes`
  MODIFY COLUMN `displayType` enum('button','color','image','radio','default') NOT NULL DEFAULT 'button';

ALTER TABLE `product_attributes`
  ADD COLUMN `galleryControlling` boolean NOT NULL DEFAULT false AFTER `activeValueIds`,
  ADD COLUMN `isImageMaster` boolean NOT NULL DEFAULT false AFTER `galleryControlling`;
