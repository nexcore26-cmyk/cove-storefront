-- Migration: system_labels table for tenant-editable UI string translations
CREATE TABLE IF NOT EXISTS `system_labels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1,
  `key` varchar(100) NOT NULL,
  `label_en` varchar(255) NOT NULL,
  `label_ar` varchar(255) NOT NULL DEFAULT '',
  `group` varchar(50) NOT NULL DEFAULT 'product',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_labels_tenant_key_unique` (`tenant_id`, `key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default labels for tenant 1
INSERT IGNORE INTO `system_labels` (`tenant_id`, `key`, `label_en`, `label_ar`, `group`) VALUES
(1, 'quantity',        'Quantity',        'الكمية',          'product'),
(1, 'select_options',  'Select Options',  'اختر الخيارات',   'product'),
(1, 'add_to_cart',     'Add to Cart',     'أضف إلى السلة',   'product'),
(1, 'in_stock',        'In stock',        'متوفر',           'product'),
(1, 'out_of_stock',    'Out of stock',    'غير متوفر',       'product'),
(1, 'showroom_only',   'Showroom only',   'معرض فقط',        'product'),
(1, 'visit_showroom',  'Visit Our Showroom', 'زيارة المعرض', 'product'),
(1, 'description',     'Description',     'الوصف',           'product'),
(1, 'details',         'Details',         'التفاصيل',        'product'),
(1, 'shipping',        'Shipping',        'الشحن',           'product'),
(1, 'pre_order',       'Pre-Order',       'طلب مسبق',        'product'),
(1, 'sold_out',        'Sold Out',        'نفذت الكمية',     'product');
