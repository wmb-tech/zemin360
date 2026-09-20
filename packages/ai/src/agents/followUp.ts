import { CheckinInsight, FollowUpDraft, type CheckinSide } from '@evidex/shared';
import type { LlmMessage, LlmProvider } from '../provider';

/**
 * ### follow_up — döngü adımı: izle (06)
 * Tanıştırmadan birkaç gün sonra iki tarafa ayrı ayrı tek soru: "görüştünüz mü, başladı mı,
 * nasıl gidiyor?" Ajan soruyu bağlama göre yazar (kurum adı, ihtiyaç, geçen süre, son durum);
 * gönderim onay kuyruğundan geçer (ADR-0004). Cevap geldiğinde ikinci ajan serbest metni
 * yorumlar: özet + bayrak + "operatör baksın mı". Operatör her cevabı okumaz, bayraklıyı okur.
 * ⚠ Ajan durum KARARI vermez; durumu taraf seçer, ajan yalnız metni özetler.
 */
export interface FollowUpContext {
  organizationName: string;
  talentFirstName: string;
  needTitle: string;
  status: string; // CollaborationStatus
  daysSinceIntroduction: number;
  round: number; // kaçıncı takip
  lastTalentFeedback: string | null;
  lastOrganizationFeedback: string | null;
}

const DRAFT_SYSTEM = `Sen GİRVAK'ın takip asistanısın. Tanıştırılmış bir genç ile kurum arasındaki iş birliğinin
nasıl gittiğini öğrenmek için iki tarafa ayrı ayrı kısa bir e-posta yazarsın. Kurallar:
- Her mesaj 3–6 cümle, samimi ama resmî değil; "sen" dili gence, "siz" dili kuruma.
- Tek soru sor: görüşme oldu mu / başladı mı / nasıl gidiyor — mevcut duruma göre uygun olanı.
- Mesajda linkten cevap vereceklerini söyle; linki SEN yazma, mesajın sonunda ayrı satırda "[link]" yer tutucusu koy.
- Önceki turdan geri bildirim varsa ona atıf yap ("geçen sefer ... demiştiniz").
- Kimseye baskı yapma; "olmadıysa da sorun değil, bilelim yeter" tonu.
- Türkçe, düz metin, markdown yok. Konu satırı 5–10 kelime.`;

export function buildFollowUpMessages(ctx: FollowUpContext): LlmMessage[] {
  return [
    { role: 'system', content: DRAFT_SYSTEM },
    { role: 'user', content: `BAĞLAM:\n${JSON.stringify(ctx, null, 1)}\n\nİki mesajı yaz.` },
  ];
}

export async function runFollowUpDrafter(llm: LlmProvider, ctx: FollowUpContext) {
  const { value, usage } = await llm.structured(buildFollowUpMessages(ctx), FollowUpDraft, {
    schemaName: 'follow_up_draft',
    maxTokens: 1500,
  });
  return { draft: value, usage };
}

export interface CheckinInput {
  side: CheckinSide;
  status: string; // tarafın seçtiği durum
  feedback: string; // serbest metin (boş olabilir; boşsa ajan çağrılmaz)
  organizationName: string;
  needTitle: string;
  organizationCanReference: boolean; // KARAR-10: yalnız GİRVAK onaylı kurum referans verir
}

const INSIGHT_SYSTEM = `Sen GİRVAK'ın takip cevabı okuyucususun. Bir tarafın (genç ya da kurum) seçtiği durumu ve
serbest metnini alırsın. Kurallar:
- summary: metni 1–2 cümleyle özetle; metinde olmayan şeyi ekleme.
- flags: yalnız metinde açıkça görünen bayraklar.
- needsOperator: ödeme, kapsam, iletişim kopukluğu, hiç görüşememe ya da anlaşmazlık varsa true;
  olumlu/rutin ilerlemede false. operatorNote: true ise operatörün ne yapması gerektiğini tek
  cümleyle yaz, değilse null.
- referenceClaim: YALNIZ taraf kurum, durum "completed" ve organizationCanReference true ise
  gencin kartına girecek tek cümle yaz: kurum adı, işin ne olduğu, kurumun değerlendirmesi;
  abartma, metinde olmayan sıfat kullanma. Diğer her durumda null.
- Türkçe, düz metin.`;

export function buildCheckinMessages(input: CheckinInput): LlmMessage[] {
  return [
    { role: 'system', content: INSIGHT_SYSTEM },
    { role: 'user', content: `CEVAP:\n${JSON.stringify(input, null, 1)}\n\nYorumla.` },
  ];
}

export async function runCheckinInterpreter(llm: LlmProvider, input: CheckinInput) {
  const { value, usage } = await llm.structured(buildCheckinMessages(input), CheckinInsight, {
    schemaName: 'checkin_insight',
    maxTokens: 800,
  });
  // Ajan kuralı çiğnese bile referans kapısı kodda: kurum değilse / tamamlanmadıysa / onaysızsa yok.
  const referansOlabilir =
    input.side === 'organization' && input.status === 'completed' && input.organizationCanReference;
  return {
    insight: { ...value, referenceClaim: referansOlabilir ? value.referenceClaim : null },
    usage,
  };
}
