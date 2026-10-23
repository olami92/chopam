import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from '../src/db/index.ts';

async function main() {
  console.log('Connecting to PostgreSQL and applying database schema...');
  const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  try {
    const client = await pool.connect();
    console.log('Connected to database successfully.');
    console.log('Executing schema.sql...');
    await client.query(sql);
    console.log('Schema successfully applied to the database!');
    client.release();
  } catch (error) {
    console.error('Failed to apply database schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
