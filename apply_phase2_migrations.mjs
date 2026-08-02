import { config } from 'dotenv';
config();
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('DATABASE_URL is required'); process.exit(1); }

const connection = await mysql.createConnection(dbUrl);
console.log('Connected to database');

const statements = [
  // email_templates table
  `CREATE TABLE IF NOT EXISTS \`email_templates\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`templateType\` enum('order_confirmation','order_status_change','admin_new_order') NOT NULL,
    \`subjectOverride\` varchar(255),
    \`headerText\` varchar(512),
    \`footerText\` varchar(512),
    \`brandColor\` varchar(16),
    \`bgColor\` varchar(16),
    \`statusMessages\` json,
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY \`email_templates_type_unique\` (\`templateType\`)
  )`,
  // currency_rates table
  `CREATE TABLE IF NOT EXISTS \`currency_rates\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`currency\` varchar(8) NOT NULL,
    \`rate\` decimal(18,6) NOT NULL,
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY \`currency_rates_currency_unique\` (\`currency\`)
  )`,
  // custom_roles table
  `CREATE TABLE IF NOT EXISTS \`custom_roles\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`name\` varchar(64) NOT NULL,
    \`description\` varchar(255),
    \`color\` varchar(16),
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY \`custom_roles_name_unique\` (\`name\`)
  )`,
  // role_permissions table
  `CREATE TABLE IF NOT EXISTS \`role_permissions\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`roleId\` int NOT NULL,
    \`module\` varchar(64) NOT NULL,
    \`canView\` tinyint(1) NOT NULL DEFAULT 0,
    \`canEdit\` tinyint(1) NOT NULL DEFAULT 0,
    \`canDelete\` tinyint(1) NOT NULL DEFAULT 0,
    UNIQUE KEY \`role_permissions_role_module_unique\` (\`roleId\`, \`module\`)
  )`,
  // product_reviews table
  `CREATE TABLE IF NOT EXISTS \`product_reviews\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`productId\` int NOT NULL,
    \`userId\` int,
    \`guestName\` varchar(128),
    \`guestEmail\` varchar(255),
    \`rating\` tinyint NOT NULL,
    \`title\` varchar(255),
    \`body\` text,
    \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
  )`,
  // Add ogImage column to products if not exists
  `ALTER TABLE \`products\` ADD COLUMN IF NOT EXISTS \`ogImage\` varchar(512)`,
  // Add tapSecretKey to store_settings if not exists
  `ALTER TABLE \`store_settings\` ADD COLUMN IF NOT EXISTS \`tapSecretKey\` varchar(255)`,
  // Add codEnabled to store_settings if not exists
  `ALTER TABLE \`store_settings\` ADD COLUMN IF NOT EXISTS \`codEnabled\` tinyint(1) NOT NULL DEFAULT 0`,
  // Add resetToken to users if not exists
  `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`resetToken\` varchar(255)`,
  // Add resetTokenExpires to users if not exists
  `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`resetTokenExpires\` bigint`,
  // Add customRoleId to users if not exists
  `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`customRoleId\` int`,
  // Add passwordHash to users if not exists
  `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`passwordHash\` varchar(255)`,
  // Add loginMethod to users if not exists
  `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`loginMethod\` varchar(32)`,
];

for (const sql of statements) {
  try {
    await connection.execute(sql);
    const tableName = sql.match(/TABLE\s+(?:IF NOT EXISTS\s+)?`?(\w+)`?/i)?.[1] || 
                      sql.match(/TABLE\s+`(\w+)`/i)?.[1] ||
                      sql.match(/`(\w+)`\s+ADD/i)?.[1] || 'unknown';
    console.log(`✓ ${tableName}`);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column')) {
      console.log(`  (column already exists, skipping)`);
    } else {
      console.error(`✗ Error: ${err.message}`);
    }
  }
}

console.log('\n✅ Phase 2 migrations applied!');
await connection.end();
