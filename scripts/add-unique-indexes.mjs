import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function addUniqueIndex(table, indexName, columns) {
  const [indexes] = await conn.execute(`SHOW INDEX FROM ${table}`);
  const exists = indexes.some(i => i.Key_name === indexName);
  if (exists) {
    console.log(`Index ${indexName} already exists on ${table}`);
    return;
  }
  try {
    await conn.execute(`ALTER TABLE ${table} ADD UNIQUE INDEX ${indexName} (${columns})`);
    console.log(`Added unique index ${indexName} on ${table}(${columns})`);
  } catch (e) {
    console.error(`Failed to add index ${indexName}:`, e.message);
  }
}

// categories: unique on (wcId, wcSource)
await addUniqueIndex('categories', 'categories_wcId_source_unique', 'wcId, wcSource');

// products: unique on (wcId, wcSource)
await addUniqueIndex('products', 'products_wcId_source_unique', 'wcId, wcSource');

// customers: unique on (wcCustomerId, wcSource)
await addUniqueIndex('customers', 'customers_wcId_source_unique', 'wcCustomerId, wcSource');

// coupons: unique on (wcId, wcSource)
await addUniqueIndex('coupons', 'coupons_wcId_source_unique', 'wcId, wcSource');

// orders: unique on (wcOrderId, wcSource)
await addUniqueIndex('orders', 'orders_wcOrderId_source_unique', 'wcOrderId, wcSource');

await conn.end();
console.log('All unique indexes applied.');
