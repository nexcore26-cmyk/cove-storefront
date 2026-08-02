import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const connection = await mysql.createConnection(databaseUrl);

async function columnExists(table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function addColumn(table, column, ddl) {
  if (await columnExists(table, column)) {
    console.log(`✓ ${table}.${column} already exists`);
    return;
  }
  console.log(`+ Adding ${table}.${column}`);
  await connection.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

await addColumn('store_settings', 'myfatoorahWebhookSecret', '`myfatoorahWebhookSecret` text');
await addColumn('store_settings', 'myfatoorahCountryCode', '`myfatoorahCountryCode` varchar(8) DEFAULT \'KWT\'');
await addColumn('orders', 'paymentInvoiceId', '`paymentInvoiceId` varchar(256)');
await addColumn('orders', 'paymentId', '`paymentId` varchar(256)');
await addColumn('orders', 'paymentTransactionId', '`paymentTransactionId` varchar(256)');
await addColumn('orders', 'paymentGatewayName', '`paymentGatewayName` varchar(128)');
await addColumn('orders', 'paymentProviderData', '`paymentProviderData` json');

await connection.end();
console.log('Native payment gateway migration complete.');
