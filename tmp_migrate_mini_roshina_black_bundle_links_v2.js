const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await conn.beginTransaction();

    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const backupTable = `bundle_items_backup_mini_roshina_black_${stamp}`;
    await conn.query(`CREATE TABLE ${backupTable} AS SELECT bi.* FROM bundle_items bi JOIN product_variants bv ON bv.id = bi.bundleVariantId WHERE bv.productId = 390147`);

    const [[basic]] = await conn.query('SELECT id FROM product_variants WHERE productId = ? AND wcVariantId = ? LIMIT 1', [390147, 17395]);
    const [[full]] = await conn.query('SELECT id FROM product_variants WHERE productId = ? AND wcVariantId = ? LIMIT 1', [390147, 17397]);
    const [[component]] = await conn.query('SELECT id, name FROM products WHERE id = ? LIMIT 1', [390205]);

    if (!basic || !full || !component) {
      throw new Error(`Missing required rows: basic=${!!basic} full=${!!full} component=${!!component}`);
    }

    async function upsertBundleComponent(bundleVariantId) {
      const [existing] = await conn.query('SELECT id FROM bundle_items WHERE bundleVariantId = ? ORDER BY id LIMIT 1', [bundleVariantId]);
      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO bundle_items (bundleVariantId, componentProductId, componentVariantId, stockSourceType, qty) VALUES (?, ?, NULL, ?, ?)',
          [bundleVariantId, component.id, 'product', '1.000']
        );
      } else {
        await conn.query(
          'UPDATE bundle_items SET componentProductId = ?, componentVariantId = NULL, stockSourceType = ?, qty = ? WHERE id = ?',
          [component.id, 'product', '1.000', existing[0].id]
        );
        if (existing.length > 1) {
          const idsToDelete = existing.slice(1).map(r => r.id);
          await conn.query(`DELETE FROM bundle_items WHERE id IN (${idsToDelete.map(() => '?').join(',')})`, idsToDelete);
        }
      }
    }

    await upsertBundleComponent(basic.id);
    await upsertBundleComponent(full.id);

    await conn.commit();

    const [rows] = await conn.query(`
      SELECT bi.id, bi.bundleVariantId, bi.componentVariantId, bi.componentProductId, bi.stockSourceType, bi.qty,
             bv.wcVariantId AS bundle_wc_id, bv.name AS bundle_name, cp.name AS component_product_name
      FROM bundle_items bi
      JOIN product_variants bv ON bv.id = bi.bundleVariantId
      LEFT JOIN products cp ON cp.id = bi.componentProductId
      WHERE bv.productId = 390147
      ORDER BY bv.wcVariantId, bi.id
    `);

    console.log(JSON.stringify({ backupTable, rows }, null, 2));
  } catch (error) {
    try { await conn.rollback(); } catch (_) {}
    console.error(error);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
