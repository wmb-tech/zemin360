import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Env } from '../lib/env';
import type { EmailSender } from '../lib/email';
import { AppError, ok } from '../lib/response';
import type { AuthService, GithubProfile } from './service';
import { newRawToken } from './tokens';
import { INSTALL_STATE_COOKIE } from '../talent/routes';
import { sessionTokenOf } from './middleware';

export const SESSION_COOKIE = 'evidex_session';
const OAUTH_CLIENT_COOKIE = 'evidex_oauth_client';
export const MOBILE_SCHEME = 'evidex';
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
  onInstallation?: (userId: string, installationId: string, userToken?: string) => Promise<void>;
  orgOf?: (userId: string) => Promise<{ name: string; needsName: boolean } | null>;
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
      return { ...user, email: birincil?.email ?? user.email, accessToken: tokenJson.access_token };
    });

  return (
    new Hono()
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
        // Tarayıcıdan gelen bir tıklama: JSON hata yerine giriş sayfasına okunur durumla dön.
        try {
          const { sessionToken } = await auth.consumeMagicLink(c.req.param('token'));
          setSession(c, sessionToken);
          return c.redirect(`${env.WEB_ORIGIN}/`);
        } catch (e) {
          if (e instanceof AppError) return c.redirect(`${env.WEB_ORIGIN}/giris?hata=${e.code}`);
          throw e;
        }
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
        // Mobil (Expo) aynı akışı tarayıcı oturumunda yürütür; dönüş çerez değil derin link olur.
        if (c.req.query('client') === 'mobile')
          setCookie(c, OAUTH_CLIENT_COOKIE, 'mobile', {
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
      /**
       * GitHub App kurulumu (mobil): oturum gerekmez — kurulum dönüşünde OAuth profili kimliği
       * belirler ve installation sahibi doğrulanır (IDOR kapısı callback'te). Web için aynı iş
       * `/api/me/evidence/github/install` altında oturumla yapılır.
       */
      .get('/github/install', (c) => {
        if (!env.GITHUB_APP_SLUG)
          throw new AppError('not_configured', 'GitHub App yapılandırılmamış', 503);
        const state = newRawToken(16);
        setCookie(c, INSTALL_STATE_COOKIE, state, {
          httpOnly: true,
          sameSite: 'Lax',
          secure,
          path: '/',
          maxAge: 600,
        });
        if (c.req.query('client') === 'mobile')
          setCookie(c, OAUTH_CLIENT_COOKIE, 'mobile', {
            httpOnly: true,
            sameSite: 'Lax',
            secure,
            path: '/',
            maxAge: 600,
          });
        return c.redirect(
          `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new?state=${state}`,
        );
      })
      .get('/github/callback', async (c) => {
        const state = c.req.query('state');
        const code = c.req.query('code');
        const installationId = c.req.query('installation_id');
        // İki giriş yolu aynı callback'e düşer: düz OAuth ve App kurulumu (OAuth-during-install).
        const oauthState = getCookie(c, OAUTH_STATE_COOKIE);
        const installState = getCookie(c, INSTALL_STATE_COOKIE);
        const mobil = getCookie(c, OAUTH_CLIENT_COOKIE) === 'mobile';
        deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
        deleteCookie(c, INSTALL_STATE_COOKIE, { path: '/' });
        deleteCookie(c, OAUTH_CLIENT_COOKIE, { path: '/' });
        const beklenen = installationId ? installState : oauthState;
        // ⚠ state eşleşmezse CSRF: oturum açılmaz, sessizce yönlendirilmez.
        if (!code || !state || state !== beklenen)
          throw new AppError('oauth_state', 'Geçersiz OAuth durumu', 401);
        const profile = await fetchProfile(code);
        const { user, sessionToken } = await auth.loginWithGithub(profile);
        // ⚠ Kurulum doğrulaması oturum çerezinden ÖNCE: sahte installation_id ile gelen istek
        // 403 alır ve çerezsiz döner; hata cevabına oturum yazılmaz.
        if (installationId && deps.onInstallation) {
          try {
            await deps.onInstallation(user.id, installationId, profile.accessToken);
          } catch (e) {
            // Tarayıcıya ham JSON değil, giriş sayfasında okunur mesaj; oturum yine açılmaz.
            // İlk gerçek koşuda yakalandı: kullanıcı App'i org'a kurdu → 403 JSON gördü.
            if (e instanceof AppError)
              return c.redirect(
                mobil
                  ? `${MOBILE_SCHEME}://auth?hata=${e.code}`
                  : `${env.WEB_ORIGIN}/giris?hata=${e.code}`,
              );
            throw e;
          }
          if (mobil)
            return c.redirect(
              `${MOBILE_SCHEME}://auth?token=${encodeURIComponent(sessionToken)}&installed=1`,
            );
          setSession(c, sessionToken);
          return c.redirect(`${env.WEB_ORIGIN}/kanit?installed=1`);
        }
        if (mobil) {
          // Token uygulamaya derin linkle taşınır; SecureStore'da durur, Bearer ile gelir.
          return c.redirect(`${MOBILE_SCHEME}://auth?token=${encodeURIComponent(sessionToken)}`);
        }
        setSession(c, sessionToken);
        return c.redirect(`${env.WEB_ORIGIN}/`);
      })
      .get('/me', async (c) => {
        const user = await auth.resolveSession(sessionTokenOf(c));
        if (!user) throw new AppError('unauthenticated', 'Oturum yok', 401);
        // Kurum kullanıcısı için kurum adı da döner; "adı bekleniyor" ise web ayar sayfasına yönlendirir.
        const kurum = user.role === 'organization' && deps.orgOf ? await deps.orgOf(user.id) : null;
        return ok(c, {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          githubLogin: user.githubLogin,
          organization: kurum,
        });
      })
      .post('/logout', async (c) => {
        await auth.logout(sessionTokenOf(c));
        deleteCookie(c, SESSION_COOKIE, { path: '/' });
        return ok(c, { loggedOut: true });
      })
  );
}
