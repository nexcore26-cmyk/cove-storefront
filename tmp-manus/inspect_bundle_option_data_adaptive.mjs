import 'dotenv/config';
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const conn = await mysql.createConnection(dbUrl);

async function rows(sql, params = []) {
  const [result] = await conn.execute(sql, params);
  return result;
}

function pick(cols, candidates) {
  return candidates.find((c) => cols.has(c));
}

function selectList(cols, candidates) {
  return candidates.filter((c) => cols.has(c)).map((c) => `\`${c}\``).join(', ');
}

async function tableCols(table) {
  const result = await rows(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ?
    ORDER BY ordinal_position
  `, [table]);
  return new Set(result.map((r) => r.COLUMN_NAME || r.column_name));
}

async function query(label, sql, params = []) {
  console.log(`\n=== ${label} ===`);
  const result = await rows(sql, params);
  console.log(JSON.stringify(result, null, 2));
}

try {
  const productCols = await tableCols('products');
  const variantCols = await tableCols('product_variants');
  console.log('=== product_columns ===');
  console.log(JSON.stringify([...productCols], null, 2));
  console.log('=== product_variant_columns ===');
  console.log(JSON.stringify([...variantCols], null, 2));

  const pName = pick(productCols, ['name', 'title', 'productName']);
  const pSlug = pick(productCols, ['slug', 'handle']);
  const pSku = pick(productCols, ['sku', 'SKU']);
  const pSelect = selectList(productCols, [
    'id', 'name', 'title', 'slug', 'sku', 'type', 'productType', 'status', 'isActive', 'manageStock',
    'manage_stock', 'stockQuantity', 'stock_quantity', 'stockStatus', 'stock_status', 'regularPrice',
    'regular_price', 'salePrice', 'sale_price', 'price', 'attributes', 'options', 'metadata', 'metaData'
  ]);

  if (pName) {
    await query('matching_products', `
      SELECT ${pSelect || '*'}
      FROM products
      WHERE LOWER(\`${pName}\`) LIKE '%roshina%'
         OR LOWER(\`${pName}\`) LIKE '%mubkhar%'
         OR LOWER(\`${pName}\`) LIKE '%trash%'
         OR LOWER(\`${pName}\`) LIKE '%tissue%'
      ${pSlug ? `OR LOWER(\`${pSlug}\`) LIKE '%roshina%' OR LOWER(\`${pSlug}\`) LIKE '%mubkhar%' OR LOWER(\`${pSlug}\`) LIKE '%trash%' OR LOWER(\`${pSlug}\`) LIKE '%tissue%'` : ''}
      ${pSku ? `OR LOWER(\`${pSku}\`) LIKE '%roshina%' OR LOWER(\`${pSku}\`) LIKE '%mubkhar%' OR LOWER(\`${pSku}\`) LIKE '%trash%' OR LOWER(\`${pSku}\`) LIKE '%tissue%'` : ''}
      ORDER BY id DESC
      LIMIT 120
    `);
  }

  if (variantCols.size) {
    const vName = pick(variantCols, ['name', 'title', 'variantName']);
    const vAttrs = pick(variantCols, ['attributes', 'attributeValues', 'options', 'metadata', 'metaData']);
    const vSku = pick(variantCols, ['sku', 'SKU']);
    const vProductId = pick(variantCols, ['productId', 'product_id']);
    const vSelect = selectList(variantCols, [
      'id', 'productId', 'product_id', 'name', 'title', 'sku', 'attributes', 'attributeValues', 'options',
      'regularPrice', 'regular_price', 'salePrice', 'sale_price', 'price', 'manageStock', 'manage_stock',
      'stockQuantity', 'stock_quantity', 'stockStatus', 'stock_status', 'metadata', 'metaData'
    ]);
    const conds = [];
    for (const col of [vName, vAttrs, vSku].filter(Boolean)) {
      conds.push(`LOWER(CAST(v.\`${col}\` AS CHAR)) LIKE '%roshina%'`);
      conds.push(`LOWER(CAST(v.\`${col}\` AS CHAR)) LIKE '%mubkhar%'`);
      conds.push(`LOWER(CAST(v.\`${col}\` AS CHAR)) LIKE '%trash%'`);
      conds.push(`LOWER(CAST(v.\`${col}\` AS CHAR)) LIKE '%tissue%'`);
    }
    if (vProductId && pName) {
      conds.push(`LOWER(CAST(p.\`${pName}\` AS CHAR)) LIKE '%roshina%'`);
      conds.push(`LOWER(CAST(p.\`${pName}\` AS CHAR)) LIKE '%mubkhar%'`);
      conds.push(`LOWER(CAST(p.\`${pName}\` AS CHAR)) LIKE '%trash%'`);
      conds.push(`LOWER(CAST(p.\`${pName}\` AS CHAR)) LIKE '%tissue%'`);
    }
    if (conds.length) {
      await query('matching_product_variants', `
        SELECT ${vSelect ? vSelect.split(', ').map((c) => `v.${c}`).join(', ') : 'v.*'}${vProductId && pName ? `, p.\`${pName}\` AS product_name` : ''}
        FROM product_variants v
        ${vProductId && pName ? `LEFT JOIN products p ON p.id = v.\`${vProductId}\`` : ''}
        WHERE ${conds.join(' OR ')}
        ORDER BY ${vProductId ? `v.\`${vProductId}\`, ` : ''}v.id ASC
        LIMIT 160
      `);
    }
  }

  await query('bundle_related_tables', `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND (LOWER(table_name) LIKE '%bundle%'
        OR LOWER(table_name) LIKE '%component%'
        OR LOWER(table_name) LIKE '%option%'
        OR LOWER(table_name) LIKE '%attribute%')
    ORDER BY table_name
  `);

  await query('relevant_columns', `
    SELECT table_name, column_name, column_type
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND (LOWER(column_name) LIKE '%bundle%'
        OR LOWER(column_name) LIKE '%component%'
        OR LOWER(column_name) LIKE '%option%'
        OR LOWER(column_name) LIKE '%attribute%'
        OR LOWER(column_name) LIKE '%meta%')
    ORDER BY table_name, ordinal_position
  `);
} finally {
  await conn.end();
}
