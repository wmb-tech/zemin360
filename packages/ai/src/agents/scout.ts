import { ScoutBatchResult, type NeedCard } from '@evidex/shared';
import type { LlmMessage, LlmProvider } from '../provider';

/**
 * ### scout — döngü adımı: keşfet (01)
 * Onaylı ihtiyaç + GitHub'dan çekilmiş ağ dışı aday sinyalleri → davet edilmeye değer olanlar,
 * gerekçesiyle. Ajan davet ETMEZ: seçilenler onay kuyruğuna `invite` olarak düşer (ADR-0004).
 * ⚠ Sinyal herkese açık profil verisidir; kanıt değil ipucudur. Ajan "strong" dese de kişi
 * ağa girip kanıt bağlayana kadar kartı yoktur.
 */
export interface ScoutInput {
  login: string;
  url: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  publicRepos: number;
  followers: number;
  createdAt: string;
  topLanguages: string[];
  recentRepos: { name: string; language: string | null; pushedAt: string | null; stars: number }[];
  lastPushedAt: string | null;
}

const SYSTEM = `Sen GİRVAK'ın keşif asistanısın. Bir kurum ihtiyacı ve GitHub'dan bulunmuş ağ dışı adayların
herkese açık sinyallerini alırsın. Görevin: ihtiyaçla gerçekten ilgili görünenleri seçmek. Kurallar:
- Yalnız verilen login'lerden seç; uydurma.
- fit: strong (son 6 ayda ihtiyacın çekirdek dilinde/alanında aktif, birden fazla ilgili repo),
  possible (ilgili ama zayıf ya da eski sinyal). İlgisizi seçme.
- why: sinyale bağlı somut gerekçe ("son 3 ay içinde 2 TypeScript reposu, biri React Native").
  Görmediğin şeyi yazma.
- inviteLine: davet e-postasına girecek, kişinin profilinde gördüğün somut bir şeye atıf yapan
  tek cümle, samimi, abartısız. Türkçe.
- En çok 10 kişi. Hiç uygun yoksa boş liste.`;

export function buildScoutMessages(need: NeedCard, candidates: ScoutInput[]): LlmMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `İHTİYAÇ:\n${JSON.stringify(need, null, 1)}\n\nADAYLAR:\n${JSON.stringify(candidates, null, 1)}\n\nSeç ve gerekçelendir.`,
    },
  ];
}

export async function runScout(llm: LlmProvider, need: NeedCard, candidates: ScoutInput[]) {
  if (candidates.length === 0) {
    return { picks: [], usage: null };
  }
  const { value, usage } = await llm.structured(
    buildScoutMessages(need, candidates),
    ScoutBatchResult,
    { schemaName: 'scout_batch', maxTokens: 2500 },
  );
  const gecerli = new Set(candidates.map((c) => c.login));
  // Uydurulmuş login'ler atılır (matcher ile aynı ilke).
  return { picks: value.picks.filter((p) => gecerli.has(p.login)), usage };
}
