// Test DB'yi sıfırlar: şema düşer, migration'lar yeniden koşar. ⚠ Yalnız *_test veritabanında.
import { sql } from 'drizzle-orm';
import { createDb } from './index';

const url = process.env.DATABASE_URL ?? '';
if (!url.endsWith('_test')) throw new Error('resetTest yalnız _test veritabanında çalışır');
const db = createDb(url);
await db.execute(
  sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;`,
);
console.log('test db reset');
process.exit(0);
