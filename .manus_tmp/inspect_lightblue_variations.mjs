import mysql from 'mysql2/promise';
import fs from 'fs';

function loadEnv(file) {
  const txt = fs.readFileSync(file, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}

async function columns(conn, table) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM ${table}`);
  return rows.map(r => r.Field);
}

function selectList(cols, preferred) {
  return preferred.filter(c => cols.includes(c)).map(c => `\`${c}\``).join(', ');
}

loadEnv('.env');
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const slug = 'roshina-3-light-blue';
const [products] = await conn.query('SELECT id, name, slug FROM products WHERE slug = ?', [slug]);
const product = products[0] || null;
const result = { product };

if (product) {
  const pvCols = await columns(conn, 'product_variants');
  const paCols = await columns(conn, 'product_attributes');
  const pavCols = await columns(conn, 'product_attribute_values').catch(() => []);

  const variantSelect = selectList(pvCols, ['id','productId','product_id','sku','name','title','attributes','regularPrice','regular_price','salePrice','sale_price','manageStock','manage_stock','stockQuantity','stock_quantity','stockStatus','stock_status','createdAt','created_at','updatedAt','updated_at']);
  const productIdCol = pvCols.includes('productId') ? 'productId' : 'product_id';
  const [variants] = await conn.query(`SELECT ${variantSelect} FROM product_variants WHERE \`${productIdCol}\` = ? ORDER BY id`, [product.id]);

  const variantGroups = {};
  for (const v of variants) {
    const key = String(v.name || v.title || v.sku || v.attributes || '').toLowerCase();
    if (!variantGroups[key]) variantGroups[key] = { count: 0, ids: [], skus: [] };
    variantGroups[key].count += 1;
    variantGroups[key].ids.push(v.id);
    variantGroups[key].skus.push(v.sku || null);
  }

  const attrSelect = selectList(paCols, ['id','productId','product_id','attributeId','attribute_id','name','type','usedForVariations','used_for_variations','stockControlling','stock_controlling','values','createdAt','created_at','updatedAt','updated_at']);
  const paProductIdCol = paCols.includes('productId') ? 'productId' : 'product_id';
  const [attributes] = await conn.query(`SELECT ${attrSelect} FROM product_attributes WHERE \`${paProductIdCol}\` = ? ORDER BY id`, [product.id]);

  let attributeValues = [];
  if (pavCols.length) {
    const pavSelect = pavCols.map(c => `pav.\`${c}\``).join(', ');
    const pavPaCol = pavCols.includes('productAttributeId') ? 'productAttributeId' : 'product_attribute_id';
    try {
      const [pavs] = await conn.query(`SELECT ${pavSelect} FROM product_attribute_values pav JOIN product_attributes pa ON pa.id = pav.\`${pavPaCol}\` WHERE pa.\`${paProductIdCol}\` = ? ORDER BY pav.id`, [product.id]);
      attributeValues = pavs;
    } catch (e) {
      attributeValues = { error: e.message, pavCols };
    }
  }

  result.variantColumns = pvCols;
  result.variantCount = variants.length;
  result.variantGroups = variantGroups;
  result.variants = variants;
  result.attributeColumns = paCols;
  result.attributes = attributes;
  result.attributeValueColumns = pavCols;
  result.attributeValues = attributeValues;
}

console.log(JSON.stringify(result, null, 2));
await conn.end();
