import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const envPaths = ['.env', '.env.production', '.env.local'];
for (const p of envPaths) {
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL missing');
const conn = await mysql.createConnection(databaseUrl);

async function q(label, sql, params = []) {
  try {
    const [rows] = await conn.execute(sql, params);
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.log(`\n=== ${label}_ERROR ===`);
    console.log(err.message);
  }
}

async function cols(table) {
  await q(`${table}_columns`, `
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `, [table]);
}

for (const table of ['products','product_variants','attributes','attribute_values','product_attributes','attribute_value_bundle_items','attribute_value_stock','bundle_items','warehouse_stock','warehouses']) {
  await cols(table);
}

const productIds = [390205, 390203, 390201, 390165, 390147, 390148, 390112];
await q('target_products', `
  SELECT id, name, slug, sku, type, status, price, salePrice
  FROM products
  WHERE id IN (${productIds.map(() => '?').join(',')})
  ORDER BY FIELD(id, ${productIds.map(() => '?').join(',')})
`, [...productIds, ...productIds]);

await q('target_product_variants', `
  SELECT pv.id, pv.productId, p.name AS productName, pv.wcVariantId, pv.sku, pv.name, pv.attributes, pv.price, pv.salePrice, pv.manageStock, pv.isActive
  FROM product_variants pv
  JOIN products p ON p.id = pv.productId
  WHERE pv.productId IN (${productIds.map(() => '?').join(',')})
  ORDER BY pv.productId, pv.id
`, productIds);

await q('target_product_attributes', `
  SELECT pa.*, p.name AS productName, a.name AS attributeName, a.slug AS attributeSlug
  FROM product_attributes pa
  LEFT JOIN products p ON p.id = pa.productId
  LEFT JOIN attributes a ON a.id = pa.attributeId
  WHERE pa.productId IN (${productIds.map(() => '?').join(',')})
  ORDER BY pa.productId, pa.id
`, productIds);

await q('target_attribute_values', `
  SELECT av.*, a.name AS attributeName, pa.productId, p.name AS productName
  FROM attribute_values av
  LEFT JOIN attributes a ON a.id = av.attributeId
  LEFT JOIN product_attributes pa ON pa.attributeId = av.attributeId
  LEFT JOIN products p ON p.id = pa.productId
  WHERE pa.productId IN (${productIds.map(() => '?').join(',')})
  ORDER BY pa.productId, av.attributeId, av.id
`, productIds);

await q('target_attribute_value_bundle_items', `
  SELECT avbi.*, av.value AS optionValue, av.label AS optionLabel, av.attributeId, a.name AS attributeName, pa.productId AS parentProductId, p.name AS parentProductName,
         cp.name AS componentProductName, cv.name AS componentVariantName, cv.sku AS componentVariantSku
  FROM attribute_value_bundle_items avbi
  LEFT JOIN attribute_values av ON av.id = avbi.attributeValueId
  LEFT JOIN attributes a ON a.id = av.attributeId
  LEFT JOIN product_attributes pa ON pa.attributeId = av.attributeId
  LEFT JOIN products p ON p.id = pa.productId
  LEFT JOIN products cp ON cp.id = avbi.componentProductId
  LEFT JOIN product_variants cv ON cv.id = avbi.componentVariantId
  WHERE pa.productId IN (${productIds.map(() => '?').join(',')})
  ORDER BY pa.productId, avbi.attributeValueId, avbi.id
`, productIds);

await q('target_bundle_items_table', `
  SELECT bi.*, bp.productId AS bundleProductId, bp.name AS bundleVariantName, bprod.name AS bundleProductName,
         cpv.productId AS componentProductId, cpv.name AS componentVariantName, cprod.name AS componentProductName
  FROM bundle_items bi
  LEFT JOIN product_variants bp ON bp.id = bi.bundleVariantId
  LEFT JOIN products bprod ON bprod.id = bp.productId
  LEFT JOIN product_variants cpv ON cpv.id = bi.componentVariantId
  LEFT JOIN products cprod ON cprod.id = cpv.productId
  WHERE bp.productId IN (${productIds.map(() => '?').join(',')}) OR cpv.productId IN (${productIds.map(() => '?').join(',')})
  ORDER BY bi.bundleVariantId, bi.id
`, [...productIds, ...productIds]);

await q('warehouse_stock_for_targets', `
  SELECT ws.*, w.name AS warehouseName, w.type AS warehouseType, p.name AS productName, pv.name AS variantName, pv.sku AS variantSku
  FROM warehouse_stock ws
  LEFT JOIN warehouses w ON w.id = ws.warehouseId
  LEFT JOIN products p ON p.id = ws.productId
  LEFT JOIN product_variants pv ON pv.id = ws.variantId
  WHERE ws.productId IN (${productIds.map(() => '?').join(',')})
  ORDER BY ws.productId, ws.variantId, ws.warehouseId
`, productIds);

await conn.end();
