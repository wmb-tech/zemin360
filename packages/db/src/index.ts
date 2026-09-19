import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export * from './schema';

/**
 * Tek havuz, tek istemci. `DATABASE_URL` yoksa açıkça patlar — sessizce localhost'a
 * düşüp "bağlandı sanma" hatası üretmez.
 */
export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL tanımlı değil');
  const pool = new Pool({ connectionString: url });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
