import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config();

const connectionString = process.env.DATABASE_URL;

async function addVendorAuthColumns() {
  const connection = await mysql.createConnection(connectionString);
  try {
    console.log('Checking if vendor columns exist...');
    
    // Get database name from connection
    const [dbResult] = await connection.query('SELECT DATABASE() as db');
    const dbName = dbResult[0].db;
    console.log('Connected to database:', dbName);
    
    const [columns] = await connection.query(
      ,
      [dbName]
    );
    
    if (columns.length === 0) {
      console.log('Adding username and password_hash columns to vendors table...');
      try {
        await connection.query('ALTER TABLE vendors ADD COLUMN username VARCHAR(255) UNIQUE');
        console.log('✓ Added username column');
      } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
        console.log('✓ username column already exists');
      }
      
      try {
        await connection.query('ALTER TABLE vendors ADD COLUMN password_hash VARCHAR(255)');
        console.log('✓ Added password_hash column');
      } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
        console.log('✓ password_hash column already exists');
      }
    } else {
      console.log('✓ Columns already exist');
    }
    
    // Verify columns exist
    const [verify] = await connection.query(
      ,
      [dbName]
    );
    
    const columnNames = verify.map(col => col.COLUMN_NAME);
    const hasUsername = columnNames.includes('username');
    const hasPassword = columnNames.includes('password_hash');
    
    console.log('Vendor table columns:', columnNames.join(', '));
    
    if (hasUsername && hasPassword) {
      console.log('✓ Verification: Both columns present in vendors table');
      process.exit(0);
    } else {
      console.error('✗ Verification failed');
      console.error('  username:', hasUsername ? 'YES' : 'NO');
      console.error('  password_hash:', hasPassword ? 'YES' : 'NO');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

addVendorAuthColumns();
