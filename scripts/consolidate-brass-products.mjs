/**
 * consolidate-brass-products.mjs  (bulk SQL version)
 *
 * Merges remaining brass product rows into their matching main product rows.
 * Uses bulk SQL to avoid per-row round-trips.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Step 1: Get remaining brass/main pairs
  const [pairs] = await conn.execute(`
    SELECT b.id AS brassId, m.id AS mainId
    FROM products b
    JOIN products m ON m.wcId = b.wcId AND m.wcSource = 'main'
    WHERE b.wcSource = 'brass'
  `);
  console.log(`Remaining brass products to consolidate: ${pairs.length}`);
  if (pairs.length === 0) { await conn.end(); return; }

  // Step 2: For each brass product, merge its stock into the main product
  // We do this in bulk by building a CASE expression
  // First: for stock rows that DON'T have a conflict (no matching main stock row),
  //        just re-point productId in bulk
  const brassIds = pairs.map(p => p.brassId);
  const idList = brassIds.join(',');

  // Re-point non-conflicting stock rows (where main product doesn't already have
  // a stock row for the same warehouse+variantId)
  await conn.execute(`
    UPDATE warehouse_stock ws
    JOIN products b ON b.id = ws.productId AND b.wcSource = 'brass'
    JOIN products m ON m.wcId = b.wcId AND m.wcSource = 'main'
    SET ws.productId = m.id
    WHERE NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM warehouse_stock) ws2
      WHERE ws2.productId = m.id
        AND ws2.warehouseId = ws.warehouseId
        AND (ws2.variantId <=> ws.variantId)
    )
    AND b.id IN (${idList})
  `);
  console.log('Non-conflicting stock rows re-pointed');

  // Step 3: For conflicting rows (main already has stock for same warehouse),
  //         add quantities to main and delete brass row
  await conn.execute(`
    UPDATE warehouse_stock main_ws
    JOIN warehouse_stock brass_ws ON
      brass_ws.warehouseId = main_ws.warehouseId
      AND (brass_ws.variantId <=> main_ws.variantId)
    JOIN products b ON b.id = brass_ws.productId AND b.wcSource = 'brass'
    JOIN products m ON m.wcId = b.wcId AND m.wcSource = 'main' AND m.id = main_ws.productId
    SET main_ws.quantity = main_ws.quantity + brass_ws.quantity,
        main_ws.reservedQty = main_ws.reservedQty + COALESCE(brass_ws.reservedQty, 0)
    WHERE b.id IN (${idList})
  `);
  console.log('Conflicting stock rows merged (quantities added)');

  // Step 4: Delete remaining brass stock rows (both moved and conflicting ones)
  await conn.execute(`DELETE FROM warehouse_stock WHERE productId IN (${idList})`);
  console.log('Brass stock rows cleaned up');

  // Step 5: Re-point order_items
  await conn.execute(`
    UPDATE order_items oi
    JOIN products b ON b.id = oi.productId AND b.wcSource = 'brass'
    JOIN products m ON m.wcId = b.wcId AND m.wcSource = 'main'
    SET oi.productId = m.id
    WHERE b.id IN (${idList})
  `);
  console.log('Order items re-pointed');

  // Step 6: Delete brass product rows
  await conn.execute(`DELETE FROM products WHERE id IN (${idList})`);
  console.log(`Deleted ${pairs.length} brass product rows`);

  // Verify
  const [remaining] = await conn.execute('SELECT COUNT(*) as cnt FROM products WHERE wcSource = "brass"');
  console.log(`\nRemaining brass product rows: ${remaining[0].cnt} (should be 0)`);

  const [productCount] = await conn.execute('SELECT COUNT(*) as cnt FROM products');
  console.log(`Total product rows now: ${productCount[0].cnt}`);

  // Sample: show products with stock in multiple warehouses
  const [sample] = await conn.execute(`
    SELECT p.name,
      MAX(CASE WHEN w.type = 'online' THEN ws.quantity END) AS onlineQty,
      MAX(CASE WHEN w.type = 'pos' THEN ws.quantity END) AS posQty,
      MAX(CASE WHEN w.type = 'main' THEN ws.quantity END) AS mainQty
    FROM products p
    JOIN warehouse_stock ws ON ws.productId = p.id AND ws.variantId IS NULL
    JOIN warehouses w ON w.id = ws.warehouseId
    GROUP BY p.id, p.name
    HAVING onlineQty IS NOT NULL AND posQty IS NOT NULL
    LIMIT 10
  `);
  console.log('\nProducts with both Online + POS stock:');
  sample.forEach(r => console.log(`  ${r.name} | Online: ${r.onlineQty} | POS: ${r.posQty} | Main: ${r.mainQty}`));

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
