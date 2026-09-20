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
  text: z.string().min(8).max(240),
  sourceRefs: z.array(z.string()).min(1),
  periodStart: z.string().nullable(), // YYYY-MM-DD
  periodEnd: z.string().nullable(),
});

export const CardDraft = z.object({
  headline: z.string().min(3).max(80),
  story: z.string().min(20).max(700),
  claims: z.array(DraftClaim).max(12),
});
export type CardDraft = z.infer<typeof CardDraft>;

const SYSTEM = `Sen GİRVAK'ın kart yazım asistanısın. Bir gencin bağladığı repoların makine sinyallerini
alırsın; ondan bir yetkinlik kartı taslağı yazarsın. Kurallar:
- Her iddia kanıta dayanır ve sourceRefs ile ilgili repolara bağlanır. Sinyalde olmayan hiçbir şeyi
  yazma; abartma yok, "uzman" gibi sıfat yok.
- İddia somut ve okunur olsun: ne yapılmış, hangi araçla, ne kadar süre, canlıda mı, tek mi ekip mi.
  Örn: "React Native ile 8 aydır sürdürülen kafe sipariş uygulaması; canlıda; iki katkıcıdan biri."
- Sahiplik oranı düşükse (authorshipRatio < 0.3) bunu iddiada belirt ("ekip projesinde katkı").
- Fork repoları kanıt sayma (fork: true) — yalnız kişinin anlamlı commit'i varsa ve bunu belirt.
- Zaman aralığı sinyaldeki firstActivityAt/lastActivityAt'tan; YYYY-MM-DD; bilinmiyorsa null.
- headline: 3-8 kelimelik, kurumun anlayacağı bir konum ("Mobil ve web geliştirici" gibi).
- story: 2-4 cümle, kanıttan türeyen bir hikâye; kişi bunu sonra düzenleyecek.
- Türkçe yaz; teknoloji adları olduğu gibi kalır.
- En fazla 12 iddia; önemsiz/boş repoyu iddia yapma.`;

export function buildCardMessages(login: string, repos: RepoSignalInput[]): LlmMessage[] {
  const govde = repos
    .map((r) => `### ${r.ref}\n${JSON.stringify(r.signals, null, 1)}`)
    .join('\n\n');
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `GitHub kullanıcısı: ${login}\n\nREPOLAR VE SİNYALLER:\n${govde}\n\nKart taslağını üret.`,
    },
  ];
}

export async function runCardDrafter(llm: LlmProvider, login: string, repos: RepoSignalInput[]) {
  const { value, usage } = await llm.structured(buildCardMessages(login, repos), CardDraft, {
    schemaName: 'card_draft',
    maxTokens: 3000,
  });
  const gecerli = new Set(repos.map((r) => r.ref));
  // Uydurma kaynak referansı atılır; kaynaksız kalan iddia düşer.
  const claims = value.claims
    .map((c) => ({ ...c, sourceRefs: c.sourceRefs.filter((s) => gecerli.has(s)) }))
    .filter((c) => c.sourceRefs.length > 0);
  return { draft: { ...value, claims }, usage };
}
