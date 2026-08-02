import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const sql = `CREATE TABLE IF NOT EXISTS \`categories\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`wcId\` int,
      \`wcSource\` enum('main','brass'),
      \`name\` varchar(255) NOT NULL,
      \`slug\` varchar(255) NOT NULL,
      \`channel\` enum('online','pos','both','none') NOT NULL DEFAULT 'none',
      \`isActive\` boolean NOT NULL DEFAULT true,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`categories_id\` PRIMARY KEY(\`id\`)
    )`;
    await conn.execute(sql);
    console.log('Test table created successfully');
    await conn.execute('DROP TABLE IF EXISTS categories');
  } catch(e: any) {
    console.error('Error:', e.message);
    console.error('Code:', e.code);
    console.error('SQL Message:', e.sqlMessage);
  } finally {
    await conn.end();
  }
}
main();
