import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

function loadEnv(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

loadEnv(path.resolve(process.cwd(), '.env'));
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const slug = 'roshina-3-light-blue';
const requestedTransfer = 8;

const [products] = await conn.query('SELECT id, name, slug FROM products WHERE slug = ?', [slug]);
if (!products.length) throw new Error(`Product not found: ${slug}`);
const product = products[0];

const [warehouses] = await conn.query('SELECT id, name, type FROM warehouses ORDER BY id');
const mainWarehouse = warehouses.find(w => w.type === 'main' || /main/i.test(w.name));
const onlineWarehouse = warehouses.find(w => w.type === 'online' || /online/i.test(w.name));
if (!mainWarehouse || !onlineWarehouse) throw new Error('Could not resolve Main and Online warehouses');

const [stockRows] = await conn.query(`
  SELECT ws.id, ws.warehouseId, w.name AS warehouseName, w.type AS warehouseType, ws.productId, ws.variantId, ws.quantity, ws.reservedQty
  FROM warehouse_stock ws
  JOIN warehouses w ON w.id = ws.warehouseId
  WHERE ws.productId = ? AND ws.variantId IS NULL
  ORDER BY w.id
`, [product.id]);

const mainStock = stockRows.find(r => r.warehouseId === mainWarehouse.id);
const onlineStock = stockRows.find(r => r.warehouseId === onlineWarehouse.id);
const distributedTotal = stockRows.filter(r => ['online', 'pos'].includes(r.warehouseType)).reduce((sum, r) => sum + Number(r.quantity || 0), 0);
const oldAvailable = Number(mainStock?.quantity || 0) - distributedTotal;
const newAvailable = Number(mainStock?.quantity || 0);

const result = {
  product,
  requestedTransfer,
  mainWarehouse,
  onlineWarehouse,
  stockRows,
  previousIncorrectRule: {
    formula: 'mainQty - distributedOnlineAndPosQty',
    mainQty: Number(mainStock?.quantity || 0),
    distributedTotal,
    available: oldAvailable,
    wouldAllow: requestedTransfer <= oldAvailable,
  },
  correctedRule: {
    formula: 'sourceWarehouseRowQty',
    sourceWarehouseQty: newAvailable,
    requestedTransfer,
    wouldAllow: requestedTransfer <= newAvailable,
    expectedAfterTransferIfAdminRunsIt: {
      mainWarehouseQty: newAvailable - requestedTransfer,
      onlineStoreQty: Number(onlineStock?.quantity || 0) + requestedTransfer,
    },
  },
};

console.log(JSON.stringify(result, null, 2));
await conn.end();
