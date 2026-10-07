import { describe, expect, it } from 'bun:test';
import { testApp } from '../test/setup';
import { sinirlayici } from './rate-limit';

const post = (email: string, ip = '203.0.113.7') => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  body: JSON.stringify({ email }),
});

describe('istek sınırları', () => {
  it('aynı adrese 3 giriş bağlantısından sonrası 429; e-posta gitmez, gövde rotaya ulaşır', async () => {
    const { app, gonderilen } = testApp({ rateLimit: true });
    const once = gonderilen.length;
    for (let i = 0; i < 3; i++)
      expect((await app.request('/api/auth/magic-link', post('hedef@example.com'))).status).toBe(
        200,
      );
    const r = await app.request('/api/auth/magic-link', post('hedef@example.com', '198.51.100.9'));
    expect(r.status).toBe(429);
    expect(gonderilen.length - once).toBe(3);
  });

  it('aynı IP farklı adreslere 8 istekten sonra kesilir', async () => {
    const { app } = testApp({ rateLimit: true });
    for (let i = 0; i < 8; i++)
      expect(
        (await app.request('/api/auth/magic-link', post(`k${i}@example.com`, '192.0.2.44'))).status,
      ).toBe(200);
    expect(
      (await app.request('/api/auth/magic-link', post('k9@example.com', '192.0.2.44'))).status,
    ).toBe(429);
  });

  it('pencere dolunca yeniden izin verir', () => {
    const s = sinirlayici();
    expect(s.izin('a', 1, 10)).toBe(true);
    expect(s.izin('a', 1, 10)).toBe(false);
    return new Promise<void>((ok) =>
      setTimeout(() => {
        expect(s.izin('a', 1, 10)).toBe(true);
        ok();
      }, 20),
    );
  });
});

describe('gövde sınırı', () => {
  it('1 MB üstü JSON gövde rotaya varmadan 413', async () => {
    const { app } = testApp();
    const r = await app.request('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.co', dolgu: 'x'.repeat(1_200_000) }),
    });
    expect(r.status).toBe(413);
  });
});
