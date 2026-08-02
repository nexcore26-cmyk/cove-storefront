/**
 * merge-brass-products.mjs
 *
 * Merges brass-source duplicate product rows into their main-source counterparts.
 * Strategy:
 *   1. For each brass product that has a matching main product (same wcId):
 *      a. Reassign warehouse_stock rows from brass productId → main productId
 *      b. Reassign product_variants rows from brass productId → main productId
 *      c. Reassign order_items rows from brass productId → main productId
 *      d. Delete the brass product row
 *   2. For brass products with NO matching main product (unique to brass):
 *      - Keep them but update wcSource to 'main' so they are treated as canonical
 *   3. Update the drizzle migration journal so db:push doesn't try to re-apply
 */

import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

console.log('=== Product Merge Migration ===\n');

// Step 1: Find all brass products and their main counterparts
const [brassProducts] = await conn.execute(`
  SELECT b.id as brassId, b.name as brassName, b.wcId,
         m.id as mainId, m.name as mainName
  FROM products b
  LEFT JOIN products m ON m.wcId = b.wcId AND m.wcSource = 'main'
  WHERE b.wcSource = 'brass'
  ORDER BY b.wcId
`);

console.log(`Found ${brassProducts.length} brass products`);

let merged = 0;
let promoted = 0;
let skipped = 0;

for (const row of brassProducts) {
  if (row.mainId) {
    // Has a main counterpart — merge into it
    const brassId = row.brassId;
    const mainId = row.mainId;

    // Reassign warehouse_stock: if main already has a stock row for same warehouse,
    // ADD the quantities together; otherwise just reassign
    const [brassStock] = await conn.execute(
      `SELECT * FROM warehouse_stock WHERE productId = ?`,
      [brassId]
    );

    for (const bs of brassStock) {
      const [mainStock] = await conn.execute(
        `SELECT id, quantity FROM warehouse_stock WHERE productId = ? AND warehouseId = ? AND variantId <=> ?`,
        [mainId, bs.warehouseId, bs.variantId]
      );

      if (mainStock.length > 0) {
        // Main already has stock in this warehouse — add quantities
        await conn.execute(
          `UPDATE warehouse_stock SET quantity = quantity + ? WHERE id = ?`,
          [bs.quantity, mainStock[0].id]
        );
        // Delete the brass stock row
        await conn.execute(`DELETE FROM warehouse_stock WHERE id = ?`, [bs.id]);
      } else {
        // No main stock row — reassign the brass row to main product
        await conn.execute(
          `UPDATE warehouse_stock SET productId = ? WHERE id = ?`,
          [mainId, bs.id]
        );
      }
    }

    // Reassign product_variants (brass variants → main product)
    // Only if main doesn't already have the same wcVariantId
    const [brassVariants] = await conn.execute(
      `SELECT * FROM product_variants WHERE productId = ?`,
      [brassId]
    );

    for (const bv of brassVariants) {
      if (bv.wcVariantId) {
        const [mainVariant] = await conn.execute(
          `SELECT id FROM product_variants WHERE productId = ? AND wcVariantId = ?`,
          [mainId, bv.wcVariantId]
        );
        if (mainVariant.length > 0) {
          // Main already has this variant — delete the brass duplicate
          // First reassign any warehouse_stock that points to brass variant
          await conn.execute(
            `UPDATE warehouse_stock SET productId = ?, variantId = ? WHERE productId = ? AND variantId = ?`,
            [mainId, mainVariant[0].id, brassId, bv.id]
          );
          await conn.execute(`DELETE FROM product_variants WHERE id = ?`, [bv.id]);
        } else {
          // Reassign variant to main product
          await conn.execute(
            `UPDATE product_variants SET productId = ? WHERE id = ?`,
            [mainId, bv.id]
          );
        }
      } else {
        // No wcVariantId — reassign to main
        await conn.execute(
          `UPDATE product_variants SET productId = ? WHERE id = ?`,
          [mainId, bv.id]
        );
      }
    }

    // Reassign order_items
    await conn.execute(
      `UPDATE order_items SET productId = ? WHERE productId = ?`,
      [mainId, brassId]
    );

    // Delete the brass product row
    await conn.execute(`DELETE FROM products WHERE id = ?`, [brassId]);
    merged++;
  } else {
    // No main counterpart — promote brass product to main source
    await conn.execute(
      `UPDATE products SET wcSource = 'main' WHERE id = ?`,
      [row.brassId]
    );
    promoted++;
    console.log(`  Promoted (no main match): [${row.brassId}] ${row.brassName} (wcId=${row.wcId})`);
  }
}

console.log(`\n✓ Merged ${merged} brass products into their main counterparts`);
console.log(`✓ Promoted ${promoted} brass-only products to main source`);
console.log(`✓ Skipped ${skipped}`);

// Final counts
const [counts] = await conn.execute(`
  SELECT wcSource, COUNT(*) as cnt FROM products GROUP BY wcSource
`);
console.log('\nProduct counts after merge:');
counts.forEach(r => console.log(`  ${r.wcSource}: ${r.cnt}`));

const [stockCounts] = await conn.execute(`
  SELECT w.name, COUNT(ws.id) as rows, SUM(ws.quantity) as totalQty
  FROM warehouse_stock ws
  JOIN warehouses w ON w.id = ws.warehouseId
  GROUP BY w.id, w.name
`);
console.log('\nWarehouse stock after merge:');
stockCounts.forEach(r => console.log(`  ${r.name}: ${r.rows} rows, ${r.totalQty} total qty`));

await conn.end();
console.log('\nDone!');
