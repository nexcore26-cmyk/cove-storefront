import { config } from "dotenv";
import mysql from "mysql2/promise";

config();

const connectionString = process.env.DATABASE_URL;

async function addVendorAuthColumns() {
  const connection = await mysql.createConnection(connectionString);
  try {
    console.log("Checking if vendor columns exist...");
    
    const [dbResult] = await connection.query("SELECT DATABASE() as db");
    const dbName = dbResult[0].db;
    console.log("Connected to database:", dbName);
    
    try {
      await connection.query("ALTER TABLE vendors ADD COLUMN username VARCHAR(255) UNIQUE");
      console.log("✓ Added username column");
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("✓ username column already exists");
      } else {
        throw e;
      }
    }
    
    try {
      await connection.query("ALTER TABLE vendors ADD COLUMN password_hash VARCHAR(255)");
      console.log("✓ Added password_hash column");
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("✓ password_hash column already exists");
      } else {
        throw e;
      }
    }
    
    const [verify] = await connection.query("DESCRIBE vendors");
    const columnNames = verify.map(col => col.Field);
    const hasUsername = columnNames.includes("username");
    const hasPassword = columnNames.includes("password_hash");
    
    console.log("Vendor table columns:", columnNames.join(", "));
    
    if (hasUsername && hasPassword) {
      console.log("✓ SUCCESS: Both columns present in vendors table");
      process.exit(0);
    } else {
      console.error("✗ FAILED: Columns not found");
      process.exit(1);
    }
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

addVendorAuthColumns();
