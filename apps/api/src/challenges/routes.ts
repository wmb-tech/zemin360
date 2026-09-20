import { Hono } from 'hono';
import { z } from 'zod';
import { withRole } from '../auth/middleware';
import type { AuthService } from '../auth/service';
import { AppError, ok } from '../lib/response';
import type { ChallengeService } from './service';

async function parse<T>(schema: z.ZodType<T>, raw: unknown): Promise<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError('validation', 'Geçersiz istek', 422, r.error.issues);
  return r.data;
}

const Patch = z.object({
  title: z.string().min(5).max(120).optional(),
  brief: z.string().min(80).max(4000).optional(),
  durationHours: z.union([z.literal(24), z.literal(48)]).optional(),
});
const Submit = z.object({
  repoUrl: z.string().url().max(300),
  note: z.string().max(1000).nullable().optional(),
});

/** Operatör tarafı: tasarla, düzenle, aç, kapat, değerlendir, sonuçlar. */
export function operatorChallengeRoutes(auth: AuthService, svc: ChallengeService) {
  return new Hono()
    .use('*', withRole(auth, 'operator'))
    .get('/', async (c) => ok(c, await svc.list()))
    .post('/from-need/:needId', async (c) =>
      ok(c, await svc.designFromNeed(c.get('user').id, c.req.param('needId')), 201),
    )
    .get('/:id', async (c) => ok(c, await svc.results(c.req.param('id'))))
    .patch('/:id', async (c) =>
      ok(
        c,
        await svc.update(
          c.req.param('id'),
          await parse(Patch, await c.req.json().catch(() => ({}))),
        ),
      ),
    )
    .post('/:id/open', async (c) => ok(c, await svc.open(c.req.param('id'))))
    .post('/:id/close', async (c) => ok(c, await svc.close(c.req.param('id'))))
    .post('/:id/evaluate', async (c) => ok(c, await svc.evaluate(c.req.param('id'))));
}

/** Genç tarafı: açık görevler, teslim. */
export function talentChallengeRoutes(auth: AuthService, svc: ChallengeService) {
  return new Hono()
    .use('*', withRole(auth, 'talent'))
    .get('/', async (c) => ok(c, await svc.openForTalent(c.get('user').id)))
    .post('/:id/submit', async (c) => {
      const body = await parse(Submit, await c.req.json().catch(() => ({})));
      return ok(
        c,
        await svc.submit(c.get('user').id, c.req.param('id'), body.repoUrl, body.note ?? null),
        201,
      );
    });
}
