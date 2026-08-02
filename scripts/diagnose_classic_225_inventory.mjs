import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const cwd = process.cwd();
loadEnvFile(path.join(cwd, '.env'));
loadEnvFile(path.join(cwd, '.env.local'));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [products] = await conn.query(
    `SELECT id, name, slug, type, sku, status FROM products WHERE id = ? OR slug = ?`,
    [390057, 'classic-225']
  );
  console.log('PRODUCT');
  console.table(products);

  const productId = products[0]?.id ?? 390057;

  const [warehouses] = await conn.query(
    `SELECT id, name, type, isActive FROM warehouses ORDER BY id`
  );
  console.log('WAREHOUSES');
  console.table(warehouses);

  const [variants] = await conn.query(
    `SELECT id, productId, sku, name, attributes, manageStock, isActive
     FROM product_variants
     WHERE productId = ?
     ORDER BY id`,
    [productId]
  );
  console.log('VARIANTS');
  for (const row of variants) console.log(JSON.stringify(row));

  const [variantStock] = await conn.query(
    `SELECT ws.id, ws.productId, ws.variantId, ws.warehouseId, w.name AS warehouseName, w.type AS warehouseType,
            ws.quantity, ws.outOfStockThresholdEnabled, ws.outOfStockThreshold
     FROM warehouse_stock ws
     LEFT JOIN warehouses w ON w.id = ws.warehouseId
     WHERE ws.productId = ? AND ws.variantId IS NOT NULL
     ORDER BY ws.variantId, ws.warehouseId`,
    [productId]
  );
  console.log('VARIATION_WAREHOUSE_STOCK');
  console.table(variantStock);

  const [productStock] = await conn.query(
    `SELECT ws.id, ws.productId, ws.variantId, ws.warehouseId, w.name AS warehouseName, w.type AS warehouseType,
            ws.quantity, ws.outOfStockThresholdEnabled, ws.outOfStockThreshold
     FROM warehouse_stock ws
     LEFT JOIN warehouses w ON w.id = ws.warehouseId
     WHERE ws.productId = ? AND ws.variantId IS NULL
     ORDER BY ws.warehouseId`,
    [productId]
  );
  console.log('PRODUCT_LEVEL_WAREHOUSE_STOCK');
  console.table(productStock);

  const [attrs] = await conn.query(
    `SELECT pa.productId, a.nameEn AS attributeName, av.id AS valueId, av.labelEn AS valueLabel,
            av.manageStock, avs.warehouseId, w.name AS warehouseName, avs.quantity
     FROM product_attributes pa
     JOIN attributes a ON a.id = pa.attributeId
     JOIN attribute_values av ON FIND_IN_SET(av.id, REPLACE(REPLACE(REPLACE(pa.valueIds, '[', ''), ']', ''), ' ', '')) > 0
     LEFT JOIN attribute_value_stock avs ON avs.attributeValueId = av.id
     LEFT JOIN warehouses w ON w.id = avs.warehouseId
     WHERE pa.productId = ?
     ORDER BY a.nameEn, av.id, avs.warehouseId`,
    [productId]
  );
  console.log('ATTRIBUTE_VALUE_STOCK_LEGACY');
  console.table(attrs);

  const [summary] = await conn.query(
    `SELECT w.id AS warehouseId, w.name AS warehouseName, w.type AS warehouseType,
            COALESCE(SUM(CASE WHEN ws.variantId IS NOT NULL THEN ws.quantity ELSE 0 END), 0) AS variationQty,
            COALESCE(SUM(CASE WHEN ws.variantId IS NULL THEN ws.quantity ELSE 0 END), 0) AS productLevelQty
     FROM warehouses w
     LEFT JOIN warehouse_stock ws ON ws.warehouseId = w.id AND ws.productId = ?
     GROUP BY w.id, w.name, w.type
     ORDER BY w.id`,
    [productId]
  );
  console.log('WAREHOUSE_SUMMARY');
  console.table(summary);
} finally {
  await conn.end();
}
