// server/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Ensure we load the .env from the server folder explicitly
const envPath = path.resolve(process.cwd(), 'server', '.env');
dotenv.config({ path: envPath });

export const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'healthcare_chatbot',
});

console.log('✅ Connected to MySQL (server/db.js) using DB_HOST=%s DB_USER=%s', process.env.DB_HOST, process.env.DB_USER);
