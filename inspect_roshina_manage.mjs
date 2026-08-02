import "dotenv/config";
import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
async function columns(table){ const [rows] = await conn.execute(`SHOW COLUMNS FROM ${table}`); return rows.map(r=>r.Field); }
async function selectExisting(table, candidates){ const cols = await columns(table); return candidates.filter(c => cols.includes(c)); }
const prodCols = await selectExisting("products", ["id","name","slug","type","status","stockQuantity","stock_quantity","stock","stockStatus","stock_status","manageStock","manage_stock","images","price","salePrice"]);
const [products] = await conn.execute(`SELECT ${prodCols.join(",")} FROM products WHERE slug=?`, ["roshina-3-maroon"]);
console.log(JSON.stringify({ productColumns: prodCols, product: products[0] ?? null }, null, 2));
const p = products[0];
if (!p) { await conn.end(); process.exit(0); }
const pvCols = await selectExisting("product_variants", ["id","productId","product_id","name","sku","attributes","stockQuantity","stock_quantity","stock","stockStatus","stock_status","manageStock","manage_stock","price","salePrice"]);
const productIdCol = pvCols.includes("productId") ? "productId" : "product_id";
const [variants] = await conn.execute(`SELECT ${pvCols.join(",")} FROM product_variants WHERE ${productIdCol}=? ORDER BY id`, [p.id]);
console.log(JSON.stringify({ variantColumns: pvCols, variants }, null, 2));
const [warehouses] = await conn.execute("SELECT id,name,code,type FROM warehouses ORDER BY id");
console.log(JSON.stringify({ warehouses }, null, 2));
const wsCols = await selectExisting("warehouse_stock", ["id","warehouseId","warehouse_id","productId","product_id","variantId","variant_id","quantity","reservedQty","reserved_qty","availableQty","available_qty","manageStock","stockStatus","updatedAt"]);
const wsProductCol = wsCols.includes("productId") ? "productId" : "product_id";
const wsWarehouseCol = wsCols.includes("warehouseId") ? "warehouseId" : "warehouse_id";
const wsVariantCol = wsCols.includes("variantId") ? "variantId" : "variant_id";
const [stockRows] = await conn.execute(`SELECT ${wsCols.join(",")} FROM warehouse_stock WHERE ${wsProductCol}=? ORDER BY ${wsWarehouseCol}, ${wsVariantCol} IS NULL DESC, ${wsVariantCol}`, [p.id]);
console.log(JSON.stringify({ warehouseStockColumns: wsCols, warehouseStock: stockRows }, null, 2));
const paCols = await selectExisting("product_attributes", ["id","productId","product_id","attributeId","attribute_id","activeValueIds","active_value_ids","galleryControlling","gallery_controlling","stockControlling","stock_controlling","isImageMaster","createdAt","updatedAt"]);
const paProductCol = paCols.includes("productId") ? "productId" : "product_id";
const [paRows] = await conn.execute(`SELECT ${paCols.join(",")} FROM product_attributes WHERE ${paProductCol}=? ORDER BY id`, [p.id]);
console.log(JSON.stringify({ productAttributeColumns: paCols, productAttributes: paRows }, null, 2));
const [tables] = await conn.execute("SHOW TABLES LIKE product_attribute_values");
if (tables.length > 0) {
  const pavCols = await selectExisting("product_attribute_values", ["id","productId","product_id","attributeId","attribute_id","valueId","value_id","manageStock","manage_stock","onlineQty","online_qty","posQty","pos_qty","isEnabled","is_enabled","price","salePrice","stockQuantity","createdAt","updatedAt"]);
  const pavProductCol = pavCols.includes("productId") ? "productId" : "product_id";
  const pavAttrCol = pavCols.includes("attributeId") ? "attributeId" : "attribute_id";
  const pavValueCol = pavCols.includes("valueId") ? "valueId" : "value_id";
  const [pavRows] = await conn.execute(`SELECT ${pavCols.join(",")} FROM product_attribute_values WHERE ${pavProductCol}=? ORDER BY ${pavAttrCol},${pavValueCol}`, [p.id]);
  console.log(JSON.stringify({ productAttributeValueColumns: pavCols, productAttributeValues: pavRows }, null, 2));
}
await conn.end();
