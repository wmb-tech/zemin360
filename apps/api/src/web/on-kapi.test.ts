import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { testApp } from '../test/setup';
import { removeDemoNetwork, seedDemoNetwork } from '../demo/network';

describe('ön kapı', () => {
  it('oturumsuz ziyaretçi tanıtımı, oturumlu kullanıcı paneli görür; derin linkler SPA', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'evidex-web-'));
    writeFileSync(
      join(dist, 'index.html'),
      '<title>Evidex</title><meta property="og:type" content="website" /><meta property="og:title" content="Evidex" /><meta property="og:description" content="genel" /><p>SPA</p>',
    );
    mkdirSync(join(dist, 'tanitim'));
    writeFileSync(join(dist, 'tanitim', 'index.html'), '<p>TANITIM</p>');
    const { app } = testApp({ webDist: dist });
    expect(await (await app.request('/')).text()).toContain('TANITIM');
    expect(await (await app.request('/nasil-calisir')).text()).toContain('TANITIM');
    const oturumlu = { headers: { cookie: 'evidex_session=herhangi' } };
    expect(await (await app.request('/', oturumlu)).text()).toContain('SPA');
    expect(await (await app.request('/giris')).text()).toContain('SPA');
    expect(await (await app.request('/k/biri')).text()).toContain('content="Evidex"');
  });

  it('paylaşılan kartın önizlemesi sahibine göre dolar; kapalı kart genel kalır', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'evidex-web-'));
    writeFileSync(
      join(dist, 'index.html'),
      '<title>Evidex</title><meta property="og:type" content="website" /><meta property="og:title" content="Evidex" /><meta property="og:description" content="genel" /><p>SPA</p>',
    );
    const { app, db } = testApp({ webDist: dist });
    await seedDemoNetwork(db);
    const html = await (await app.request('/k/demo-elif')).text();
    expect(html).toContain(
      'og:title" content="Elif Karaca · Mobil uygulama geliştirici (örnek kart)"',
    );
    expect(html).toContain(
      '<title>Elif Karaca · Mobil uygulama geliştirici (örnek kart) · Evidex</title>',
    );
    expect(html).toContain('og:type" content="profile"');
    expect(html).toContain('SPA');
    const kapali = await (await app.request('/k/yok-boyle-kart')).text();
    expect(kapali).toContain('og:title" content="Evidex"');
    await removeDemoNetwork(db);
  });
});
