// 建库建表：读取 db/schema.sql 并逐条执行
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

const sql = fs.readFileSync(schemaPath, 'utf-8');
await conn.query(sql);
console.log('✓ 数据库与表结构已创建（am_database）');

await conn.end();
