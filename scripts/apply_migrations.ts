import 'dotenv/config';
import mysql from 'mysql2/promise';

// Only the ALTER TABLE / CREATE TABLE / CREATE INDEX statements that are actually needed
// (skipping CREATE TABLE for tables that already exist due to TiDB json default syntax issues)
const STATEMENTS = [
  // 0022: indexes that might be missing
  "CREATE INDEX IF NOT EXISTS `avbi_attributeValueId_idx` ON `attribute_value_bundle_items` (`attributeValueId`)",
  "CREATE INDEX IF NOT EXISTS `avbi_productId_idx` ON `attribute_value_bundle_items` (`productId`)",
  "CREATE INDEX IF NOT EXISTS `attr_values_attributeId_idx` ON `attribute_values` (`attributeId`)",
  "CREATE INDEX IF NOT EXISTS `product_attributes_productId_idx` ON `product_attributes` (`productId`)",
  
  // 0023: new tables and columns
  `CREATE TABLE IF NOT EXISTS \`kuwait_city_surcharges\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`cityName\` varchar(128) NOT NULL,
    \`cityNameAr\` varchar(128),
    \`surcharge\` decimal(10,3) NOT NULL DEFAULT '0.000',
    \`isActive\` boolean NOT NULL DEFAULT true,
    \`sortOrder\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`kuwait_city_surcharges_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`kuwait_city_surcharges_cityName_unique\` UNIQUE(\`cityName\`)
  )`,
  
  `CREATE TABLE IF NOT EXISTS \`shipping_classes\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(128) NOT NULL,
    \`slug\` varchar(128) NOT NULL,
    \`description\` text,
    \`kuwaitCost\` decimal(10,3) NOT NULL DEFAULT '2.000',
    \`gccCostPerUnit\` decimal(10,3) NOT NULL DEFAULT '0.000',
    \`kuwaitOnly\` boolean NOT NULL DEFAULT false,
    \`isActive\` boolean NOT NULL DEFAULT true,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`shipping_classes_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`shipping_classes_slug_unique\` UNIQUE(\`slug\`)
  )`,
  
  "ALTER TABLE `attribute_values` ADD COLUMN IF NOT EXISTS `shippingClassId` int",
  "ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `shippingClassId` int",
  "ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `kuwaitOnly` boolean NOT NULL DEFAULT false",
  "ALTER TABLE `shipping_zones` ADD COLUMN IF NOT EXISTS `baseCost` decimal(10,3) NOT NULL DEFAULT '0.000'",
  "ALTER TABLE `shipping_zones` ADD COLUMN IF NOT EXISTS `citySurchargesEnabled` boolean NOT NULL DEFAULT false",
  "ALTER TABLE `shipping_zones` ADD COLUMN IF NOT EXISTS `shippingClassCostsEnabled` boolean NOT NULL DEFAULT true",
  "ALTER TABLE `shipping_zones` ADD COLUMN IF NOT EXISTS `costCalculationType` enum('order','class') NOT NULL DEFAULT 'class'",
  "ALTER TABLE `store_settings` ADD COLUMN IF NOT EXISTS `shippingTableRateEnabled` boolean NOT NULL DEFAULT false",
  "ALTER TABLE `store_settings` ADD COLUMN IF NOT EXISTS `kuwaitBaseDeliveryCost` decimal(10,3) NOT NULL DEFAULT '2.000'",
  "CREATE INDEX IF NOT EXISTS `shipping_classes_slug_idx` ON `shipping_classes` (`slug`)",
];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  
  let success = 0;
  let skipped = 0;
  
  for (const stmt of STATEMENTS) {
    const preview = stmt.trim().substring(0, 80).replace(/\s+/g, ' ');
    try {
      await conn.query(stmt);
      console.log(`[OK] ${preview}...`);
      success++;
    } catch (e: any) {
      const ignorable = ['ER_DUP_FIELDNAME', 'ER_TABLE_EXISTS_ERROR', 'ER_DUP_KEYNAME', 'ER_CANT_DROP_FIELD_OR_KEY'];
      if (ignorable.includes(e.code)) {
        console.log(`[SKIP] ${preview}... (${e.code})`);
        skipped++;
      } else {
        console.error(`[ERROR] ${preview}... \n  ${e.code}: ${e.message}`);
        throw e;
      }
    }
  }
  
  await conn.end();
  console.log(`\nDone! ${success} applied, ${skipped} skipped`);
}

main().catch(console.error);
