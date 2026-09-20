import { Hono } from 'hono';
import { z } from 'zod';
import { withRole } from '../auth/middleware';
import type { AuthService } from '../auth/service';
import { AppError, ok } from '../lib/response';
import type { OrgService } from './service';

const Patch = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  city: z.string().trim().max(80).nullable().optional(),
  website: z.string().trim().url().max(200).nullable().optional(),
});

export function orgRoutes(auth: AuthService, org: OrgService) {
  return new Hono()
    .use('*', withRole(auth, 'organization'))
    .get('/', async (c) => ok(c, await org.profile(c.get('user').id)))
    .patch('/', async (c) => {
      const r = Patch.safeParse(await c.req.json().catch(() => ({})));
      if (!r.success) throw new AppError('validation', 'Geçersiz istek', 422, r.error.issues);
      return ok(c, await org.update(c.get('user').id, r.data));
    });
}
