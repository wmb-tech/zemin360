import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { AppError } from './response';

/**
 * Bellek içi kayan pencere sınırlayıcı (tek API süreci var; çok süreçte paylaşılan depoya
 * taşınmalı). Amaç kötüye kullanımı kesmek: giriş e-postası bombardımanı Gmail gönderim
 * kotasını (≈500/gün) tüketip tanıştırma ve takip postalarını da durdurur; AI uçlarının
 * döngüye sokulması doğrudan Vertex faturasına yazar.
 */
export function sinirlayici() {
  const kayitlar = new Map<string, number[]>();
  // Ara sıra süpürme: boş kalan anahtarlar birikmesin.
  let sayac = 0;
  const supur = (simdi: number) => {
    if (++sayac % 500 !== 0) return;
    for (const [k, v] of kayitlar) if (!v.some((t) => t > simdi - 3_600_000)) kayitlar.delete(k);
  };
  return {
    /** Sınır aşıldıysa false; değilse isteği sayar ve true döner. */
    izin(anahtar: string, adet: number, pencereMs: number) {
      const simdi = Date.now();
      supur(simdi);
      const dizi = (kayitlar.get(anahtar) ?? []).filter((t) => t > simdi - pencereMs);
      if (dizi.length >= adet) {
        kayitlar.set(anahtar, dizi);
        return false;
      }
      dizi.push(simdi);
      kayitlar.set(anahtar, dizi);
      return true;
    },
  };
}

export type Sinirlayici = ReturnType<typeof sinirlayici>;

/** İstemci IP'si: Caddy X-Forwarded-For'u kendisi yazar (gelen değeri güvenmez); yoksa yerel. */
export const ipOf = (c: Context) =>
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'yerel';

const asildi = () =>
  new AppError('rate_limited', 'Çok fazla istek. Birkaç dakika sonra tekrar dene.', 429);

/** Uç başına sınır; anahtar varsayılan olarak IP, oturum varsa kullanıcı. */
export function sinir(
  s: Sinirlayici | null,
  ad: string,
  adet: number,
  pencereMs: number,
  anahtar: (c: Context) => string = ipOf,
) {
  return createMiddleware(async (c, next) => {
    const k = anahtar(c);
    // Anahtar çözülemediyse (IP başlığı yok) sınırlama yapılmaz: herkes tek "yerel" anahtarda
    // toplanıp birbirini engellemesin.
    if (s && k !== 'yerel' && !s.izin(`${ad}:${k}`, adet, pencereMs)) throw asildi();
    await next();
  });
}

export const kullaniciVeyaIp = (c: Context) =>
  (c as unknown as { get(k: 'user'): { id?: string } | undefined }).get('user')?.id ?? ipOf(c);

export { asildi as sinirAsildi };
