import 'dotenv/config';
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const conn = await mysql.createConnection(dbUrl);

async function query(label, sql, params = []) {
  console.log(`\n=== ${label} ===`);
  const [rows] = await conn.execute(sql, params);
  console.log(JSON.stringify(rows, null, 2));
}

try {
  await query('matching_products', `
    SELECT id, name, slug, sku, type, status, manageStock, stockQuantity, stockStatus, regularPrice, salePrice
    FROM products
    WHERE LOWER(name) LIKE '%roshina%'
       OR LOWER(name) LIKE '%mubkhar%'
       OR LOWER(name) LIKE '%trash%'
       OR LOWER(name) LIKE '%tissue%'
    ORDER BY id DESC
    LIMIT 80
  `);

  await query('matching_product_variations', `
    SELECT v.id, v.productId, p.name AS productName, v.sku, v.name, v.attributes, v.regularPrice, v.salePrice, v.manageStock, v.stockQuantity, v.stockStatus
    FROM product_variants v
    JOIN products p ON p.id = v.productId
    WHERE LOWER(p.name) LIKE '%roshina%'
       OR LOWER(p.name) LIKE '%mubkhar%'
       OR LOWER(p.name) LIKE '%trash%'
       OR LOWER(p.name) LIKE '%tissue%'
       OR LOWER(v.name) LIKE '%roshina%'
       OR LOWER(v.name) LIKE '%mubkhar%'
       OR LOWER(v.name) LIKE '%trash%'
       OR LOWER(v.name) LIKE '%tissue%'
       OR LOWER(CAST(v.attributes AS CHAR)) LIKE '%roshina%'
       OR LOWER(CAST(v.attributes AS CHAR)) LIKE '%mubkhar%'
       OR LOWER(CAST(v.attributes AS CHAR)) LIKE '%trash%'
       OR LOWER(CAST(v.attributes AS CHAR)) LIKE '%tissue%'
    ORDER BY p.id DESC, v.id ASC
    LIMIT 120
  `);

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
