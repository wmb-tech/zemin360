import { Hono } from 'hono';
import { ok } from '../lib/response';

export const health = new Hono().get('/', (c) =>
  ok(c, { service: 'evidex-api', time: new Date().toISOString() }),
);
