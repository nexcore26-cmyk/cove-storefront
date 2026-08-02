import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = { ...parseEnv(path.join(process.cwd(), ".env")), ...process.env };
const dbUrl = env.DATABASE_URL || env.MYSQL_URL;
let cfg;
if (dbUrl) {
  const u = new URL(dbUrl);
  cfg = {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
} else {
  cfg = {
    host: env.DB_HOST || env.MYSQL_HOST || "localhost",
    port: Number(env.DB_PORT || env.MYSQL_PORT || 3306),
    user: env.DB_USER || env.MYSQL_USER,
    password: env.DB_PASSWORD || env.MYSQL_PASSWORD,
    database: env.DB_NAME || env.MYSQL_DATABASE,
  };
}

const db = await mysql.createConnection(cfg);
async function q(sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows;
}
async function cols(table) {
  return (await q(`SHOW COLUMNS FROM ${table}`)).map((c) => c.Field);
}
function pick(cs, candidates) {
  return candidates.find((name) => cs.includes(name));
}

const productCols = await cols("products");
const variantCols = await cols("product_variants");
const stockCols = await cols("warehouse_stock");
const warehouseCols = await cols("warehouses");

const pId = pick(productCols, ["id", "product_id"]);
const pSlug = pick(productCols, ["slug", "product_slug"]);
const pName = pick(productCols, ["name", "title", "product_name"]);
const vId = pick(variantCols, ["id", "variant_id"]);
const vProductId = pick(variantCols, ["productId", "product_id"]);
const vSku = pick(variantCols, ["sku", "variant_sku"]);
const vName = pick(variantCols, ["name", "variant_name"]);
const vManage = pick(variantCols, ["manageStock", "manage_stock", "stockManaged", "stock_managed"]);
const sProductId = pick(stockCols, ["productId", "product_id"]);
const sVariantId = pick(stockCols, ["variantId", "variant_id"]);
const sWarehouseId = pick(stockCols, ["warehouseId", "warehouse_id"]);
const sQty = pick(stockCols, ["quantity", "stock", "qty"]);
const wId = pick(warehouseCols, ["id", "warehouse_id"]);
const wName = pick(warehouseCols, ["name", "warehouse_name"]);
const wSlug = pick(warehouseCols, ["slug", "warehouse_slug"]);

const products = await q(
  `SELECT ${pId} AS id, ${pSlug} AS slug, ${pName} AS name FROM products WHERE ${pSlug} LIKE ? OR ${pName} LIKE ? ORDER BY ${pId}`,
  ["%roshina-3-light-blue%", "%Roshina 3%Light%Blue%"]
);

const output = [];
for (const p of products) {
  const variants = await q(
    `SELECT ${vId} AS id, ${vProductId} AS productId, ${vSku} AS sku, ${vName} AS name${vManage ? `, ${vManage} AS manageStock` : ""} FROM product_variants WHERE ${vProductId} = ? ORDER BY ${vId}`,
    [p.id]
  );
  const stock = await q(
    `SELECT ws.${sProductId} AS productId, ws.${sVariantId} AS variantId, ws.${sWarehouseId} AS warehouseId, ws.${sQty} AS quantity, w.${wName} AS warehouseName${wSlug ? `, w.${wSlug} AS warehouseSlug` : ""} FROM warehouse_stock ws LEFT JOIN warehouses w ON ws.${sWarehouseId}=w.${wId} WHERE ws.${sProductId}=? ORDER BY w.${wName}, ws.${sVariantId}`,
    [p.id]
  );
  const mainStock = stock.filter((r) => String(r.warehouseName || "").toLowerCase().includes("main"));
  const onlineStock = stock.filter((r) => String(r.warehouseName || "").toLowerCase().includes("online"));
  const variantById = Object.fromEntries(variants.map((v) => [String(v.id), v]));
  const sums = {
    mainTotal: mainStock.reduce((a, r) => a + Number(r.quantity || 0), 0),
    mainProductLevel: mainStock.filter((r) => r.variantId == null).reduce((a, r) => a + Number(r.quantity || 0), 0),
    mainAllocatedManaged: mainStock.filter((r) => r.variantId != null && Number(variantById[String(r.variantId)]?.manageStock || 0) === 1).reduce((a, r) => a + Number(r.quantity || 0), 0),
    mainAllocatedUnmanaged: mainStock.filter((r) => r.variantId != null && Number(variantById[String(r.variantId)]?.manageStock || 0) !== 1).reduce((a, r) => a + Number(r.quantity || 0), 0),
    onlineTotal: onlineStock.reduce((a, r) => a + Number(r.quantity || 0), 0),
    onlineProductLevel: onlineStock.filter((r) => r.variantId == null).reduce((a, r) => a + Number(r.quantity || 0), 0),
    onlineAllocatedManaged: onlineStock.filter((r) => r.variantId != null && Number(variantById[String(r.variantId)]?.manageStock || 0) === 1).reduce((a, r) => a + Number(r.quantity || 0), 0),
    onlineAllocatedUnmanaged: onlineStock.filter((r) => r.variantId != null && Number(variantById[String(r.variantId)]?.manageStock || 0) !== 1).reduce((a, r) => a + Number(r.quantity || 0), 0),
  };
  output.push({ product: p, variants, stock, sums });
}
console.log(JSON.stringify({ app: process.cwd(), output }, null, 2));
await db.end();
