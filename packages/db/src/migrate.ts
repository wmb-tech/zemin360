import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './index';

const db = createDb();
await migrate(db, { migrationsFolder: new URL('../migrations', import.meta.url).pathname });
console.log('migrations applied');
process.exit(0);
