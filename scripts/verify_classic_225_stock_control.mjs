import mysql from "mysql2/promise";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const conn = await mysql.createConnection({ uri: url, multipleStatements: false });

function parseJson(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

try {
  const [products] = await conn.query(
    `SELECT id, name, slug, sku, type, status
     FROM products
     WHERE name LIKE ? OR slug LIKE ? OR sku LIKE ?
     ORDER BY id`,
    ["%Classic%225%", "%classic%225%", "%225%"]
  );

  const filtered = products.filter((p) => /classic/i.test(`${p.name} ${p.slug} ${p.sku}`) && /225/.test(`${p.name} ${p.slug} ${p.sku}`));
  const targetProducts = filtered.length > 0 ? filtered : products.slice(0, 10);
  const productIds = targetProducts.map((p) => p.id);

  let assignments = [];
  let activeValues = [];
  let stockRows = [];
  let summary = [];
  let variants = [];
  let column = [];

  const [columnRows] = await conn.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_attributes' AND COLUMN_NAME = 'stockControlling'`
  );
  column = columnRows;

  if (productIds.length > 0) {
    const placeholders = productIds.map(() => "?").join(",");
    const [assignmentRows] = await conn.query(
      `SELECT pa.productId, pa.attributeId, a.name AS attributeName, a.displayType, a.type AS attributeType,
              pa.activeValueIds, pa.galleryControlling, pa.isImageMaster, pa.stockControlling, pa.sortOrder
       FROM product_attributes pa
       INNER JOIN attributes a ON a.id = pa.attributeId
       WHERE pa.productId IN (${placeholders})
       ORDER BY pa.productId, pa.sortOrder, pa.attributeId`,
      productIds
    );
    assignments = assignmentRows.map((row) => ({ ...row, activeValueIds: parseJson(row.activeValueIds) ?? [] }));

    const valueIds = [...new Set(assignments.flatMap((a) => Array.isArray(a.activeValueIds) ? a.activeValueIds : []))];
    if (valueIds.length > 0) {
      const vp = valueIds.map(() => "?").join(",");
      const [valueRows] = await conn.query(
        `SELECT av.id, av.attributeId, a.name AS attributeName, av.labelEn, av.labelAr, av.manageStock, av.isBundle, av.isEnabled
         FROM attribute_values av
         INNER JOIN attributes a ON a.id = av.attributeId
         WHERE av.id IN (${vp})
         ORDER BY av.attributeId, av.sortOrder, av.id`,
        valueIds
      );
      activeValues = valueRows;
    }

    const [stock] = await conn.query(
      `SELECT ws.productId, ws.variantId, ws.warehouseId, w.name AS warehouseName, w.code AS warehouseCode, w.type AS warehouseType,
              ws.quantity, ws.reservedQty, ws.outOfStockThresholdEnabled, ws.outOfStockThreshold
       FROM warehouse_stock ws
       INNER JOIN warehouses w ON w.id = ws.warehouseId
       WHERE ws.productId IN (${placeholders})
       ORDER BY ws.productId, ws.warehouseId, ws.variantId IS NOT NULL, ws.variantId`,
      productIds
    );
    stockRows = stock;

    const summaryMap = new Map();
    for (const row of stockRows) {
      const key = `${row.productId}:${row.warehouseId}`;
      const entry = summaryMap.get(key) ?? {
        productId: row.productId,
        warehouseId: row.warehouseId,
        warehouseName: row.warehouseName,
        warehouseType: row.warehouseType,
        quantity: 0,
        unallocatedQuantity: 0,
        allocatedVariationQuantity: 0,
        outOfStockThresholdEnabled: row.outOfStockThresholdEnabled,
        outOfStockThreshold: row.outOfStockThreshold,
      };
      const qty = Number(row.quantity ?? 0);
      if (row.variantId == null) {
        entry.unallocatedQuantity += qty;
        entry.outOfStockThresholdEnabled = row.outOfStockThresholdEnabled;
        entry.outOfStockThreshold = row.outOfStockThreshold;
      } else {
        entry.allocatedVariationQuantity += qty;
      }
      entry.quantity = entry.unallocatedQuantity + entry.allocatedVariationQuantity;
      summaryMap.set(key, entry);
    }
    summary = [...summaryMap.values()];

    const [variantRows] = await conn.query(
      `SELECT id, productId, sku, name, attributes, manageStock, isActive
       FROM product_variants
       WHERE productId IN (${placeholders})
       ORDER BY productId, id
       LIMIT 60`,
      productIds
    );
    variants = variantRows.map((row) => ({ ...row, attributes: parseJson(row.attributes) }));
  }

  console.log(JSON.stringify({
    searched: "Classic 225",
    stockControllingColumn: column,
    matchedProducts: targetProducts,
    assignments,
    activeValues,
    stockRows,
    stockSummaryEquivalentToRoute: summary,
    sampleVariants: variants,
  }, null, 2));
} finally {
  await conn.end();
}
