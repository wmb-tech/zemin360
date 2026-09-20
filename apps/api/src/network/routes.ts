import { Hono } from 'hono';
import { z } from 'zod';
import { withRole } from '../auth/middleware';
import type { AuthService } from '../auth/service';
import { AppError, ok } from '../lib/response';
import type { NetworkService } from './service';

/** Operatörün ağ uçları: genel görünüm, kurum onayı (KARAR-10), kanıt yenileme tetikleme. */
export function networkRoutes(auth: AuthService, network: NetworkService) {
  return new Hono()
    .use('*', withRole(auth, 'operator'))
    .get('/', async (c) => ok(c, await network.overview()))
    .post('/organizations/:id/approval', async (c) => {
      const r = z.object({ approved: z.boolean() }).safeParse(await c.req.json().catch(() => ({})));
      if (!r.success) throw new AppError('validation', 'Geçersiz istek', 422, r.error.issues);
      return ok(
        c,
        await network.setOrganizationApproval(c.get('user').id, c.req.param('id'), r.data.approved),
      );
    })
    .post('/refresh', async (c) => ok(c, await network.refreshEvidence()));
}
