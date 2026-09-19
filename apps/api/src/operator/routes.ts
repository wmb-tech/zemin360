import { Hono } from 'hono';
import { z } from 'zod';
import { withRole } from '../auth/middleware';
import type { AuthService } from '../auth/service';
import type { MatchingService } from '../matching/service';
import { AppError, ok } from '../lib/response';
import type { OperatorService } from './service';

const DecideBody = z.object({
  decision: z.enum(['approve', 'reject', 'edit']),
  editedPayload: z.record(z.string(), z.unknown()).optional(),
});
const IntroBody = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(4000),
});

async function parse<T>(schema: z.ZodType<T>, raw: unknown): Promise<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError('validation', 'Geçersiz istek', 422, r.error.issues);
  return r.data;
}

export function operatorRoutes(auth: AuthService, ops: OperatorService, matching: MatchingService) {
  return new Hono()
    .use('*', withRole(auth, 'operator'))
    .get('/queue', async (c) => ok(c, await ops.queue()))
    .post('/queue/:id', async (c) => {
      const body = await parse(DecideBody, await c.req.json().catch(() => ({})));
      return ok(
        c,
        await ops.decide(c.get('user').id, c.req.param('id'), body.decision, body.editedPayload),
      );
    })
    .post('/needs/:id/match', async (c) => ok(c, await matching.runForNeed(c.req.param('id'))))
    .get('/needs/:id/matches', async (c) => ok(c, await matching.matchesForNeed(c.req.param('id'))))
    .post('/matches/:id/introduce', async (c) => {
      const body = await parse(IntroBody, await c.req.json().catch(() => ({})));
      return ok(c, await ops.proposeIntroduction(c.req.param('id'), body), 201);
    });
}
