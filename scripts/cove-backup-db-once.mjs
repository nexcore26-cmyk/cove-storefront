import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const backupDir = process.env.BACKUP_DIR;
if (!backupDir) throw new Error('BACKUP_DIR is required');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
fs.mkdirSync(backupDir, { recursive: true });
const u = new URL(process.env.DATABASE_URL);
const database = u.pathname.replace(/^\//, '');
const output = path.join(backupDir, `${database}.sql.gz`);
const args = [
  '--single-transaction',
  '--quick',
  '--routines',
  '--triggers',
  '--no-tablespaces',
  '-h', u.hostname,
  '-P', u.port || '3306',
  '-u', decodeURIComponent(u.username),
  database,
];
const shell = spawnSync('bash', ['-lc', `mysqldump "$@" | gzip > "$OUT"`, 'bash', ...args], {
  env: { ...process.env, MYSQL_PWD: decodeURIComponent(u.password), OUT: output },
  stdio: 'inherit',
});
if (shell.status !== 0) process.exit(shell.status ?? 1);
console.log(`backup_file=${output}`);
