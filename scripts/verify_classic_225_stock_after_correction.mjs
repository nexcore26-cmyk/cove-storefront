import 'dotenv/config';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const connection = await mysql.createConnection(databaseUrl);
try {
  const [warehouses] = await connection.execute(`
    SELECT id, name, code, type
    FROM warehouses
    ORDER BY id
  `);

  const [variantRows] = await connection.execute(`
    SELECT
      pv.id AS variant_id,
      pv.sku,
      pv.attributes,
      w.id AS warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      w.type AS warehouse_type,
      ws.quantity
    FROM product_variants pv
    LEFT JOIN warehouse_stock ws ON ws.variantId = pv.id AND ws.productId = pv.productId
    LEFT JOIN warehouses w ON w.id = ws.warehouseId
    WHERE pv.productId = ?
    ORDER BY pv.id, w.id
  `, [390057]);

  const [websiteTotals] = await connection.execute(`
    SELECT
      w.id AS warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      w.type AS warehouse_type,
      COALESCE(SUM(ws.quantity), 0) AS total_quantity
    FROM warehouse_stock ws
    JOIN warehouses w ON w.id = ws.warehouseId
    JOIN product_variants pv ON pv.id = ws.variantId
    WHERE ws.productId = ? AND (LOWER(w.type) = 'online' OR LOWER(w.code) IN ('website', 'online'))
    GROUP BY w.id, w.name, w.code, w.type
  `, [390057]);

  const [productLevelRows] = await connection.execute(`
    SELECT
      ws.productId AS product_id,
      ws.variantId AS variant_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      w.type AS warehouse_type,
      ws.quantity
    FROM warehouse_stock ws
    JOIN warehouses w ON w.id = ws.warehouseId
    WHERE ws.productId = ? AND ws.variantId IS NULL
    ORDER BY w.id
  `, [390057]);

  console.log(JSON.stringify({ warehouses, variantRows, websiteTotals, productLevelRows }, null, 2));
} finally {
  await connection.end();
}
