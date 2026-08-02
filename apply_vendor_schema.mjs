import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function addVendorAuthColumns() {
  const connection = await pool.getConnection();
  try {
    console.log('Checking if vendor columns exist...');
    
    const [columns] = await connection.query(
      'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = "vendors" AND COLUMN_NAME IN ("username", "password_hash")'
    );
    
    if (columns.length === 0) {
      console.log('Adding username and password_hash columns to vendors table...');
      await connection.query('ALTER TABLE vendors ADD COLUMN username VARCHAR(255) UNIQUE');
      await connection.query('ALTER TABLE vendors ADD COLUMN password_hash VARCHAR(255)');
      console.log('✓ Columns added successfully');
    } else {
      console.log('✓ Columns already exist');
    }
    
    // Verify columns exist
    const [verify] = await connection.query(
      'DESCRIBE vendors'
    );
    const hasUsername = verify.some(col => col.Field === 'username');
    const hasPassword = verify.some(col => col.Field === 'password_hash');
    
    if (hasUsername && hasPassword) {
      console.log('✓ Verification: Both columns present in vendors table');
      process.exit(0);
    } else {
      console.error('✗ Verification failed: Columns not found');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await connection.release();
    await pool.end();
  }
}

addVendorAuthColumns();
