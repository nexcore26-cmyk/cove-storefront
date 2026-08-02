-- C2: Add standalone Page Builder button block type.
-- This migration is schema-only and does not modify existing Page Builder content.

ALTER TABLE `page_blocks`
  MODIFY COLUMN `blockType` enum(
    'hero_slider',
    'text_html',
    'category_grid',
    'product_grid',
    'banner',
    'button',
    'spacer',
    'contact_form',
    'image_gallery'
  ) NOT NULL;
