import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Env } from '../lib/env';
import type { EmailSender } from '../lib/email';
import { AppError, ok } from '../lib/response';
import type { AuthService, GithubProfile } from './service';
import { newRawToken } from './tokens';
import { INSTALL_STATE_COOKIE } from '../talent/routes';

export const SESSION_COOKIE = 'evidex_session';
const OAUTH_STATE_COOKIE = 'evidex_oauth_state';

const MagicLinkBody = z.object({ email: z.string().email() });

/**
 * ### Kimlik uçları (KARAR-07)
 * - POST /magic-link      → e-posta ile tek kullanımlık bağlantı
 * - GET  /magic/:token    → oturum aç, web'e yönlendir
 * - GET  /github          → GitHub OAuth başlat
 * - GET  /github/callback → oturum aç, web'e yönlendir
 * - GET  /me · POST /logout
 * Oturum çerezi HttpOnly; JS okuyamaz. Mobil için header taşıyıcı sonraki adım.
 */
export function authRoutes(deps: {
  env: Env;
  auth: AuthService;
  email: EmailSender;
  fetchGithubProfile?: (code: string) => Promise<GithubProfile>;
  /** GitHub App kurulumundan dönüşte çağrılır (installation_id ile). */
  onInstallation?: (userId: string, installationId: string) => Promise<void>;
}) {
  const { env, auth, email } = deps;
  const secure = env.API_ORIGIN.startsWith('https');

  const setSession = (c: Parameters<typeof setCookie>[0], token: string) =>
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

  const fetchProfile =
    deps.fetchGithubProfile ??
    (async (code: string): Promise<GithubProfile> => {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token)
        throw new AppError('github_oauth', 'GitHub yetkisi alınamadı', 401);
      const headers = { Authorization: `Bearer ${tokenJson.access_token}`, 'User-Agent': 'evidex' };
      const user = (await (
        await fetch('https://api.github.com/user', { headers })
      ).json()) as GithubProfile;
      // Birincil e-posta ayrı uçta; gizliyse noreply adresine düşülür (service).
      const emails = (await (
        await fetch('https://api.github.com/user/emails', { headers })
      ).json()) as { email: string; primary: boolean; verified: boolean }[] | undefined;
      const birincil = Array.isArray(emails)
        ? emails.find((e) => e.primary && e.verified)
        : undefined;
      return { ...user, email: birincil?.email ?? user.email };
    });

  return new Hono()
    .post('/magic-link', async (c) => {
      const body = MagicLinkBody.safeParse(await c.req.json().catch(() => ({})));
      if (!body.success) throw new AppError('validation', 'Geçerli bir e-posta girin', 422);
      const raw = await auth.requestMagicLink(body.data.email);
      const link = `${env.API_ORIGIN}/api/auth/magic/${raw}`;
      await email.send({
        to: body.data.email,
        subject: 'Evidex giriş bağlantınız',
        text: `Giriş için bağlantı (15 dakika geçerli): ${link}`,
      });
      // Bağlantı cevapta DÖNMEZ; e-posta sahipliği kapının kendisi.
      return ok(c, { sent: true });
    })
    .get('/magic/:token', async (c) => {
      const { sessionToken } = await auth.consumeMagicLink(c.req.param('token'));
      setSession(c, sessionToken);
      return c.redirect(`${env.WEB_ORIGIN}/`);
    })
    .get('/github', (c) => {
      if (!env.GITHUB_CLIENT_ID)
        throw new AppError('not_configured', 'GitHub girişi yapılandırılmamış', 503);
      const state = newRawToken(16);
      setCookie(c, OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: 'Lax',
        secure,
        path: '/',
        maxAge: 600,
      });
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      url.searchParams.set('redirect_uri', `${env.API_ORIGIN}/api/auth/github/callback`);
      url.searchParams.set('scope', 'read:user user:email');
      url.searchParams.set('state', state);
      return c.redirect(url.toString());
    })
    .get('/github/callback', async (c) => {
      const state = c.req.query('state');
      const code = c.req.query('code');
      const installationId = c.req.query('installation_id');
      // İki giriş yolu aynı callback'e düşer: düz OAuth ve App kurulumu (OAuth-during-install).
      const oauthState = getCookie(c, OAUTH_STATE_COOKIE);
      const installState = getCookie(c, INSTALL_STATE_COOKIE);
      deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
      deleteCookie(c, INSTALL_STATE_COOKIE, { path: '/' });
      const beklenen = installationId ? installState : oauthState;
      // ⚠ state eşleşmezse CSRF: oturum açılmaz, sessizce yönlendirilmez.
      if (!code || !state || state !== beklenen)
        throw new AppError('oauth_state', 'Geçersiz OAuth durumu', 401);
      const profile = await fetchProfile(code);
      const { user, sessionToken } = await auth.loginWithGithub(profile);
      // ⚠ Kurulum doğrulaması oturum çerezinden ÖNCE: sahte installation_id ile gelen istek
      // 403 alır ve çerezsiz döner; hata cevabına oturum yazılmaz.
      if (installationId && deps.onInstallation) {
        await deps.onInstallation(user.id, installationId);
        setSession(c, sessionToken);
        return c.redirect(`${env.WEB_ORIGIN}/kanit?installed=1`);
      }
      setSession(c, sessionToken);
      return c.redirect(`${env.WEB_ORIGIN}/`);
    })
    .get('/me', async (c) => {
      const user = await auth.resolveSession(getCookie(c, SESSION_COOKIE));
      if (!user) throw new AppError('unauthenticated', 'Oturum yok', 401);
      return ok(c, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        githubLogin: user.githubLogin,
      });
    })
    .post('/logout', async (c) => {
      await auth.logout(getCookie(c, SESSION_COOKIE));
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      return ok(c, { loggedOut: true });
    });
}
