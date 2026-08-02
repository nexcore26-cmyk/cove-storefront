const mysql = require('mysql2/promise');

function normalize(value) {
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  }
  return value;
}

(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [warehouses] = await conn.query(`
      SELECT id, name, type, isOnline, isActive
      FROM warehouses
      WHERE isActive = 1
      ORDER BY id
    `);

    const [rows] = await conn.query(`
      SELECT
        bv.id AS bundleVariantId,
        bv.wcVariantId AS wcVariantId,
        bv.name AS bundleName,
        bi.id AS bundleItemId,
        bi.componentProductId,
        bi.componentVariantId,
        bi.stockSourceType,
        bi.qty,
        cp.name AS componentProductName,
        w.id AS warehouseId,
        w.name AS warehouseName,
        w.type AS warehouseType,
        w.isOnline,
        COALESCE(ms.quantity, 0) AS mainQty,
        COALESCE(cs.quantity, 0) AS componentQty,
        LEAST(COALESCE(ms.quantity, 0), FLOOR(COALESCE(cs.quantity, 0) / CAST(bi.qty AS DECIMAL(10,3)))) AS effectiveQty
      FROM product_variants bv
      JOIN bundle_items bi ON bi.bundleVariantId = bv.id
      LEFT JOIN products cp ON cp.id = bi.componentProductId
      JOIN warehouses w ON w.isActive = 1
      LEFT JOIN warehouse_stock ms ON ms.warehouseId = w.id AND ms.variantId = bv.id
      LEFT JOIN warehouse_stock cs ON cs.warehouseId = w.id AND cs.productId = bi.componentProductId AND cs.variantId IS NULL
      WHERE bv.productId = 390147 AND bv.wcVariantId IN (17395, 17397)
      ORDER BY bv.wcVariantId, w.id
    `);

    console.log(JSON.stringify(normalize({ warehouses, bundleRows: rows }), null, 2));
  } finally {
    await conn.end();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
