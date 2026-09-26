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

/**
 * ### İş grupları — seçim deterministik, yazım ajanın
 * 60 repoyu "hangi işler karta girsin" diye modele bırakınca her turda başka bir alt küme
 * seçiyordu (bir turda 17 madde, sonrakinde 6; bisatsan, autoviz, TFF gibi yüzlerce commit'lik
 * işler düştü). Artık: repolar ürün kökünden gruplanır (bisatsan-web/-backend/-mobile → bisatsan;
 * wmb-adisyon-v2-* → wmb adisyon), grup ağırlığı kişinin kendi emeğiyle ölçülür (commit × süre),
 * en ağır N grup seçilir; ajan her gruba TAM BİR madde yazar, kaynakları kod bağlar.
 */
export interface WorkGroup {
  key: string;
  refs: string[];
  weight: number;
}

const GENEL = new Set([
  'the',
  'my',
  'app',
  'web',
  'site',
  'website',
  'frontend',
  'backend',
  'api',
  'v2',
]);

/** Repo adından ürün kökü: sahip atılır, ayraçla bölünür; "wmb" önekinde ikinci kelime de alınır. */
export function isKoku(ref: string): string {
  if (!ref.includes('/')) return `kaynak:${ref}`; // belge / canlı ürün: tek başına bir iş
  const ad = ref.split('/')[1]!.toLowerCase();
  const parcalar = ad
    .split(/[-_.\s]+/)
    .map((p) => p.replace(/\d+$/, ''))
    .filter((p) => p && !GENEL.has(p));
  if (parcalar.length === 0) return ad;
  if (parcalar[0] === 'wmb' && parcalar[1]) return `wmb ${parcalar[1]}`;
  return parcalar[0]!;
}

const sayi = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const tarih = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : NaN);

export function groupWork(repos: RepoSignalInput[], limit: number): WorkGroup[] {
  const gruplar = new Map<string, { refs: string[]; commit: number; ilk: number; son: number }>();
  // Fork başkasının işidir: kişinin commit'i olmadıkça iş sayılmaz.
  const kendi = repos.filter((r) => !(r.signals.fork === true && !sayi(r.signals.ownCommits)));
  for (const r of kendi) {
    const k = isKoku(r.ref);
    const g = gruplar.get(k) ?? { refs: [], commit: 0, ilk: Infinity, son: -Infinity };
    g.refs.push(r.ref);
    const s = r.signals;
    // Belge/canlı ürün commit taşımaz; sabit bir ağırlıkla yarışır (küçük işler arasında kalır).
    g.commit += r.ref.includes('/') ? sayi(s.ownCommits) || sayi(s.commitCount) : 20;
    const i = tarih(s.ownFirstCommitAt ?? s.firstActivityAt);
    const o = tarih(s.ownLastCommitAt ?? s.lastActivityAt);
    if (!Number.isNaN(i)) g.ilk = Math.min(g.ilk, i);
    if (!Number.isNaN(o)) g.son = Math.max(g.son, o);
    gruplar.set(k, g);
  }
  const ay = 30 * 24 * 3600 * 1000;
  return (
    [...gruplar.entries()]
      .map(([key, g]) => {
        const sure = Number.isFinite(g.ilk) && Number.isFinite(g.son) ? (g.son - g.ilk) / ay : 0;
        // Süre katsayısı yumuşak: 3 ay sürdürülen iş, aynı commit'li 1 günlük işin ~1,5 katı.
        return { key, refs: g.refs, weight: Math.round(g.commit * (1 + Math.min(sure, 12) / 6)) };
      })
      .sort((a, b) => b.weight - a.weight)
      // Küçük iş (ağırlık < 3) yalnız yerine en az 3 anlamlı iş varsa elenir; yeni başlayan bir
      // gencin birkaç commit'lik reposu yok sayılıp kartı boş bırakılmaz.
      .filter((g, _i, hepsi) => g.weight >= 3 || hepsi.filter((x) => x.weight >= 3).length < 3)
      .slice(0, Math.max(1, limit))
  );
}

/** Kartın TAMAMINDAKİ üst sınır: onaylı + yeni taslak birlikte bunu aşmaz. */
export const MAX_CLAIMS = 10;

export const cardDraftSchema = (max: number = MAX_CLAIMS, min = 1) =>
  z.object({
    headline: z.string().min(3).max(80),
    story: z.string().min(80).max(900),
    claims: z
      .array(DraftClaim)
      .min(Math.min(min, Math.max(1, Math.min(max, MAX_CLAIMS))))
      .max(Math.max(1, Math.min(max, MAX_CLAIMS))),
  });
export const CardDraft = cardDraftSchema();
export type CardDraft = z.infer<typeof CardDraft>;

const SYSTEM = `DİL: ÇIKTININ TAMAMI TÜRKÇE. Girdi sinyalleri (repo açıklamaları, README) İngilizce olsa bile
headline, story ve her iddia Türkçe yazılır; yalnız teknoloji adları olduğu gibi kalır.

Sen GİRVAK'ın kart yazım asistanısın. Bir gencin bağladığı kaynakların (repo, belge, canlı
ürün) makine sinyallerini alırsın; ondan bir kurum temsilcisinin 1 dakikada okuyup "bu kişi ne
yapabiliyor" diyeceği bir yetkinlik kartı taslağı yazarsın. Kurallar:

İŞLER SANA GRUPLANMIŞ GELİR
- Girdi "İŞ 1, İŞ 2, …" diye gruplanmış ve emeğe göre sıralanmıştır (kişinin kendi commit'i ×
  süre). Her İŞ için TAM BİR iddia yaz, AYNI SIRAYLA. İş atlama, iki işi birleştirme, yeni iş
  ekleme. Bir İŞ'in birden çok reposu aynı ürünün parçalarıdır (web + api + mobil + site): tek
  iddiada anlat.
- sourceRefs'e o İŞ'in repolarını yaz (sistem yine de sıraya göre bağlar).

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
  opts: { budget?: number; existing?: string[]; groups?: WorkGroup[] } = {},
): LlmMessage[] {
  const bySref = new Map(repos.map((r) => [r.ref, r]));
  const gruplar = opts.groups ?? repos.map((r) => ({ key: r.ref, refs: [r.ref], weight: 0 }));
  const govde = gruplar
    .map(
      (g, i) =>
        `## İŞ ${i + 1} — kaynaklar: ${g.refs.join(', ')}\n` +
        g.refs
          .map((ref) => `### ${ref}\n${JSON.stringify(bySref.get(ref)?.signals ?? {}, null, 1)}`)
          .join('\n'),
    )
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
      content: `GitHub kullanıcısı: ${login}\n\nİŞLER VE SİNYALLER:\n${govde}${mevcut}\n\n${opts.groups ? `TAM ${opts.groups.length} iddia yaz: her İŞ için bir tane, aynı sırayla.` : `EN FAZLA ${butce} madde yaz.`} (Kartın toplam sınırı ${MAX_CLAIMS}; ${opts.existing?.length ?? 0} madde zaten onaylı.) Kart taslağını üret.`,
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
  const groups = groupWork(repos, opts.budget ?? MAX_CLAIMS);
  const schema = cardDraftSchema(groups.length, groups.length);
  const messages = buildCardMessages(login, repos, { ...opts, groups });
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
  // Kaynaklar sıraya göre KOD tarafından bağlanır: i. iddia i. işin repolarıdır. Model yanlış ya
  // da uydurma ref yazsa bile iddia doğru kanıta bağlı kalır; fazla iddia atılır.
  const claims = value.claims
    .slice(0, groups.length)
    .map((c, i) => ({ ...c, sourceRefs: groups[i]!.refs }));
  return { draft: { ...value, claims }, usage, groups };
}
