import "dotenv/config";
import { createConnection } from "mysql2/promise";
import { createRequire } from "module";
import { readFileSync } from "fs";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error("No DATABASE_URL in environment"); process.exit(1); }

// Parse mysql://user:pass@host:port/db
const m = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)/);
if (!m) { console.error("Cannot parse DATABASE_URL"); process.exit(1); }
const [, user, pass, host, portStr, database] = m;
const port = parseInt(portStr || "3306");

const conn = await createConnection({ host, port, user, password: pass, database, ssl: { rejectUnauthorized: false } });

// Check if admin already exists
const [rows] = await conn.execute("SELECT id FROM users WHERE openId = 'staff:admin'");
if (rows.length > 0) {
  console.log("Admin user already exists (openId=staff:admin)");
  await conn.end();
  process.exit(0);
}

// Hash password
const bcrypt = (await import("/home/manus/cove-storefront/node_modules/bcryptjs/index.js")).default;
const hash = await bcrypt.hash("Cove@2025!", 12);

await conn.execute(
  "INSERT INTO users (openId, name, email, role, passwordHash, loginMethod, lastSignedIn, createdAt) VALUES ('staff:admin', 'Admin', NULL, 'admin', ?, 'password', NOW(), NOW())",
  [hash]
);
console.log("SUCCESS: Admin user created. username=admin password=Cove@2025!");
await conn.end();
