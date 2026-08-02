import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS \`attributes\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`displayType\` enum('button','color','image') NOT NULL DEFAULT 'button',
    \`descriptionEn\` text,
    \`descriptionAr\` text,
    \`sortOrder\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(\`id\`)
  )`,

  `CREATE TABLE IF NOT EXISTS \`attribute_values\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`attributeId\` int NOT NULL,
    \`labelEn\` varchar(255) NOT NULL,
    \`labelAr\` varchar(255),
    \`swatch\` varchar(512),
    \`image\` text,
    \`galleryImages\` json,
    \`price\` decimal(12,3),
    \`salePrice\` decimal(12,3),
    \`cog\` decimal(12,3),
    \`shippingClass\` varchar(128),
    \`weight\` decimal(8,3),
    \`dimL\` decimal(8,2),
    \`dimW\` decimal(8,2),
    \`dimH\` decimal(8,2),
    \`isBundle\` tinyint(1) NOT NULL DEFAULT 0,
    \`manageStock\` tinyint(1) NOT NULL DEFAULT 0,
    \`isEnabled\` tinyint(1) NOT NULL DEFAULT 1,
    \`sortOrder\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(\`id\`)
  )`,

  `CREATE TABLE IF NOT EXISTS \`attribute_value_bundle_items\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`attributeValueId\` int NOT NULL,
    \`productId\` int NOT NULL,
    \`qty\` int NOT NULL DEFAULT 1,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY(\`id\`)
  )`,

  `CREATE TABLE IF NOT EXISTS \`attribute_value_stock\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`attributeValueId\` int NOT NULL,
    \`warehouseId\` int NOT NULL,
    \`quantity\` int NOT NULL DEFAULT 0,
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(\`id\`),
    UNIQUE KEY \`av_stock_value_warehouse_unique\` (\`attributeValueId\`,\`warehouseId\`)
  )`,

  `CREATE TABLE IF NOT EXISTS \`product_attributes\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`productId\` int NOT NULL,
    \`attributeId\` int NOT NULL,
    \`activeValueIds\` json,
    \`sortOrder\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY(\`id\`),
    UNIQUE KEY \`product_attributes_product_attr_unique\` (\`productId\`,\`attributeId\`)
  )`,

  `CREATE INDEX IF NOT EXISTS \`avbi_attributeValueId_idx\` ON \`attribute_value_bundle_items\` (\`attributeValueId\`)`,
  `CREATE INDEX IF NOT EXISTS \`avbi_productId_idx\` ON \`attribute_value_bundle_items\` (\`productId\`)`,
  `CREATE INDEX IF NOT EXISTS \`attr_values_attributeId_idx\` ON \`attribute_values\` (\`attributeId\`)`,
  `CREATE INDEX IF NOT EXISTS \`product_attributes_productId_idx\` ON \`product_attributes\` (\`productId\`)`,
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    const tableName = sql.match(/TABLE.*?`([^`]+)`/)?.[1] || sql.match(/INDEX.*?ON `([^`]+)`/)?.[1] || 'unknown';
    console.log(`✓ ${tableName}`);
  } catch (e) {
    // Ignore "already exists" errors for indexes
    if (e.message.includes('already exists') || e.message.includes('Duplicate key name')) {
      console.log(`  (already exists, skipped)`);
    } else {
      console.error(`✗ Error: ${e.message}`);
    }
  }
}

await conn.end();
console.log('\nAll attribute tables ready.');
