import { Hono } from 'hono';
import { z } from 'zod';
import { NeedCardEdits } from '@evidex/shared';
import { withRole } from '../auth/middleware';
import type { AuthService } from '../auth/service';
import { AppError, ok } from '../lib/response';
import type { createNeedService } from './service';
import type { MatchingService } from '../matching/service';

const CreateBody = z.object({ rawText: z.string().min(10).max(4000) });
const AnswerBody = z.object({ answer: z.string().min(1).max(2000) });
const ApproveBody = z.object({ edits: NeedCardEdits.optional() });

async function parse<T>(schema: z.ZodType<T>, raw: unknown): Promise<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError('validation', 'Geçersiz istek', 422, r.error.issues);
  return r.data;
}

export function needRoutes(
  auth: AuthService,
  svc: ReturnType<typeof createNeedService>,
  matching: MatchingService,
) {
  return new Hono()
    .use('*', withRole(auth, 'organization'))
    .get('/', async (c) => ok(c, await svc.list(c.get('user').id)))
    .post('/', async (c) => {
      const body = await parse(CreateBody, await c.req.json().catch(() => ({})));
      return ok(c, await svc.create(c.get('user').id, body.rawText), 201);
    })
    .get('/:id', async (c) => ok(c, await svc.get(c.get('user').id, c.req.param('id'))))
    .get('/:id/candidates', async (c) => {
      await svc.get(c.get('user').id, c.req.param('id')); // sahiplik kapısı
      return ok(c, await matching.candidatesForNeed(c.req.param('id')));
    })
    .post('/:id/answer', async (c) => {
      const body = await parse(AnswerBody, await c.req.json().catch(() => ({})));
      return ok(c, await svc.answer(c.get('user').id, c.req.param('id'), body.answer));
    })
    .post('/:id/approve', async (c) => {
      const body = await parse(ApproveBody, await c.req.json().catch(() => ({})));
      return ok(c, await svc.approve(c.get('user').id, c.req.param('id'), body.edits));
    });
}
