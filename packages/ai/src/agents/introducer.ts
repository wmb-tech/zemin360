import { IntroDraft, type MatchReasoning, type NeedCard } from '@evidex/shared';
import type { LlmMessage, LlmProvider } from '../provider';

/**
 * ### introducer — döngü adımı: eşleştir (03)
 * Kurum "tanıştır" deyince iki tarafa gidecek tek e-postayı taslaklar: ihtiyaç, kişinin
 * kanıta bağlı uyumu, sonraki adım. Gönderim onay kuyruğundan (ADR-0004); operatör düzenler.
 * ⚠ Ajan iletişim bilgisi yazmaz; e-posta zaten iki tarafa "cc" gibi gider, adresler orada.
 */
export interface IntroContext {
  organizationName: string;
  talentName: string;
  need: NeedCard;
  reasoning: MatchReasoning;
}

const SYSTEM = `Sen GİRVAK'ın tanıştırma asistanısın. Bir kurum ile bir genci aynı e-postada tanıştırırsın.
Kurallar:
- Tek mesaj, iki tarafa birden; 4–7 cümle; sıcak ama abartısız; Türkçe; düz metin, markdown yok.
- Önce ihtiyacı bir cümleyle söyle, sonra gencin neden uygun göründüğünü KANITA bağlı 1–2 cümleyle
  (verilen "fits" maddelerinden; uydurma).
- "gaps" varsa dürüstçe ama kısa geçebilirsin ("şu konuda deneyimi görünmüyor, görüşmede konuşulur").
- Sonraki adımı net yaz: 30 dakikalık tanışma görüşmesi; tarih önerisini taraflar yapsın.
- GİRVAK'ın 3 gün sonra kısa bir takip sorusu göndereceğini söyle.
- Konu satırı: "Tanıştırma: <kurum> · <genç adı> · <ihtiyaç başlığı>" biçiminde, 12 kelimeyi geçme.`;

export function buildIntroMessages(ctx: IntroContext): LlmMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `BAĞLAM:\n${JSON.stringify(ctx, null, 1)}\n\nTanıştırma e-postasını yaz.`,
    },
  ];
}

export async function runIntroducer(llm: LlmProvider, ctx: IntroContext) {
  const { value, usage } = await llm.structured(buildIntroMessages(ctx), IntroDraft, {
    schemaName: 'intro_draft',
    maxTokens: 1200,
  });
  return { draft: value, usage };
}
