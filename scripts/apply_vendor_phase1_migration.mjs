import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const connection = await mysql.createConnection(url);

async function columnExists(table, column) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function ensureColumn(table, column, ddl) {
  if (await columnExists(table, column)) {
    console.log(`✓ ${table}.${column} already exists`);
    return;
  }
  await connection.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  console.log(`+ Added ${table}.${column}`);
}

async function ensureIndex(table, indexName, ddl) {
  if (await indexExists(table, indexName)) {
    console.log(`✓ ${table}.${indexName} already exists`);
    return;
  }
  await connection.execute(`ALTER TABLE ${table} ADD ${ddl}`);
  console.log(`+ Added index ${indexName}`);
}

try {
  await connection.beginTransaction();
  await ensureColumn('vendors', 'tenantId', '`tenantId` INT NOT NULL DEFAULT 1');
  await ensureColumn('vendors', 'status', "`status` ENUM('active','inactive','pending','archived') NOT NULL DEFAULT 'active'");
  await ensureColumn('vendors', 'portalUsername', '`portalUsername` VARCHAR(255) NULL');
  await ensureColumn('vendors', 'portalPasswordHash', '`portalPasswordHash` VARCHAR(255) NULL');
  await ensureColumn('vendors', 'lastLoginAt', '`lastLoginAt` TIMESTAMP NULL');
  await ensureColumn('vendors', 'inviteToken', '`inviteToken` VARCHAR(128) NULL');
  await ensureColumn('vendors', 'inviteTokenExpiresAt', '`inviteTokenExpiresAt` TIMESTAMP NULL');

  await connection.execute("UPDATE vendors SET tenantId = 1 WHERE tenantId IS NULL OR tenantId = 0");
  await connection.execute("UPDATE vendors SET status = CASE WHEN isActive = 1 THEN 'active' ELSE 'inactive' END WHERE status IS NULL");

  await ensureIndex('vendors', 'vendors_tenant_idx', 'INDEX `vendors_tenant_idx` (`tenantId`)');
  await ensureIndex('vendors', 'vendors_status_idx', 'INDEX `vendors_status_idx` (`status`)');
  await ensureIndex('vendors', 'vendors_tenant_portal_username_unique', 'UNIQUE INDEX `vendors_tenant_portal_username_unique` (`tenantId`, `portalUsername`)');

  await connection.commit();
  console.log('Vendor phase 1 migration completed successfully');
} catch (error) {
  await connection.rollback();
  console.error('Vendor phase 1 migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
