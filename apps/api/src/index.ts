import { createDb } from '@evidex/db';
import { createApp } from './app';
import { loadEnv } from './lib/env';
import { startScheduler } from './jobs/scheduler';

const env = loadEnv();
const { app, followUp } = createApp({ env, db: createDb(env.DATABASE_URL) });
startScheduler({ followUp }, env.SCHEDULER_INTERVAL_MIN);

// ⚠ Bun varsayılan 10 sn boşta zaman aşımı; ajan çağrıları (Gemini Pro ~20 sn) kesilir.
export default { port: env.API_PORT, fetch: app.fetch, idleTimeout: 120 };
console.log(`evidex-api :${env.API_PORT}`);
