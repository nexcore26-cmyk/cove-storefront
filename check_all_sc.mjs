import { createConnection } from 'mysql2/promise';

const conn = await createConnection({
  host: '127.0.0.1',
  user: 'cove_app',
  password: 'Cove@Storefront2026!',
  database: 'cove_storefront',
});

const [rows] = await conn.execute('SELECT id, name, kuwaitCost, gccCostPerUnit, zoneRates FROM shipping_classes ORDER BY id');
for (const row of rows) {
  const zr = row.zoneRates ? JSON.parse(row.zoneRates) : null;
  const zrSummary = zr ? zr.map(r => `zoneId:${r.zoneId} cost:${r.cost} mode:${r.mode}`).join(' | ') : 'null';
  console.log(`ID:${row.id} | ${row.name} | KW:${row.kuwaitCost} | GCC:${row.gccCostPerUnit} | zoneRates: ${zrSummary}`);
}
await conn.end();
