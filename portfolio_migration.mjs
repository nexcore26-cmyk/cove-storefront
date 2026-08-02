import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

// Load .env manually
const envFile = readFileSync('/home/manus/cove-storefront/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
}

const conn = await mysql.createConnection(env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS portfolio_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(120) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    nameAr VARCHAR(255),
    type ENUM('portfolio','events') NOT NULL DEFAULT 'portfolio',
    sortOrder INT NOT NULL DEFAULT 0,
    isVisible TINYINT(1) NOT NULL DEFAULT 1,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS portfolio_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    categoryId INT NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    titleAr VARCHAR(255),
    description TEXT,
    descriptionAr TEXT,
    coverImage VARCHAR(1024),
    videoUrl VARCHAR(1024),
    sortOrder INT NOT NULL DEFAULT 0,
    isVisible TINYINT(1) NOT NULL DEFAULT 1,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pi_category FOREIGN KEY (categoryId) REFERENCES portfolio_categories(id) ON DELETE CASCADE,
    INDEX portfolio_items_categoryId_idx (categoryId)
  )`,
  `CREATE TABLE IF NOT EXISTS portfolio_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itemId INT NOT NULL,
    url VARCHAR(1024) NOT NULL,
    altText VARCHAR(255),
    sortOrder INT NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pimg_item FOREIGN KEY (itemId) REFERENCES portfolio_items(id) ON DELETE CASCADE,
    INDEX portfolio_images_itemId_idx (itemId)
  )`,
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    console.log(`✅ Created: ${tableName}`);
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

await conn.end();
console.log('Migration complete.');
