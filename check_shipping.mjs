import { createConnection } from 'mysql2/promise';

const conn = await createConnection({
  host: '127.0.0.1',
  user: 'cove_app',
  password: 'Cove@Storefront2026!',
  database: 'cove_storefront',
});

const [rows] = await conn.execute('SELECT id, name, kuwait_cost, gcc_cost_per_unit, zone_rates FROM shipping_classes LIMIT 10');
for (const row of rows) {
  console.log(`ID: ${row.id} | Name: ${row.name} | KW: ${row.kuwait_cost} | GCC: ${row.gcc_cost_per_unit} | zoneRates: ${row.zone_rates}`);
}
await conn.end();
