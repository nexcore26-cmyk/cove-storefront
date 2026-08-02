import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const envPath = fs.existsSync('.env') ? '.env' : (fs.existsSync('.env.production') ? '.env.production' : '.env');
dotenv.config({ path: envPath });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const conn = await mysql.createConnection(databaseUrl);

async function q(sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

async function columns(table) {
  return await q(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`, [table]);
}

async function tableExists(table) {
  const rows = await q(`SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [table]);
  return Number(rows[0].c) > 0;
}

const importantTables = ['products','product_variants','product_attributes','attribute_values','attribute_value_bundle_items','attribute_value_stock','warehouses','warehouse_stock','store_settings'];
console.log('=== TABLE COLUMNS ===');
for (const table of importantTables) {
  if (await tableExists(table)) {
    console.log(`\n--- ${table} ---`);
    console.log(JSON.stringify(await columns(table), null, 2));
  } else {
    console.log(`\n--- ${table} MISSING ---`);
  }
}

const productNeedles = [
  '%Roshina Mubkhar%Black%',
  '%Mubkhar%Black%',
  '%Beige Trash Bin%',
  '%Black Trash Bin%',
  '%Tissue box Black%',
  '%Mini Roshina Black%',
  '%Roshina 1 Black%'
];
const productCols = (await columns('products')).map(c => c.COLUMN_NAME);
const desiredProductCols = ['id', 'name', 'sku', 'type', 'status', 'manageStock', 'stockQuantity', 'stock', 'wcProductId', 'wooCommerceId', 'isActive'];
const selectedProductCols = desiredProductCols.filter(c => productCols.includes(c));
const products = [];
for (const needle of productNeedles) {
  const rows = await q(`SELECT ${selectedProductCols.map(c => `\`${c}\``).join(', ')} FROM products WHERE name LIKE ? ORDER BY id LIMIT 20`, [needle]);
  for (const row of rows) {
    if (!products.some(p => p.id === row.id)) products.push(row);
  }
}
console.log('\n=== MATCHING PRODUCTS ===');
console.log(JSON.stringify(products, null, 2));

const targetIds = products.map(p => p.id);
if (targetIds.length) {
  const placeholders = targetIds.map(() => '?').join(',');

  console.log('\n=== TARGET PRODUCT VARIANTS ===');
  try {
    const variants = await q(`SELECT id, productId, name, sku, price, salePrice, manageStock, stockQuantity, attributes, isActive, wcVariantId FROM product_variants WHERE productId IN (${placeholders}) ORDER BY productId, id`, targetIds);
    console.log(JSON.stringify(variants, null, 2));
  } catch (err) {
    console.log('VARIANT QUERY ERROR:', err.message);
  }

  console.log('\n=== TARGET PRODUCT ATTRIBUTES ===');
  try {
    const productAttributes = await q(`SELECT * FROM product_attributes WHERE productId IN (${placeholders}) ORDER BY productId, id`, targetIds);
    console.log(JSON.stringify(productAttributes, null, 2));
  } catch (err) {
    console.log('PRODUCT ATTRIBUTES QUERY ERROR:', err.message);
  }

  console.log('\n=== TARGET ATTRIBUTE VALUES WITH PRODUCT CONTEXT ===');
  try {
    const rows = await q(`
      SELECT p.id AS productId, p.name AS productName, pa.id AS productAttributeId, pa.attributeId,
             av.id AS attributeValueId, av.labelEn, av.labelAr, av.priceAdjustment, av.salePriceAdjustment,
             av.isDefault, av.isEnabled, av.isBundle, av.sortOrder, av.descriptionEn, av.descriptionAr
      FROM product_attributes pa
      JOIN products p ON p.id = pa.productId
      JOIN attribute_values av ON av.attributeId = pa.attributeId
      WHERE pa.productId IN (${placeholders})
      ORDER BY p.id, pa.id, av.sortOrder, av.id
    `, targetIds);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.log('ATTRIBUTE VALUE CONTEXT QUERY ERROR:', err.message);
  }

  console.log('\n=== EXISTING BUNDLE COMPONENT ROWS FOR TARGET ATTRIBUTE VALUES ===');
  try {
    const rows = await q(`
      SELECT parentP.id AS parentProductId, parentP.name AS parentProductName,
             av.id AS attributeValueId, av.labelEn AS optionLabel,
             b.productId AS componentProductId, cp.name AS componentProductName,
             b.qty
      FROM product_attributes pa
      JOIN products parentP ON parentP.id = pa.productId
      JOIN attribute_values av ON av.attributeId = pa.attributeId
      LEFT JOIN attribute_value_bundle_items b ON b.attributeValueId = av.id
      LEFT JOIN products cp ON cp.id = b.productId
      WHERE pa.productId IN (${placeholders})
      ORDER BY parentP.id, av.sortOrder, av.id, b.id
    `, targetIds);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.log('BUNDLE ROW QUERY ERROR:', err.message);
  }

  console.log('\n=== ONLINE WAREHOUSE STOCK FOR MATCHING PRODUCTS ===');
  try {
    const rows = await q(`
      SELECT w.id AS warehouseId, w.name AS warehouseName, w.type AS warehouseType,
             ws.productId, p.name AS productName, ws.variantId, pv.name AS variantName,
             ws.quantity
      FROM warehouse_stock ws
      JOIN warehouses w ON w.id = ws.warehouseId
      JOIN products p ON p.id = ws.productId
      LEFT JOIN product_variants pv ON pv.id = ws.variantId
      WHERE ws.productId IN (${placeholders}) AND w.isActive = 1
      ORDER BY w.id, ws.productId, ws.variantId
    `, targetIds);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.log('WAREHOUSE STOCK QUERY ERROR:', err.message);
  }
}

await conn.end();
