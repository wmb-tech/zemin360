import { createDb } from '@evidex/db';
import { createApp } from './app';
import { loadEnv } from './lib/env';

const env = loadEnv();
const app = createApp({ env, db: createDb(env.DATABASE_URL) });

export default { port: env.API_PORT, fetch: app.fetch };
console.log(`evidex-api :${env.API_PORT}`);
