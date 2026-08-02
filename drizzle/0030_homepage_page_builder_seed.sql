-- Ensures the storefront homepage is represented by the Page Builder.
-- This migration is intentionally non-destructive: it never overwrites existing
-- homepage blocks that administrators may have edited in production.

INSERT INTO `pages` (`slug`, `title`, `titleAr`, `isPublished`, `isSystem`, `metaTitle`, `metaDescription`)
SELECT 'home', 'Homepage', 'الصفحة الرئيسية', true, true, 'Cove Interior', 'Luxury furniture and interior design collections from Cove Interior.'
WHERE NOT EXISTS (SELECT 1 FROM `pages` WHERE `slug` = 'home');

SET @homePageId := (SELECT `id` FROM `pages` WHERE `slug` = 'home' LIMIT 1);
SET @homeBlockCount := (SELECT COUNT(*) FROM `page_blocks` WHERE `pageId` = @homePageId);

INSERT INTO `page_blocks` (`pageId`, `blockType`, `sortOrder`, `isVisible`, `config`)
SELECT
  @homePageId,
  seeded.`blockType`,
  seeded.`sortOrder`,
  true,
  seeded.`config`
FROM (
  SELECT
    'hero_slider' AS `blockType`,
    0 AS `sortOrder`,
    JSON_OBJECT(
      'slides', JSON_ARRAY(
        JSON_OBJECT(
          'image', 'https://d2xsxph8kpxj0f.cloudfront.net/310519663503619764/cKkGLF3y8cCPRhNzMTjKZq/cove-hero-living-GavFKBCmKwMt5nH9i6y6Be.webp',
          'title', 'Crafted for the Discerning',
          'subtitle', 'Discover our curated collection of luxury furniture and home decor.',
          'ctaText', '',
          'ctaLink', '/pages/collections'
        ),
        JSON_OBJECT(
          'image', 'https://d2xsxph8kpxj0f.cloudfront.net/310519663503619764/cKkGLF3y8cCPRhNzMTjKZq/cove-hero-bedroom-cXD9mE9Xq57AYqHGgwPQp2.webp',
          'title', 'New Bedroom Collection',
          'subtitle', 'Timeless designs for your most personal space.',
          'ctaText', 'Shop Bedroom',
          'ctaLink', '/category/main-curve-web'
        )
      ),
      'autoplay', true,
      'interval', 5000
    ) AS `config`
  UNION ALL
  SELECT
    'category_grid' AS `blockType`,
    10 AS `sortOrder`,
    JSON_OBJECT(
      'title', 'Shop by Category',
      'titleAr', 'تسوق حسب الفئة',
      'categoryIds', JSON_ARRAY(2, 8, 10, 14, 17, 21),
      'columns', 3,
      'showName', true
    ) AS `config`
  UNION ALL
  SELECT
    'product_grid' AS `blockType`,
    20 AS `sortOrder`,
    JSON_OBJECT(
      'title', 'Featured Products',
      'titleAr', 'منتجات مميزة',
      'productIds', JSON_ARRAY(),
      'categoryId', NULL,
      'limit', 8,
      'columns', 4
    ) AS `config`
) AS seeded
WHERE @homePageId IS NOT NULL AND @homeBlockCount = 0;
