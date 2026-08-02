const fs = require('fs');
const mysql = require('mysql2/promise');

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) throw new Error('SQL path is required');
  loadEnv('.env');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is missing');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  const connection = await mysql.createConnection(databaseUrl);
  try {
    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (error && error.code === 'ER_DUP_KEYNAME') {
          console.log(`Skipped existing index: ${statement.slice(0, 80)}...`);
          continue;
        }
        throw error;
      }
    }
    const [rows] = await connection.query('SHOW TABLES LIKE ?', ['media_assets']);
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('media_assets table was not created');
    console.log('Media library migration applied and media_assets table is present.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
