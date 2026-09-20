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
  if (host.includes(':') || OZEL_HOST.test(host) || OZEL_172.test(host) || !host.includes('.'))
    throw new Error('Özel ya da yerel adres kabul edilmez');
  return url;
}

/** IPv4/IPv6 özel, loopback, link-local, CGNAT, bulut metadata ve ayrılmış aralıklar. */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase();
    if (v6 === '::1' || v6 === '::') return true;
    if (v6.startsWith('fe80:') || v6.startsWith('fc') || v6.startsWith('fd')) return true;
    const m = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
    return m ? isPrivateIp(m[1]!) : false;
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // sınıflanamayan = güvensiz
  const [a, b] = p as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local + bulut metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast / ayrılmış
  );
}

export type Resolver = (hostname: string) => Promise<string[]>;

async function defaultResolve(hostname: string): Promise<string[]> {
  const { lookup } = await import('node:dns/promises');
  const kayitlar = await lookup(hostname, { all: true });
  return kayitlar.map((k) => k.address);
}

/**
 * ⚠ SSRF: hostname listesi tek başına yetmez — public bir ad özel IP'ye çözülebilir. Her
 * istekten hemen önce ad çözülür; TÜM adresler özel aralık dışında olmalı. DNS rebinding
 * artığına karşı yönlendirme takip edilmez ve zaman aşımı kısadır.
 */
export async function assertPublicResolution(url: URL, resolve: Resolver = defaultResolve) {
  let ipler: string[];
  try {
    ipler = await resolve(url.hostname);
  } catch {
    throw new Error('Alan adı çözümlenemedi');
  }
  if (ipler.length === 0 || ipler.some(isPrivateIp)) {
    throw new Error('Adres özel bir ağa çözülüyor; kabul edilmez');
  }
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

export function createLiveUrlEvidence(
  deps: { fetchText?: typeof fetchText; resolve?: Resolver } = {},
) {
  const ham = deps.fetchText ?? fetchText;
  const resolve = deps.resolve ?? defaultResolve;
  // Her istekten önce DNS kapısı; well-known dahil.
  const get: typeof fetchText = async (url, ms) => {
    await assertPublicResolution(url, resolve);
    return ham(url, ms);
  };
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
