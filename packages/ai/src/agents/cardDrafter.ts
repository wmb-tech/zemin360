import { z } from 'zod';
import type { LlmMessage, LlmProvider } from '../provider';

/**
 * ### card_drafter — döngü adımı: doğrula (02)
 * Kanıt sinyallerinden (repo başına) kişi kartı taslağı yazar: başlık, hikâye bloğu ve
 * iddialar. Her iddia en az bir kaynağa (repo tam adı) bağlanır; kaynağı olmayan iddia
 * atılır. Seviye burada verilmez — kaynak türü belirler (GitHub App → verified).
 * ⚠ Ajan kartı onaylamaz; kişi her iddiayı görür, düzeltir, onaylar.
 */
export interface RepoSignalInput {
  ref: string; // owner/name
  signals: Record<string, unknown>;
}

export const DraftClaim = z.object({
  text: z.string().min(40).max(400), // 2–3 cümle: ne, kime, rol/sahiplik, süre, canlı mı; yığın listesi yok
  sourceRefs: z.array(z.string()).min(1), // birleşik iddia birden çok kaynağa bağlanır
  periodStart: z.string().nullable(), // YYYY-MM-DD
  periodEnd: z.string().nullable(),
});

/** Kartın TAMAMINDAKİ üst sınır: onaylı + yeni taslak birlikte bunu aşmaz. */
export const MAX_CLAIMS = 10;

export const cardDraftSchema = (max: number = MAX_CLAIMS) =>
  z.object({
    headline: z.string().min(3).max(80),
    story: z.string().min(80).max(900),
    claims: z
      .array(DraftClaim)
      .min(1)
      .max(Math.max(1, Math.min(max, MAX_CLAIMS))),
  });
export const CardDraft = cardDraftSchema();
export type CardDraft = z.infer<typeof CardDraft>;

const SYSTEM = `DİL: ÇIKTININ TAMAMI TÜRKÇE. Girdi sinyalleri (repo açıklamaları, README) İngilizce olsa bile
headline, story ve her iddia Türkçe yazılır; yalnız teknoloji adları olduğu gibi kalır.

Sen GİRVAK'ın kart yazım asistanısın. Bir gencin bağladığı kaynakların (repo, belge, canlı
ürün) makine sinyallerini alırsın; ondan bir kurum temsilcisinin 1 dakikada okuyup "bu kişi ne
yapabiliyor" diyeceği bir yetkinlik kartı taslağı yazarsın. Kurallar:

İDDİA = İŞ, REPO DEĞİL
- En az 3, en fazla 10 iddia. Her iddia BİR ürünü/işi anlatır. Aynı ürünün parçaları (web + api +
  mobil + site), aynı türden denemeler, aynı müşteri için yapılan repolar TEK iddiada birleşir;
  sourceRefs'e hepsi yazılır. Önemsiz, boş, tek commit'lik ya da fork repolar tek başına iddia
  olmaz; bir birleşik iddianın parçası olabilir ya da hiç yazılmaz.
- Sıra: en çok şey söyleyen iş en üstte (uzun süre × yüksek sahiplik × yakın tarih × canlıda).
- KAPSAM: kişinin ciddi emek verdiği hiçbir ürün listeden DÜŞMESİN. Çok commit'li ya da uzun
  süreli bir ürünü yer kalmadı diye atlama; küçük işleri birleştirerek ya da hiç yazmayarak yer aç.
  Sınıra dayanıyorsan önce benzer küçük işleri tek maddede topla ("üç vitrin sitesi"), asıl ürünü
  koru.

ÜRÜNÜN NE OLDUĞUNU NEREDEN BİLİRSİN
- YALNIZ description, readmeExcerpt, manifestDescription, topics ve homepage'den. Bunlar boşsa
  ürünün alanını REPO ADINDAN TAHMİN ETME ("gise" → "gişe sistemi" gibi uydurma OLMAZ; o repo bir
  mimarlık stüdyosunun sitesiydi). Alan bilinmiyorsa teknik olarak tarif et: "bir web uygulamasının
  backend'i ve yönetim paneli". Kod dili/araçlar sinyalden, ürünün amacı yalnız belgeden.

HER İDDİANIN İÇİ (2–3 cümle, 40–400 karakter)
- Ne yapıldı ve kime/ne için; rol ve sahiplik (ownCommits ve authorshipRatio'dan: "tek başına",
  "iki kişilik ekipte ana geliştirici (%72)", "üç kişilik ekipte katkı (%28, 40 commit)"); süre
  ve dönem; canlıda mı (deployed/homepage). Sayıları sinyalden al; olmayan sayıyı uydurma.
- YIĞIN LİSTESİ YAZMA. "TypeScript, Docker ve GitHub Actions kullandı", "test ve CI kurdu" gibi
  cümleler iddiaya GİRMEZ; bunlar karttaki yetkinlik bölümünde sinyalden otomatik çıkar. Bir
  teknoloji ancak işin kendisini ayırt ediyorsa geçer ("Expo ile mağaza içi sipariş uygulaması").
- Kanıta dayanmayan sıfat yok ("uzman", "ileri düzey"). Abartma yok; küçük işi küçük yaz.

GİZLİLİK
- isPrivate: true olan repoların ADINI ve description/readmeExcerpt/manifestDescription'daki ÜRÜN
  ADINI iddiaya YAZMA ("Halqa'yı geliştirdi" OLMAZ → "geleneksel sanatlar için galeri, akademi ve
  müzayede platformu"). İşi alanıyla tarif et; kurumun/ekibin özel reposu kişinin kartından dışarı
  sızmamalı. Herkese açık repo ya da canlı üründe ad yazılabilir ama gerekmez.
- Teknoloji adıyla biten dolgu cümle yazma ("Proje Next.js tabanlıdır." gibi); yığın zaten
  yetkinlik bölümünde ölçülü olarak var.

KAYNAK TÜRLERİ
- kind: "document" belgedir (docType, issuer, years, excerptLines): belgenin söylediğini aktar,
  fazlasını yazma. kind: "live_url" canlı üründür. kind: "network_reference" ve
  "challenge_submission" platform içi kayıttır; olduğu gibi aktar.

DİĞER
- Zaman aralığı: ownFirstCommitAt/ownLastCommitAt varsa onlardan, yoksa firstActivityAt/
  lastActivityAt; YYYY-MM-DD; bilinmiyorsa null. Birleşik iddiada en erken–en geç.
- headline: 3–8 kelime, kurumun anlayacağı konum ("Full-stack web ve mobil geliştirici").
- story: 3–4 cümle, kanıttan türeyen somut bir özet: kaç ürün, ekip/tek, canlıda kaç iş, hangi
  dönem, ne tür işler. Yığın listesi burada da yok. Genel geçer cümle yok ("çeşitli projelerde
  yer aldım" YASAK).
- Türkçe, düz metin, markdown yok; teknoloji adları olduğu gibi.`;

export function buildCardMessages(
  login: string,
  repos: RepoSignalInput[],
  opts: { budget?: number; existing?: string[] } = {},
): LlmMessage[] {
  const govde = repos
    .map((r) => `### ${r.ref}\n${JSON.stringify(r.signals, null, 1)}`)
    .join('\n\n');
  const butce = opts.budget ?? MAX_CLAIMS;
  // Kartta zaten onaylı maddeler varsa bütçe kalan yerdir; onaylı işler tekrar yazılmaz.
  const mevcut = opts.existing?.length
    ? `\n\nKARTTA ZATEN ONAYLI OLAN MADDELER (bunları TEKRARLAMA, aynı işi yeniden yazma):\n${opts.existing
        .map((t) => `- ${t}`)
        .join('\n')}`
    : '';
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `GitHub kullanıcısı: ${login}\n\nREPOLAR VE SİNYALLER:\n${govde}${mevcut}\n\nEN FAZLA ${butce} madde yaz (kartın toplam sınırı ${MAX_CLAIMS}; ${opts.existing?.length ?? 0} madde zaten onaylı). Kart taslağını üret.`,
    },
  ];
}

/** Kaba dil sezgisi: sık İngilizce kelime sık Türkçe kelimeden çoksa İngilizce sayılır. */
export function looksEnglish(text: string) {
  const en = (text.match(/\b(the|and|with|of|for|as|developed|built|using)\b/gi) ?? []).length;
  const tr = (text.match(/\b(ve|ile|için|olarak|bir|geliştirdi|kullanarak|ekip)\b/gi) ?? []).length;
  return en > tr;
}

export async function runCardDrafter(
  llm: LlmProvider,
  login: string,
  repos: RepoSignalInput[],
  opts: { budget?: number; existing?: string[] } = {},
) {
  const schema = cardDraftSchema(opts.budget);
  const messages = buildCardMessages(login, repos, opts);
  let { value, usage } = await llm.structured(messages, schema, {
    schemaName: 'card_draft',
    maxTokens: 3000,
  });
  // Model İngilizce girdiye kayabiliyor (ilk gerçek kullanıcıda oldu): tespit et, bir kez yeniden iste.
  const metin = [value.story, ...value.claims.map((c) => c.text)].join(' ');
  if (looksEnglish(metin)) {
    const tekrar = await llm.structured(
      [
        ...messages,
        { role: 'assistant', content: JSON.stringify(value) },
        {
          role: 'user',
          content:
            'Bu çıktı İngilizce. Aynı içeriği TAMAMEN TÜRKÇE yeniden yaz; teknoloji adları dışında İngilizce kelime kullanma.',
        },
      ],
      schema,
      { schemaName: 'card_draft', maxTokens: 3000 },
    );
    value = tekrar.value;
    usage = { ...tekrar.usage, durationMs: usage.durationMs + tekrar.usage.durationMs };
  }
  const gecerli = new Set(repos.map((r) => r.ref));
  // Uydurma kaynak referansı atılır; kaynaksız kalan iddia düşer.
  const claims = value.claims
    .map((c) => ({ ...c, sourceRefs: c.sourceRefs.filter((s) => gecerli.has(s)) }))
    .filter((c) => c.sourceRefs.length > 0);
  return { draft: { ...value, claims }, usage };
}
