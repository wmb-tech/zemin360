import { MatchBatchResult, type NeedCard } from '@evidex/shared';
import type { LlmMessage, LlmProvider } from '../provider';

/**
 * ### matcher — döngü adımı: eşleştir (03)
 * Onaylı ihtiyaç kartı + aday kartları (yalnız ONAYLI iddialar) → gerekçeli, sıralı liste.
 * Sayı yok (KARAR-08): güçlü / olası / zayıf. Her "uyuyor" cümlesi bir iddiaya bağlanır
 * (claimIds) — kurum tıklayıp kaynağı görebilsin. ⚠ Ajan tanıştırmaz; kısa liste operatörün
 * onay kuyruğuna düşer (ADR-0004).
 */
export interface CandidateCard {
  talentId: string;
  name: string;
  headline: string | null;
  story: string | null;
  /** Şehir; yalnız yerinde/hibrit ihtiyaçlarda anlam taşır (gaps'e girer, eleme değil). */
  city: string | null;
  claims: {
    id: string;
    text: string;
    level: 'verified' | 'documented' | 'referenced' | 'declared';
    periodStart: string | null;
    periodEnd: string | null;
  }[];
}

const LEVEL_TR = {
  verified: 'doğrulanmış',
  documented: 'belgeli',
  referenced: 'referanslı',
  declared: 'beyan',
} as const;

const SYSTEM = `Sen GİRVAK'ın eşleştirme asistanısın. Bir ihtiyaç kartı ve aday kartları alırsın; her aday için
GEREKÇELİ bir değerlendirme yaparsın. Kurallar:
- Skor verme. Üç seviye: strong (ihtiyacın çekirdeğini doğrulanmış kanıtla karşılıyor), possible (kısmen
  karşılıyor ya da kanıt zayıf seviyede), weak (temel gereklilik eksik).
- "fits" maddeleri somut ve KANITA BAĞLI olsun: her madde ilgili iddia id'lerini (claimIds) taşısın.
  Kanıtı olmayan bir uyum yazma.
- Kanıt seviyesine dikkat et: "beyan" seviyesindeki iddia tek başına strong yapmaz.
- Zamanı hesaba kat: uzun süre sürdürülmüş iş, tek seferlik denemeden değerlidir.
- "gaps" dürüst olsun: ihtiyacın istediği ama kartta olmayan şeyler.
- summaryForOrganization: kurum temsilcisinin 20 saniyede okuyacağı, teknik olmayan 2–3 cümle.
- Konum: ihtiyaç workMode "onsite" ya da "hybrid" ise adayın şehri ile kurumun şehrini karşılaştır;
  farklıysa bunu "gaps"e açıkça yaz ("kurum İzmir'de, aday İstanbul'da; hibrit çalışma için mesafe var").
  Şehir eşleşmesi tek başına strength'i yükseltmez; "remote" ihtiyaçta şehri hiç değerlendirme.
- Uygun olmayan adayı listeden ÇIKARMA; weak olarak ve gerekçesiyle ver — karar operatörün.
- Sıralama: strong → possible → weak; aynı seviyede kanıt gücüne göre.`;

export function buildMatchMessages(
  need: NeedCard,
  candidates: CandidateCard[],
  organizationCity: string | null = null,
): LlmMessage[] {
  const ihtiyac = JSON.stringify({ ...need, organizationCity }, null, 1);
  const adaylar = candidates
    .map((c) => {
      const iddialar = c.claims
        .map(
          (k) =>
            `  - [${k.id}] (${LEVEL_TR[k.level]}${k.periodStart ? `, ${k.periodStart}→${k.periodEnd ?? 'devam'}` : ''}) ${k.text}`,
        )
        .join('\n');
      return `Aday ${c.talentId} — ${c.name}${c.headline ? ` · ${c.headline}` : ''}${c.city ? ` · ${c.city}` : ''}\n${c.story ? `  Hikâye: ${c.story}\n` : ''}  İddialar:\n${iddialar || '  (onaylı iddia yok)'}`;
    })
    .join('\n\n');
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `İHTİYAÇ KARTI:\n${ihtiyac}\n\nADAYLAR:\n${adaylar}\n\nHer aday için talentId ile birlikte değerlendirme ver; claimIds yalnız yukarıdaki köşeli parantezli id'lerden.`,
    },
  ];
}

export async function runMatcher(
  llm: LlmProvider,
  need: NeedCard,
  candidates: CandidateCard[],
  organizationCity: string | null = null,
) {
  if (candidates.length === 0) {
    return { results: [], usage: null };
  }
  const { value, usage } = await llm.structured(
    buildMatchMessages(need, candidates, organizationCity),
    MatchBatchResult,
    {
      schemaName: 'match_batch',
      maxTokens: 4096,
    },
  );
  // Modelin uydurduğu talentId veya claimId'yi at: kanıta bağlanmayan gerekçe karta girmez.
  const gecerliAday = new Set(candidates.map((c) => c.talentId));
  const gecerliIddia = new Set(candidates.flatMap((c) => c.claims.map((k) => k.id)));
  const results = value.results
    .filter((r) => gecerliAday.has(r.talentId))
    .map((r) => ({
      ...r,
      fits: r.fits.map((f) => ({
        ...f,
        claimIds: f.claimIds.filter((id) => gecerliIddia.has(id)),
      })),
    }));
  return { results, usage };
}
