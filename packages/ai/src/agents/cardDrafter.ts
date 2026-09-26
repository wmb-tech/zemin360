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
  sourceRefs: z.array(z.string()), // bilgi amaçlı: kaynakları iş sırasına göre kod bağlar
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
  /** Sistem hesaplar (katkıcı sayısı × sahiplik): model aynen kullanır, çelişki üretemez. */
  role?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  /** Özel repoların ürün adları: iddia metninde geçemez (kodla denetlenir). */
  privateNames?: string[];
}

/** Ürün adı sayılmayan, metinde doğal geçen kelimeler (gizlilik denetimi bunlara takılmaz). */
const ORTAK_KELIME = new Set([
  'adisyon',
  'stok',
  'stock',
  'erp',
  'platform',
  'site',
  'web',
  'mobile',
  'mobil',
  'backend',
  'frontend',
  'api',
  'app',
  'demo',
  'vitrin',
  'showcase',
  'marketing',
  'hub',
  'ads',
  'concept',
  'infra',
  'print',
  'agent',
  'starter',
  'repo',
  'website',
  'kit',
  'studio',
  'temel',
  'next',
  'panel',
  'admin',
  'shop',
  'store',
  'test',
  'wmb',
  'server',
  'client',
  'mobileapp',
]);

const gunAl = (v: unknown) => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null);

function grupAyrinti(
  refs: RepoSignalInput[],
): Pick<WorkGroup, 'role' | 'periodStart' | 'periodEnd' | 'privateNames'> {
  let toplam = 0;
  let agirlikliOran = 0;
  let oranAgirligi = 0;
  let katkici = 0;
  const ilkler: string[] = [];
  const sonlar: string[] = [];
  const gizli = new Set<string>();
  for (const r of refs) {
    const s = r.signals;
    const own = sayi(s.ownCommits) || sayi(s.commitCount);
    toplam += own;
    if (typeof s.authorshipRatio === 'number') {
      agirlikliOran += s.authorshipRatio * Math.max(own, 1);
      oranAgirligi += Math.max(own, 1);
    }
    katkici = Math.max(katkici, sayi(s.contributors));
    const i = gunAl(s.ownFirstCommitAt ?? s.firstActivityAt);
    const o = gunAl(s.ownLastCommitAt ?? s.lastActivityAt);
    if (i) ilkler.push(i);
    if (o) sonlar.push(o);
    if (s.isPrivate === true && r.ref.includes('/'))
      for (const t of r.ref
        .split('/')[1]!
        .toLowerCase()
        .split(/[-_.\s]+/))
        if (t.length >= 3 && !ORTAK_KELIME.has(t) && !/\d/.test(t)) gizli.add(t);
  }
  const oran = oranAgirligi ? agirlikliOran / oranAgirligi : null;
  const yuzde = oran === null ? null : Math.round(oran * 100);
  const role =
    katkici <= 1 || (oran !== null && oran >= 0.95)
      ? `tek başına (${toplam} commit)`
      : oran !== null && oran >= 0.5
        ? `${katkici} kişilik ekipte ana geliştirici (%${yuzde}, ${toplam} commit)`
        : oran !== null
          ? `${katkici} kişilik ekipte katkı (%${yuzde}, ${toplam} commit)`
          : `${toplam} commit`;
  ilkler.sort();
  sonlar.sort();
  return {
    role,
    periodStart: ilkler[0] ?? null,
    periodEnd: sonlar.at(-1) ?? null,
    privateNames: [...gizli],
  };
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
  const byRef = new Map(kendi.map((r) => [r.ref, r]));
  return (
    [...gruplar.entries()]
      .map(([key, g]) => {
        const sure = Number.isFinite(g.ilk) && Number.isFinite(g.son) ? (g.son - g.ilk) / ay : 0;
        // Süre katsayısı yumuşak: 3 ay sürdürülen iş, aynı commit'li 1 günlük işin ~1,5 katı.
        return {
          key,
          refs: g.refs,
          weight: Math.round(g.commit * (1 + Math.min(sure, 12) / 6)),
          ...grupAyrinti(g.refs.map((r) => byRef.get(r)!)),
        };
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
- Ne yapıldı ve kime/ne için; rol; canlıda mı (deployed/homepage). ROL satırını olduğu gibi kullan
  ("tek başına", "üç kişilik ekipte ana geliştirici (%89, 799 commit)"); kendin rol, oran ya da
  ekip büyüklüğü türetme, ROL ile çelişen ifade ("tek başına" + "ekip") yazma. Dönemi yazma;
  sistem ekler. Olmayan sayıyı uydurma.
- Ürünün ne olduğunu pageTitle, appName, description, readmeExcerpt, manifestDescription'dan al;
  aynı işin repoları arasında en açıklayıcı olanı esas al (ör. mobil uygulamanın README'si).
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
  const gruplar: WorkGroup[] =
    opts.groups ?? repos.map((r) => ({ key: r.ref, refs: [r.ref], weight: 0 }));
  const govde = gruplar
    .map(
      (g, i) =>
        `## İŞ ${i + 1} — kaynaklar: ${g.refs.join(', ')}\n` +
        (g.role ? `ROL (sistem hesapladı; AYNEN kullan, değiştirme): ${g.role}\n` : '') +
        (g.privateNames?.length
          ? `YASAK ADLAR (özel ürün; metinde geçmesin): ${g.privateNames.join(', ')}\n`
          : '') +
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
  // Gizlilik kodla denetlenir: özel ürün adı geçen iddia varsa bir kez, adları söyleyerek yeniden
  // yazdırılır; yine geçerse ad metinden çıkarılır (sızıntı hiçbir koşulda karta girmez).
  const ihlal = (v: typeof value) =>
    v.claims
      .slice(0, groups.length)
      .flatMap((c, i) =>
        (groups[i]!.privateNames ?? [])
          .filter((ad) => adGeciyor(c.text, ad))
          .map((ad) => ({ i, ad })),
      );
  let ihlaller = ihlal(value);
  if (ihlaller.length > 0) {
    const tekrar = await llm.structured(
      [
        ...messages,
        { role: 'assistant', content: JSON.stringify(value) },
        {
          role: 'user',
          content: `Şu iddialarda özel ürün adı geçiyor: ${ihlaller
            .map((x) => `İŞ ${x.i + 1} → "${x.ad}"`)
            .join(
              '; ',
            )}. Aynı içeriği bu adları KULLANMADAN, işi alanıyla tarif ederek yeniden yaz.`,
        },
      ],
      schema,
      { schemaName: 'card_draft', maxTokens: 3000 },
    );
    value = tekrar.value;
    usage = { ...tekrar.usage, durationMs: usage.durationMs + tekrar.usage.durationMs };
    ihlaller = ihlal(value);
  }
  // Kaynaklar ve dönem KOD tarafından bağlanır: i. iddia i. işin repolarıdır. Model yanlış ref ya
  // da tarih yazsa bile iddia doğru kanıta ve ölçülen döneme bağlı kalır.
  const claims = value.claims.slice(0, groups.length).map((c, i) => {
    const g = groups[i]!;
    let text = c.text;
    for (const x of ihlaller.filter((y) => y.i === i)) text = adiCikar(text, x.ad);
    return {
      ...c,
      text,
      sourceRefs: g.refs,
      periodStart: g.periodStart ?? c.periodStart,
      periodEnd: g.periodEnd ?? c.periodEnd,
    };
  });
  return { draft: { ...value, claims }, usage, groups };
}

const kacis = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Kelime olarak geçiyor mu (büyük/küçük harf ve Türkçe ek duyarsız: "Halqa'yı", "SAN projesi"). */
export function adGeciyor(metin: string, ad: string): boolean {
  return new RegExp(`(^|[^\\p{L}])${kacis(ad)}(?=[^\\p{L}]|$)`, 'iu').test(metin);
}
/** Son çare: adı, tırnaklarını ve kesme işaretli ekini metinden çıkarır. */
export function adiCikar(metin: string, ad: string): string {
  return metin
    .replace(new RegExp(`["“”]?${kacis(ad)}["“”]?('\\p{L}+)?\\s*`, 'giu'), '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
