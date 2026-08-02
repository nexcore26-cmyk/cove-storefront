import 'dotenv/config';
import mysql from 'mysql2/promise';

const modules = [
  'storefront',
  'admin',
  'pos',
  'orders',
  'vendors',
  'reports',
  'returns',
  'cms',
  'settings',
];

const statements = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    status ENUM('active','suspended') NOT NULL DEFAULT 'active',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `INSERT INTO tenants (id, slug, name, status)
   VALUES (1, 'cove-interior', 'Cove Interior', 'active')
   ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status)`,
  `CREATE TABLE IF NOT EXISTS tenant_modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    moduleKey VARCHAR(64) NOT NULL,
    isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT tenant_modules_tenant_fk FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY tenant_modules_tenant_module_unique (tenantId, moduleKey),
    KEY tenant_modules_tenant_idx (tenantId)
  )`,
  `ALTER TABLE users ADD COLUMN tenantId INT NOT NULL DEFAULT 1 AFTER openId`,
  `ALTER TABLE users ADD INDEX users_tenantId_idx (tenantId)`,
  `ALTER TABLE users ADD CONSTRAINT users_tenant_fk FOREIGN KEY (tenantId) REFERENCES tenants(id)`,
  `ALTER TABLE custom_roles ADD COLUMN tenantId INT NOT NULL DEFAULT 1 AFTER id`,
  `ALTER TABLE custom_roles ADD INDEX custom_roles_tenantId_idx (tenantId)`,
  `ALTER TABLE custom_roles ADD CONSTRAINT custom_roles_tenant_fk FOREIGN KEY (tenantId) REFERENCES tenants(id)`,
  `ALTER TABLE custom_roles DROP INDEX custom_roles_name_unique`,
  `ALTER TABLE custom_roles ADD UNIQUE KEY custom_roles_tenant_name_unique (tenantId, name)`,
];

const ignoredCodes = new Set([
  'ER_DUP_FIELDNAME',
  'ER_DUP_KEYNAME',
  'ER_CANT_DROP_FIELD_OR_KEY',
  'ER_TABLE_EXISTS_ERROR',
]);

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    for (const statement of statements) {
      try {
        await connection.execute(statement);
        console.log('ok:', statement.split('\n')[0].slice(0, 100));
      } catch (error) {
        if (ignoredCodes.has(error.code)) {
          console.log('skip:', error.code, statement.split('\n')[0].slice(0, 100));
          continue;
        }
        throw error;
      }
    }

    for (const moduleKey of modules) {
      await connection.execute(
        `INSERT INTO tenant_modules (tenantId, moduleKey, isEnabled)
         VALUES (1, ?, TRUE)
         ON DUPLICATE KEY UPDATE isEnabled = VALUES(isEnabled)`,
        [moduleKey],
      );
    }

    await connection.execute(`UPDATE users SET tenantId = 1 WHERE tenantId IS NULL OR tenantId = 0`);
    await connection.execute(`UPDATE custom_roles SET tenantId = 1 WHERE tenantId IS NULL OR tenantId = 0`);

    const [tenantRows] = await connection.execute(`SELECT id, slug, status FROM tenants ORDER BY id`);
    const [moduleRows] = await connection.execute(`SELECT tenantId, moduleKey, isEnabled FROM tenant_modules ORDER BY tenantId, moduleKey`);
    console.log('tenant_rows:', JSON.stringify(tenantRows));
    console.log('module_rows:', JSON.stringify(moduleRows));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('tenant module migration failed:', error.message);
  process.exit(1);
});
