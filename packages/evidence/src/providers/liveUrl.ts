import type { ExtractedSignals } from '../provider';

/**
 * ### Canlı URL kanıt sağlayıcısı (ADR-0003)
 * Sahiplik: sitenin <head>'inde `<meta name="evidex-verify" content="<token>">` ya da
 * `/.well-known/evidex.txt` içinde token. Sinyal: erişilebilir mi, başlık, teknoloji izleri,
 * HTTPS, son değişiklik başlığı. Sayfa içeriği saklanmaz.
 * ⚠ SSRF: yalnız http(s), özel/iç IP'ler ve localhost reddedilir; yönlendirme takip edilmez.
 */
const OZEL_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\]|::1)/i;
const OZEL_172 = /^172\.(1[6-9]|2\d|3[01])\./;

export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Geçersiz URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Yalnız http/https');
  const host = url.hostname;
  if (OZEL_HOST.test(host) || OZEL_172.test(host) || !host.includes('.'))
    throw new Error('Özel ya da yerel adres kabul edilmez');
  return url;
}

async function fetchText(
  url: URL,
  ms = 8000,
): Promise<{ status: number; text: string; headers: Headers } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'evidex-verify/1.0' },
    });
    const text = (await res.text()).slice(0, 200_000);
    return { status: res.status, text, headers: res.headers };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function createLiveUrlEvidence(deps: { fetchText?: typeof fetchText } = {}) {
  const get = deps.fetchText ?? fetchText;
  return {
    async verifyOwnership(
      rawUrl: string,
      token: string,
    ): Promise<{ verified: boolean; method: 'dns_meta'; detail?: string }> {
      const url = assertPublicUrl(rawUrl);
      const sayfa = await get(url);
      if (sayfa && sayfa.status < 400) {
        const meta = new RegExp(
          `<meta\\s+name=["']evidex-verify["']\\s+content=["']${token}["']`,
          'i',
        );
        if (meta.test(sayfa.text)) return { verified: true, method: 'dns_meta', detail: 'meta' };
      }
      const wk = await get(new URL('/.well-known/evidex.txt', url.origin));
      if (wk && wk.status < 400 && wk.text.trim().split(/\s+/).includes(token)) {
        return { verified: true, method: 'dns_meta', detail: 'well-known' };
      }
      return { verified: false, method: 'dns_meta', detail: 'token bulunamadı' };
    },

    async extract(rawUrl: string): Promise<ExtractedSignals> {
      const url = assertPublicUrl(rawUrl);
      const sayfa = await get(url);
      if (!sayfa) return { reachable: false };
      const title = sayfa.text.match(/<title[^>]*>([^<]{0,200})<\/title>/i)?.[1]?.trim();
      const tools: string[] = [];
      const t = sayfa.text;
      if (/__next|_next\/static/i.test(t)) tools.push('Next.js');
      if (/\/assets\/index-[\w-]+\.js|vite/i.test(t)) tools.push('Vite');
      if (/data-reactroot|react-dom|__REACT/i.test(t)) tools.push('React');
      if (/wp-content|wordpress/i.test(t)) tools.push('WordPress');
      if (/cdn\.shopify|shopify/i.test(t)) tools.push('Shopify');
      if (/expo|react-native/i.test(t)) tools.push('Expo/React Native');
      const server = sayfa.headers.get('server') ?? undefined;
      const lastModified = sayfa.headers.get('last-modified') ?? undefined;
      return {
        reachable: sayfa.status < 400,
        status: sayfa.status,
        https: url.protocol === 'https:',
        title,
        tools,
        server,
        lastModified,
        deployed: sayfa.status < 400,
      };
    },
  };
}

export type LiveUrlEvidence = ReturnType<typeof createLiveUrlEvidence>;
