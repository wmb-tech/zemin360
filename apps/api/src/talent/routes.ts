import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { withRole } from '../auth/middleware';
import type { AuthService } from '../auth/service';
import { newRawToken } from '../auth/tokens';
import type { Env } from '../lib/env';
import { AppError, ok } from '../lib/response';
import type { TalentService } from './service';

const ClaimPatch = z.object({
  text: z.string().min(8).max(240).optional(),
  approved: z.boolean().optional(),
});
const ProfilePatch = z.object({
  headline: z.string().min(3).max(80).optional(),
  story: z.string().min(20).max(700).optional(),
});
export const INSTALL_STATE_COOKIE = 'evidex_install_state';

async function parse<T>(schema: z.ZodType<T>, raw: unknown): Promise<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError('validation', 'Geçersiz istek', 422, r.error.issues);
  return r.data;
}

/** Gencin kendi kartı (döngü adımı 02). Yalnız talent rolü. */
export function talentRoutes(env: Env, auth: AuthService, svc: TalentService) {
  return (
    new Hono()
      .use('*', withRole(auth, 'talent'))
      .get('/card', async (c) => ok(c, await svc.card(c.get('user').id)))
      .patch('/card', async (c) => {
        const body = await parse(ProfilePatch, await c.req.json().catch(() => ({})));
        return ok(c, await svc.updateProfile(c.get('user').id, body));
      })
      .post('/card/approve', async (c) => ok(c, await svc.approveCard(c.get('user').id)))
      .patch('/card/claims/:id', async (c) => {
        const body = await parse(ClaimPatch, await c.req.json().catch(() => ({})));
        return ok(c, await svc.updateClaim(c.get('user').id, c.req.param('id'), body));
      })
      .delete('/card/claims/:id', async (c) => {
        await svc.deleteClaim(c.get('user').id, c.req.param('id'));
        return ok(c, { deleted: true });
      })
      /** GitHub App kurulumunu başlat: kişi GitHub'da repoları seçer, callback'e döner. */
      .get('/evidence/github/install', (c) => {
        if (!env.GITHUB_APP_SLUG)
          throw new AppError('not_configured', 'GitHub App yapılandırılmamış', 503);
        const state = newRawToken(16);
        setCookie(c, INSTALL_STATE_COOKIE, state, {
          httpOnly: true,
          sameSite: 'Lax',
          path: '/',
          maxAge: 600,
        });
        return c.redirect(
          `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new?state=${state}`,
        );
      })
      .post('/evidence/github/sync', async (c) => ok(c, await svc.syncGithub(c.get('user').id)))
      .post('/evidence/signals', async (c) => {
        const body = await parse(
          z.object({ sourceIds: z.array(z.string().uuid()).max(50) }),
          await c.req.json().catch(() => ({})),
        );
        return ok(c, await svc.sourceSignals(c.get('user').id, body.sourceIds));
      })
  );
}

/** Auth callback'te kullanılır: kurulum dönüşü mü, düz giriş mi? */
export function readInstallState(c: Parameters<typeof getCookie>[0]) {
  return getCookie(c, INSTALL_STATE_COOKIE);
}
