import { describe, expect, it } from 'bun:test';
import { assertPublicUrl, createLiveUrlEvidence } from './liveUrl';

describe('canlı URL sağlayıcısı', () => {
  it('yerel/özel adresleri reddeder (SSRF)', () => {
    for (const u of [
      'http://localhost:3100',
      'http://127.0.0.1',
      'http://10.0.0.5',
      'http://192.168.1.1',
      'http://172.20.0.1',
      'ftp://example.com',
      'http://intranet',
    ]) {
      expect(() => assertPublicUrl(u)).toThrow();
    }
    expect(assertPublicUrl('https://bisatsan.com').hostname).toBe('bisatsan.com');
  });

  it('meta etiketi ya da well-known ile sahiplik doğrular; yoksa doğrulamaz', async () => {
    const sayfalar: Record<string, string> = {
      'https://a.example/':
        '<html><head><meta name="evidex-verify" content="tok123"></head></html>',
      'https://b.example/': '<html></html>',
      'https://b.example/.well-known/evidex.txt': 'tok123\n',
      'https://c.example/': '<html></html>',
      'https://c.example/.well-known/evidex.txt': 'baska',
    };
    const p = createLiveUrlEvidence({
      fetchText: async (url) => ({
        status: sayfalar[url.toString()] === undefined ? 404 : 200,
        text: sayfalar[url.toString()] ?? '',
        headers: new Headers(),
      }),
    });
    expect((await p.verifyOwnership('https://a.example/', 'tok123')).verified).toBe(true);
    expect((await p.verifyOwnership('https://b.example/', 'tok123')).verified).toBe(true);
    expect((await p.verifyOwnership('https://c.example/', 'tok123')).verified).toBe(false);
    // Yanlış token, doğru sayfa: doğrulanmaz.
    expect((await p.verifyOwnership('https://a.example/', 'yanlis')).verified).toBe(false);
  });

  it('sinyal çıkarır, içerik saklamaz', async () => {
    const p = createLiveUrlEvidence({
      fetchText: async () => ({
        status: 200,
        text: '<html><head><title>Kafe Sipariş</title><script src="/assets/index-abc.js"></script></head></html>',
        headers: new Headers({ server: 'nginx' }),
      }),
    });
    const s = await p.extract('https://kafe.example/');
    expect(s.reachable).toBe(true);
    expect(s.title).toBe('Kafe Sipariş');
    expect(s.tools).toContain('Vite');
    expect(JSON.stringify(s)).not.toContain('<html');
  });
});
