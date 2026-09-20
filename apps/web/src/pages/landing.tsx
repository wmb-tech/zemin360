import { Link } from 'react-router';
import { THRESHOLDS } from '@evidex/shared';

/**
 * Açılış sayfası (oturumsuz `/`). Ürünü altı ihtiyaç alanının diliyle anlatır; jüri ve GİRVAK
 * için ilk ekran. Süs yok: döngü, üç rol, AI'ın yeri, ölçüm. Tasarımda emoji yok.
 */
const LOOP = [
  { n: '01', ad: 'Keşfet', ne: 'Meydan okumalar, keşif ajanı, kulüp kanalı, paylaşılabilir kart.' },
  {
    n: '02',
    ad: 'Doğrula',
    ne: 'GitHub App ile repo sinyali, canlı ürün, kurum referansı. Kod saklanmaz.',
  },
  {
    n: '05',
    ad: 'Tanımla',
    ne: 'Kurum derdini yazar; ajan en çok yedi soruyla ihtiyaç kartı çıkarır.',
  },
  {
    n: '03',
    ad: 'Eşleştir',
    ne: 'Skor yok. "Şu kanıt var, uyuyor; şu eksik." Tanıştırmaya kadar ilk ad.',
  },
  {
    n: '06',
    ad: 'İzle',
    ne: `${THRESHOLDS.followUpAfterDays} gün sonra iki tarafa tek soru; cevap, çelişki, sessizlik tek ekranda.`,
  },
  {
    n: '04',
    ad: 'Canlı tut',
    ne: `Kanıt ${THRESHOLDS.evidenceRefreshAfterDays} günde bir yeniden okunur; ${THRESHOLDS.silentCardAfterDays} gün sessiz kart uyarır.`,
  },
];

const LEVELS = [
  { cls: 'bg-verified', ad: 'Doğrulanmış', ne: 'sahipliği makineyle doğrulanmış kaynak' },
  { cls: 'bg-documented', ad: 'Belgeli', ne: 'belgeyle destekli' },
  {
    cls: 'bg-referenced',
    ad: 'Referanslı',
    ne: 'platformda izlenen iş birliğinden kurum değerlendirmesi',
  },
  { cls: 'bg-declared', ad: 'Beyan', ne: 'kişinin sözü, henüz kanıtsız' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <span className="text-lg font-extrabold tracking-tight">Evidex</span>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#dongu" className="text-ink-soft hover:text-ink">
            Döngü
          </a>
          <a href="#ai" className="text-ink-soft hover:text-ink">
            Yapay zekânın yeri
          </a>
          <a
            href="https://github.com/wmb-tech/zemin360"
            target="_blank"
            rel="noreferrer"
            className="text-ink-soft hover:text-ink"
          >
            Kaynak kod
          </a>
          <Link
            to="/giris"
            className="bg-ink text-paper rounded-lg px-3 py-1.5 font-semibold hover:opacity-90"
          >
            Giriş
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20">
        <div className="text-accent text-xs font-semibold tracking-wide uppercase">
          GİRVAK gençlik ağı için
        </div>
        <h1 className="mt-3 max-w-3xl text-5xl leading-[1.05] font-extrabold tracking-tight">
          Beyan değil kanıt.
          <br />
          Skor değil gerekçe.
        </h1>
        <p className="text-ink-soft mt-6 max-w-2xl text-lg leading-relaxed">
          Genç kendini anlatmaz, kanıtını bağlar. Kurum ilan yazmaz, derdini söyler. Yapay zekâ
          kartı yazar, soruyu sorar, eşleşmeyi gerekçelendirir; her dışa dönük adımı GİRVAK onaylar.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/giris"
            className="bg-accent text-paper rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90"
          >
            Kartını aç
          </Link>
          <a
            href="#dongu"
            className="border-line hover:bg-paper-2 rounded-lg border px-5 py-2.5 text-sm font-semibold"
          >
            Nasıl çalışır
          </a>
        </div>

        <div className="mt-14 grid gap-3 md:grid-cols-4">
          {LEVELS.map((l) => (
            <div key={l.ad} className="border-line rounded-xl border p-4">
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${l.cls}`}
              >
                {l.ad}
              </span>
              <p className="text-ink-soft mt-2 text-sm">{l.ne}</p>
            </div>
          ))}
        </div>
        <p className="text-ink-soft mt-3 text-xs">
          Her iddianın seviyesi görünür. "Doğrulanmış" ile "beyan" aynı satırda aynı ağırlığı
          taşımaz.
        </p>
      </section>

      <section id="dongu" className="border-line border-t">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight">Altı ihtiyaç alanı, tek döngü</h2>
          <p className="text-ink-soft mt-2 max-w-2xl">
            Keşfet, doğrula, tanımla, eşleştir, izle, canlı tut. Biten iş birliği referans olur;
            referans yeni eşleşmeyi besler.
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {LOOP.map((s) => (
              <li key={s.n} className="border-line rounded-2xl border p-5">
                <div className="text-accent font-mono text-xs font-semibold">{s.n}</div>
                <div className="mt-1 text-lg font-bold">{s.ad}</div>
                <p className="text-ink-soft mt-1 text-sm leading-relaxed">{s.ne}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-line border-t">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
          <div>
            <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">Genç</div>
            <h3 className="mt-2 text-xl font-bold">Kanıtını bağla, kartını onayla</h3>
            <p className="text-ink-soft mt-2 text-sm leading-relaxed">
              GitHub ile gir, hangi repoları göstereceğini sen seç. Sistem sinyal çıkarır, ajan
              taslak yazar, sen onaylarsın. Kanıtın yoksa gerçek bir ihtiyaçtan türetilmiş 24–48
              saatlik meydan okumaya katıl; teslimin karta doğrulanmış kanıt olarak girer.
            </p>
          </div>
          <div>
            <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">Kurum</div>
            <h3 className="mt-2 text-xl font-bold">Derdini söyle, gerekçeli aday gör</h3>
            <p className="text-ink-soft mt-2 text-sm leading-relaxed">
              İlan yok. Ajan sorar, ihtiyaç kartı çıkar, sen düzeltip onaylarsın. Adaylar "neden
              uyuyor, ne eksik" ile gelir; tanıştırılmak istediğini tıkla, GİRVAK onaylayınca
              e-posta iki tarafa gider.
            </p>
          </div>
          <div>
            <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">
              GİRVAK
            </div>
            <h3 className="mt-2 text-xl font-bold">Tek kuyruk, tek ekran</h3>
            <p className="text-ink-soft mt-2 text-sm leading-relaxed">
              Ajanın yapmak istediği her dışa dönük şey onay kuyruğunda bekler. İş birlikleri,
              sessiz kartlar, keşif ve ölçüm ayrı ekranlarda; hiçbir mesaj sen onaylamadan gitmez.
            </p>
          </div>
        </div>
      </section>

      <section id="ai" className="border-line border-t">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight">Yapay zekânın yeri</h2>
          <p className="text-ink-soft mt-2 max-w-2xl">
            Dokuz ajan, her biri şemalı çıktı üretir ve her çağrı kaydedilir. Hiçbiri bir insana
            doğrudan yazmaz; öneri kuyruğa düşer, operatör onaylar, düzeltir ya da reddeder. Ölçüm
            paneli bu üç sayıyı gösterir: kart doğruluğu, ihtiyaç netliği, önerilerin akıbeti.
          </p>
          <div className="mt-8 grid gap-3 text-sm md:grid-cols-3">
            {[
              ['Kart taslağı', 'sinyal → kaynağa bağlı iddialar'],
              ['İhtiyaç yapılandırma', 'metin + cevaplar → kart, sıradaki soru'],
              ['Eşleştirme', 'kart + adaylar → gerekçeli sıralama'],
              ['Tanıştırma', 'ihtiyaç + gerekçe → e-posta taslağı'],
              ['Takip', 'bağlam → iki tarafa tek soru; cevap → özet, bayrak'],
              ['Meydan okuma', 'ihtiyaç → görev + rubrik; teslim → puan, bant'],
              ['Keşif', 'ihtiyaç + herkese açık profiller → gerekçeli davet'],
            ].map(([ad, ne]) => (
              <div key={ad} className="border-line flex items-baseline gap-3 rounded-xl border p-3">
                <span className="font-semibold">{ad}</span>
                <span className="text-ink-soft">{ne}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-line border-t">
        <div className="text-ink-soft mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs">
          <span>
            Evidex · Zemin360 Hackathon 2026 · GİRVAK · İstanbul Kalkınma Ajansı · İstanbul Bilgi
            Üniversitesi
          </span>
          <span>WMB · açık kaynak, MIT</span>
        </div>
      </footer>
    </div>
  );
}
