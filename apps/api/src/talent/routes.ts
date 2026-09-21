import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { withRole } from '../auth/middleware';
import type { AuthService } from '../auth/service';
import { newRawToken } from '../auth/tokens';
import type { Env } from '../lib/env';
import { AppError, ok } from '../lib/response';
import { jobOf, startJob } from './jobs';
import type { TalentService } from './service';
import { DOCUMENT_MAX_BYTES } from '@evidex/evidence';

const ClaimPatch = z.object({
  text: z.string().min(8).max(600).optional(),
  approved: z.boolean().optional(),
});
const ProfilePatch = z.object({
  headline: z.string().min(3).max(80).optional(),
  story: z.string().min(20).max(700).optional(),
  city: z.string().min(2).max(60).optional(),
});
export const INSTALL_STATE_COOKIE = 'evidex_install_state';

async function parse<T>(schema: z.ZodType<T>, raw: unknown): Promise<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError('validation', 'Geçersiz istek', 422, r.error.issues);
  return r.data;
}

/** Herkese açık kart (keşfet 01): `/api/cards/:slug`, oturum yok. */
export function publicCardRoutes(svc: TalentService) {
  return new Hono().get('/:slug', async (c) => ok(c, await svc.publicCard(c.req.param('slug'))));
}

/** Gencin kendi kartı (döngü adımı 02). Yalnız talent rolü. */
export function talentRoutes(env: Env, auth: AuthService, svc: TalentService) {
  return (
    new Hono()
      .use('*', withRole(auth, 'talent'))
      .get('/overview', async (c) => ok(c, await svc.overview(c.get('user').id)))
      .get('/card', async (c) => ok(c, await svc.card(c.get('user').id)))
      .patch('/card', async (c) => {
        const body = await parse(ProfilePatch, await c.req.json().catch(() => ({})));
        return ok(c, await svc.updateProfile(c.get('user').id, body));
      })
      .post('/card/approve', async (c) => ok(c, await svc.approveCard(c.get('user').id)))
      // Uzun işler (60 repo okuma + taslak) arka planda koşar; istemci durumunu sorar.
      .post('/card/rewrite', (c) => {
        const userId = c.get('user').id;
        const is = startJob(userId, 'rewrite', (onProgress) =>
          svc.rewriteCard(userId, { onProgress }).then((k) => ({
            skippedOrgRepos: (k as { skippedOrgRepos?: number }).skippedOrgRepos,
            unreadRepos: (k as { unreadRepos?: number }).unreadRepos,
            failedRepos: (k as { failedRepos?: number }).failedRepos,
          })),
        );
        if (!is) throw new AppError('job_running', 'Zaten koşan bir okuma var', 409);
        return ok(c, is, 202);
      })
      .get('/card/job', (c) => ok(c, jobOf(c.get('user').id)))
      .post('/card/share', async (c) => {
        const body = await parse(
          z.object({ enabled: z.boolean() }),
          await c.req.json().catch(() => ({})),
        );
        return ok(c, await svc.setShare(c.get('user').id, body.enabled));
      })
      .patch('/card/claims/:id', async (c) => {
        const body = await parse(ClaimPatch, await c.req.json().catch(() => ({})));
        return ok(c, await svc.updateClaim(c.get('user').id, c.req.param('id'), body));
      })
      .post('/card/claims/bulk', async (c) => {
        const body = await parse(
          z.object({
            ids: z.array(z.string().uuid()).min(1).max(100),
            action: z.enum(['approve', 'unapprove', 'delete']),
          }),
          await c.req.json().catch(() => ({})),
        );
        return ok(c, await svc.bulkClaims(c.get('user').id, body.ids, body.action));
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
        // target_id = kişinin GitHub kullanıcı id'si: hesap seçme ekranı atlanır, kurulum
        // KİŞİSEL hesaba yapılır. Org'a kurulum callback'te 403 (sahiplik uyuşmaz) — ilk gerçek
        // koşuda yakalanan tuzak: kullanıcı wmb-tech'e kurdu, kart bağlanamadı.
        // ?target=org → GitHub'ın hesap seçme ekranı (org'lar listelenir); varsayılan kişisel.
        const hedef =
          c.req.query('target') !== 'org' && c.get('user').githubId
            ? `&target_id=${c.get('user').githubId}`
            : '';
        return c.redirect(
          hedef
            ? `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new/permissions?state=${state}${hedef}`
            : `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new?state=${state}`,
        );
      })
      .post('/evidence/github/sync', (c) => {
        const userId = c.get('user').id;
        const is = startJob(userId, 'sync', (onProgress) =>
          svc.syncGithub(userId, { onProgress }).then((k) => ({
            skippedOrgRepos: k.skippedOrgRepos,
            unreadRepos: k.unreadRepos,
            failedRepos: k.failedRepos,
          })),
        );
        if (!is) throw new AppError('job_running', 'Zaten koşan bir okuma var', 409);
        return ok(c, is, 202);
      })
      .delete('/evidence/github/installations/:id', async (c) =>
        ok(c, await svc.removeInstallation(c.get('user').id, c.req.param('id'))),
      )
      .post('/evidence/url', async (c) => {
        const body = await parse(
          z.object({ url: z.string().url().max(500) }),
          await c.req.json().catch(() => ({})),
        );
        return ok(c, await svc.addLiveUrl(c.get('user').id, body.url), 201);
      })
      .post('/evidence/document', async (c) => {
        const body = await c.req.parseBody();
        const file = body['file'];
        if (!(file instanceof File)) throw new AppError('validation', 'PDF dosyası gerekli', 422);
        if (file.size > DOCUMENT_MAX_BYTES)
          throw new AppError('too_large', 'Belge 5 MB sınırını aşıyor', 413);
        const bytes = new Uint8Array(await file.arrayBuffer());
        return ok(c, await svc.addDocument(c.get('user').id, file.name, bytes), 201);
      })
      .post('/evidence/url/:id/verify', async (c) =>
        ok(c, await svc.verifyLiveUrl(c.get('user').id, c.req.param('id'))),
      )
      .delete('/evidence/sources/:id', async (c) => {
        await svc.removeSource(c.get('user').id, c.req.param('id'));
        return ok(c, { deleted: true });
      })
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
