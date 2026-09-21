import { Hono } from 'hono';
import { ok } from '../lib/response';

const STARTED_AT = new Date().toISOString();

/** `startedAt` dağıtımın gerçekten yenilendiğini dışarıdan doğrulamak için (CI durumu görünmezken). */
export const health = new Hono().get('/', (c) =>
  ok(c, { service: 'evidex-api', time: new Date().toISOString(), startedAt: STARTED_AT }),
);
