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

    // Aynı link ikinci kez oturum vermez: giriş sayfasına okunur hata koduyla döner, çerez yok.
    const ikinci = await app.request(path, { redirect: 'manual' });
    expect(ikinci.status).toBe(302);
    expect(ikinci.headers.get('location')).toContain('/giris?hata=invalid_link');
    expect(cookieOf(ikinci, 'evidex_session')).toBe('');
  });

  it('geçersiz e-posta 422 döner', async () => {
    const { app } = testApp();
    expect((await app.request('/api/auth/magic-link', json({ email: 'bozuk' }))).status).toBe(422);
  });

  it('aynı e-postalı kurum hesabı GitHub girişiyle gence dönüşmez', async () => {
    const { app, gonderilen } = testApp({
      githubProfile: { id: 55, login: 'ayse', email: 'ortak@example.com', name: 'Ayşe' },
    });
    // Önce e-posta ile kurum hesabı açılır.
    await app.request('/api/auth/magic-link', json({ email: 'ortak@example.com' }));
    const path = gonderilen[0]!.text.match(/\/api\/auth\/magic\/\S+/)![0];
    const kurumGiris = await app.request(path, { redirect: 'manual' });
    const kurumCookie = cookieOf(kurumGiris, 'evidex_session');
    expect(
      (await (await app.request('/api/auth/me', { headers: { cookie: kurumCookie } })).json()).data
        .role,
    ).toBe('organization');

    // Aynı e-postalı GitHub hesabı: kimlik bağlanmaz, oturum açılmaz.
    const state = 'sX';
    const res = await app.request(`/api/auth/github/callback?code=abc&state=${state}`, {
      headers: { cookie: `evidex_oauth_state=${state}` },
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('hata=email_in_use');
    expect(cookieOf(res, 'evidex_session')).toBe('');
    // Kurum hesabı hâlâ kurum.
    expect(
      (await (await app.request('/api/auth/me', { headers: { cookie: kurumCookie } })).json()).data
        .role,
    ).toBe('organization');
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
      githubProfile: { id: 42, login: 'mehmet', name: 'Mehmet', email: 'mehmet@example.com' },
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
    const { app } = testApp({ githubProfile: { id: 7, login: 'zeynep', name: null, email: null } });
    expect((await app.request('/api/auth/me')).status).toBe(401);
    const res = await app.request('/api/auth/github/callback?code=abc&state=s2', {
      headers: { cookie: 'evidex_oauth_state=s2' },
      redirect: 'manual',
    });
    const cookie = cookieOf(res, 'evidex_session');
    await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } });
    expect((await app.request('/api/auth/me', { headers: { cookie } })).status).toBe(401);
  });

  it('mobil github girişi: çerez yerine derin link token; Bearer ile /me ve kart çalışır', async () => {
    const { app } = testApp({
      githubProfile: { id: 77, login: 'cem-mobil', name: 'Cem', email: 'cem@example.com' },
    });
    // Başlatma ucu GITHUB_CLIENT_ID ister (testte yok); `?client=mobile` çerezi elle verilir.
    const res = await app.request('/api/auth/github/callback?code=abc&state=s3', {
      headers: { cookie: 'evidex_oauth_state=s3; evidex_oauth_client=mobile' },
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    const yer = res.headers.get('location') ?? '';
    expect(yer.startsWith('evidex://auth?token=')).toBe(true);
    expect(cookieOf(res, 'evidex_session')).toBe(''); // mobilde oturum çerezi yazılmaz
    const token = decodeURIComponent(yer.split('token=')[1]!);

    const me = await app.request('/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
    expect(me.status).toBe(200);
    expect((await me.json()).data.githubLogin).toBe('cem-mobil');
    expect(
      (await app.request('/api/me/card', { headers: { authorization: `Bearer ${token}` } })).status,
    ).toBe(200);
    await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(
      (await app.request('/api/auth/me', { headers: { authorization: `Bearer ${token}` } })).status,
    ).toBe(401);
  });
});
