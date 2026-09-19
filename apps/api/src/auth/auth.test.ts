import { describe, expect, it } from 'bun:test';
import { cookieOf, testApp } from '../test/setup';

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('kimlik', () => {
  it('sihirli link e-postaya gider, cevapta dönmez, tek kullanımlıktır', async () => {
    const { app, gonderilen } = testApp();
    const res = await app.request('/api/auth/magic-link', json({ email: 'kurum@example.com' }));
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain('/api/auth/magic/');
    expect(gonderilen).toHaveLength(1);
    const path = gonderilen[0]!.text.match(/\/api\/auth\/magic\/\S+/)![0];

    const giris = await app.request(path, { redirect: 'manual' });
    expect(giris.status).toBe(302);
    const cookie = cookieOf(giris, 'evidex_session');
    expect(cookie).not.toBe('');

    const me = await (await app.request('/api/auth/me', { headers: { cookie } })).json();
    expect(me.ok).toBe(true);
    expect(me.data.role).toBe('organization');

    // Aynı link ikinci kez 401: sessizce yeni oturum vermez.
    expect((await app.request(path, { redirect: 'manual' })).status).toBe(401);
  });

  it('geçersiz e-posta 422 döner', async () => {
    const { app } = testApp();
    expect((await app.request('/api/auth/magic-link', json({ email: 'bozuk' }))).status).toBe(422);
  });

  it('github callback state uyuşmazsa oturum açmaz', async () => {
    const { app } = testApp();
    const res = await app.request('/api/auth/github/callback?code=abc&state=x', {
      headers: { cookie: 'evidex_oauth_state=y' },
      redirect: 'manual',
    });
    expect(res.status).toBe(401);
    expect(cookieOf(res, 'evidex_session')).toBe('');
  });

  it('github girişi genç hesabı açar', async () => {
    const { app } = testApp({
      github: { id: 42, login: 'mehmet', name: 'Mehmet', email: 'mehmet@example.com' },
    });
    const res = await app.request('/api/auth/github/callback?code=abc&state=s1', {
      headers: { cookie: 'evidex_oauth_state=s1' },
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    const cookie = cookieOf(res, 'evidex_session');
    const me = await (await app.request('/api/auth/me', { headers: { cookie } })).json();
    expect(me.data.role).toBe('talent');
    expect(me.data.githubLogin).toBe('mehmet');
  });

  it('oturumsuz /me 401, çıkış sonrası çerez geçersiz', async () => {
    const { app } = testApp({ github: { id: 7, login: 'zeynep', name: null, email: null } });
    expect((await app.request('/api/auth/me')).status).toBe(401);
    const res = await app.request('/api/auth/github/callback?code=abc&state=s2', {
      headers: { cookie: 'evidex_oauth_state=s2' },
      redirect: 'manual',
    });
    const cookie = cookieOf(res, 'evidex_session');
    await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } });
    expect((await app.request('/api/auth/me', { headers: { cookie } })).status).toBe(401);
  });
});
