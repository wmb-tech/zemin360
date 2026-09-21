import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { THRESHOLDS, type EvidenceLevel } from '@evidex/shared';
import { useAuth } from '../lib/auth';
import { useTitle } from '../lib/title';
import { Enter } from '../components/motion';
import { LEVEL, LevelBadge } from '../components/ui';

/**
 * Açılış (oturumsuz `/`) ve "Nasıl çalışır" (oturumlu, kabuk içinde). Ürünün dilini ürünün
 * malzemesiyle anlatır: örnek kart parçası gerçek bileşenlerle çizilir, döngü numaralı liste,
 * roller üç sütun metin. Pazarlama düzeni yok; süs yok; emoji yok (docs/redesign/04 §E).
 */
const LOOP = [
  ['Keşfet', 'Meydan okumalar, keşif ajanı, kulüp kanalı, paylaşılabilir kart.'],
  ['Doğrula', 'GitHub App ile repo sinyali, canlı ürün, kurum referansı. Kod saklanmaz.'],
  ['Eşleştir', 'Skor yok. "Şu kanıt var, uyuyor; şu eksik." Tanıştırmaya kadar ilk ad.'],
  [
    'Canlı tut',
    `Kanıt ${THRESHOLDS.evidenceRefreshAfterDays} günde bir yeniden okunur; ${THRESHOLDS.silentCardAfterDays} gün sessiz kart uyarır.`,
  ],
  ['Tanımla', 'Kurum derdini yazar; ajan en çok yedi soruyla ihtiyaç kartı çıkarır.'],
  [
    'İzle',
    `${THRESHOLDS.followUpAfterDays} gün sonra iki tarafa tek soru; cevap, çelişki, sessizlik tek ekranda.`,
  ],
] as const;

/** Örnek kart parçası — gerçek bir kartın diliyle, üç seviye. */
const ORNEK: { level: EvidenceLevel; text: string; meta: string }[] = [
  {
    level: 'verified',
    text: 'Restoran adisyon uygulamasının React Native mobil istemcisini tek başına yazdı; 14 ay boyunca düzenli commit.',
    meta: '2 kaynak · GitHub, canlı ürün',
  },
  {
    level: 'referenced',
    text: 'E-ticaret mağazası için ürün listesi ve sepet ekranlarını üç haftada teslim etti; kurum "tamamlandı" dedi.',
    meta: '1 kaynak · kurum referansı',
  },
  {
    level: 'declared',
    text: 'Bir ödeme altyapısı entegrasyonunda çalıştığını belirtiyor.',
    meta: 'henüz kanıtsız',
  },
];

const AJANLAR = [
  ['Kart taslağı', 'sinyal → kaynağa bağlı iddialar'],
  ['İhtiyaç yapılandırma', 'metin + cevaplar → kart, sıradaki soru'],
  ['Eşleştirme', 'kart + adaylar → gerekçeli sıralama'],
  ['Tanıştırma', 'ihtiyaç + gerekçe → e-posta taslağı'],
  ['Takip', 'bağlam → iki tarafa tek soru; cevap → özet, bayrak'],
  ['Meydan okuma', 'ihtiyaç → görev + rubrik; teslim → puan, bant'],
  ['Keşif', 'ihtiyaç + herkese açık profiller → gerekçeli davet'],
] as const;

export function LandingPage() {
  const { me } = useAuth();
  useTitle(me ? 'Nasıl çalışır' : 'Beyan değil kanıt');
  const giris = me ? '/' : '/giris';

  return (
    <div className={me ? '' : 'min-h-screen'}>
      {!me && (
        <header className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-4 md:px-8">
          <span className="text-ink text-lg font-extrabold tracking-tight">Evidex</span>
          <nav className="flex items-center gap-5 text-sm font-semibold" aria-label="Üst menü">
            <a href="#dongu" className="text-ink-soft hover:text-ink hidden sm:inline">
              Döngü
            </a>
            <a href="#ai" className="text-ink-soft hover:text-ink hidden sm:inline">
              Yapay zekânın yeri
            </a>
            <a
              href="https://github.com/wmb-tech/zemin360"
              target="_blank"
              rel="noreferrer"
              className="text-ink-soft hover:text-ink hidden sm:inline"
            >
              Kaynak kod
            </a>
            <Link
              to="/giris"
              className="bg-ink text-paper pressable inline-flex min-h-10 items-center rounded-[var(--radius-control)] px-4"
            >
              Giriş
            </Link>
          </nav>
        </header>
      )}

      {/* Giriş bölümü: sol metin, sağ örnek kart parçası */}
      <section className="mx-auto grid w-full max-w-[1120px] gap-10 px-4 pt-12 pb-16 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:px-8 md:pt-20 md:pb-24">
        <Enter i={0} as="div">
          <div className="text-accent text-xs font-bold tracking-wide uppercase">
            GİRVAK gençlik ağı için
          </div>
          <h1 className="text-ink mt-3 text-[40px] leading-[1.02] font-extrabold tracking-[-0.04em] md:text-[56px]">
            Beyan değil kanıt.
            <br />
            Skor değil gerekçe.
          </h1>
          <p className="text-ink-soft mt-6 max-w-[52ch] text-lg leading-relaxed">
            Genç kendini anlatmaz, kanıtını bağlar. Kurum ilan yazmaz, derdini söyler. Yapay zekâ
            kartı yazar, soruyu sorar, eşleşmeyi gerekçelendirir; her dışa dönük adımı GİRVAK
            onaylar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={giris}
              className="bg-accent text-paper pressable inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-5 text-sm font-semibold hover:opacity-90"
            >
              {me ? 'Uygulamaya dön' : 'Kartını aç'} <ArrowRight size={16} aria-hidden />
            </Link>
            <a
              href="#dongu"
              className="border-line bg-surface hover:bg-paper-2 pressable inline-flex min-h-11 items-center rounded-[var(--radius-control)] border px-5 text-sm font-semibold"
            >
              Nasıl çalışır
            </a>
          </div>
        </Enter>

        <Enter i={1} as="div" y={12}>
          <div className="bg-surface border-line rounded-[var(--radius-feature)] border p-6 shadow-[0_1px_0_var(--color-line)]">
            <div className="text-ink-soft flex items-center justify-between text-xs font-bold tracking-wide uppercase">
              <span>Örnek kart parçası</span>
              <span>Onaylı</span>
            </div>
            <ul className="border-line mt-4 divide-y divide-[var(--color-line)] border-y">
              {ORNEK.map((c) => (
                <li key={c.level} className="py-3">
                  <div className="flex items-center gap-2">
                    <LevelBadge level={c.level} />
                    <span className="text-ink-soft text-xs">{c.meta}</span>
                  </div>
                  <p className="text-ink mt-1.5 text-sm leading-relaxed">{c.text}</p>
                </li>
              ))}
            </ul>
            <p className="text-ink-soft mt-3 text-xs leading-relaxed">
              Her iddianın seviyesi görünür. "Doğrulanmış" ile "beyan" aynı satırda aynı ağırlığı
              taşımaz; kurum hangisine güveneceğini tahmin etmez.
            </p>
          </div>
        </Enter>
      </section>

      {/* Seviye sözlüğü — tek satır, kart değil */}
      <section className="border-line border-t">
        <div className="mx-auto grid w-full max-w-[1120px] gap-x-8 gap-y-4 px-4 py-8 sm:grid-cols-2 md:grid-cols-4 md:px-8">
          {(Object.keys(LEVEL) as EvidenceLevel[]).map((k) => (
            <div key={k}>
              <LevelBadge level={k} />
              <p className="text-ink-soft mt-2 text-sm leading-relaxed">{LEVEL[k].note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Döngü — numaralı liste, iki sütun */}
      <section id="dongu" className="border-line border-t">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-16 md:px-8">
          <h2 className="text-ink text-[28px] font-extrabold tracking-[-0.03em]">
            Altı ihtiyaç alanı, tek döngü
          </h2>
          <p className="text-ink-soft mt-2 max-w-[60ch] leading-relaxed">
            Biten iş birliği referans olur; referans yeni eşleşmeyi besler. Hiçbir adım ayrı bir
            araç değil, aynı kaydın devamı.
          </p>
          <ol className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2">
            {LOOP.map(([ad, ne], i) => (
              <li key={ad} className="border-line flex gap-4 border-t pt-4">
                <span className="text-accent tnum w-8 shrink-0 text-sm font-bold">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div className="text-ink font-bold">{ad}</div>
                  <p className="text-ink-soft mt-1 text-sm leading-relaxed">{ne}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Üç rol — metin sütunları */}
      <section className="border-line border-t">
        <div className="mx-auto grid w-full max-w-[1120px] gap-10 px-4 py-16 md:grid-cols-3 md:px-8">
          {[
            [
              'Genç',
              'Kanıtını bağla, kartını onayla',
              'GitHub ile gir, hangi repoların okunacağını sen seç. Sistem sinyal çıkarır, ajan taslak yazar, sen onaylarsın. Kanıtın yoksa gerçek bir ihtiyaçtan türetilmiş 24–48 saatlik meydan okumaya katıl; teslimin karta doğrulanmış kanıt olarak girer.',
            ],
            [
              'Kurum',
              'Derdini söyle, gerekçeli aday gör',
              'İlan yok. Ajan sorar, ihtiyaç kartı çıkar, sen düzeltip onaylarsın. Adaylar "neden uyuyor, ne eksik" ile gelir; tanıştırılmak istediğini işaretle, GİRVAK onaylayınca e-posta iki tarafa gider.',
            ],
            [
              'GİRVAK',
              'Tek kuyruk, tek ekran',
              'Ajanın yapmak istediği her dışa dönük şey onay kuyruğunda bekler. İş birlikleri, sessiz kartlar, keşif ve ölçüm ayrı ekranlarda; hiçbir mesaj sen onaylamadan gitmez.',
            ],
          ].map(([rol, baslik, metin]) => (
            <div key={rol}>
              <div className="text-ink-soft text-xs font-bold tracking-wide uppercase">{rol}</div>
              <h3 className="text-ink mt-2 text-xl font-bold tracking-[-0.02em]">{baslik}</h3>
              <p className="text-ink-soft mt-2 leading-relaxed">{metin}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Yapay zekânın yeri — tablo */}
      <section id="ai" className="border-line border-t">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-16 md:px-8">
          <h2 className="text-ink text-[28px] font-extrabold tracking-[-0.03em]">
            Yapay zekânın yeri
          </h2>
          <p className="text-ink-soft mt-2 max-w-[60ch] leading-relaxed">
            Dokuz ajan, her biri şemalı çıktı üretir ve her çağrı kaydedilir. Hiçbiri bir insana
            doğrudan yazmaz; öneri kuyruğa düşer, operatör onaylar, düzeltir ya da reddeder. Ölçüm
            paneli kart doğruluğunu, ihtiyaç netliğini ve önerilerin akıbetini gösterir.
          </p>
          <dl className="border-line mt-8 divide-y divide-[var(--color-line)] border-y">
            {AJANLAR.map(([ad, ne]) => (
              <div key={ad} className="grid gap-1 py-3 sm:grid-cols-[220px_1fr]">
                <dt className="text-ink font-semibold">{ad}</dt>
                <dd className="text-ink-soft">{ne}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {!me && (
        <footer className="border-line border-t">
          <div className="text-ink-soft mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs md:px-8">
            <span>
              Evidex · Zemin360 Hackathon 2026 · GİRVAK · İstanbul Kalkınma Ajansı · İstanbul Bilgi
              Üniversitesi
            </span>
            <span>WMB · açık kaynak, MIT</span>
          </div>
        </footer>
      )}
    </div>
  );
}
