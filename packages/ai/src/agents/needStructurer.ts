import { z } from 'zod';
import { CollaborationType, NeedCard, WorkMode } from '@evidex/shared';
import type { LlmMessage, LlmProvider } from '../provider';

/**
 * ### need_structurer — döngü adımı: tanımla (05)
 * Kurumun serbest metnini soru sorarak yapılandırılmış ihtiyaç kartına çevirir.
 * Her adımda: en iyi tahminle doldurulmuş taslak kart + (bitmediyse) tek bir sonraki soru.
 * ⚠ Ajan kartı ONAYLAMAZ; kurum onaylar. En fazla MAX_QUESTIONS soru; sonra kart çıkar.
 */
export const MAX_QUESTIONS = 7;

/** Taslakta alanlar boş kalabilir; onaylanan kart NeedCard'ı tam karşılamalı. */
export const DraftNeedCard = NeedCard.partial().extend({
  collaborationType: CollaborationType.nullable(),
  workMode: WorkMode.nullable(),
});
export type DraftNeedCard = z.infer<typeof DraftNeedCard>;

export const NeedStructurerStep = z.object({
  draft: DraftNeedCard,
  /** Onay için hâlâ eksik olan alanlar (NeedCard alan adları). */
  missing: z.array(z.string()),
  done: z.boolean(),
  nextQuestion: z
    .object({
      text: z.string().min(3).max(300),
      why: z.string().max(200),
    })
    .nullable(),
});
export type NeedStructurerStep = z.infer<typeof NeedStructurerStep>;

export interface NeedTurn {
  question: string;
  answer: string;
}

const REQUIRED: (keyof z.infer<typeof NeedCard>)[] = [
  'title',
  'summary',
  'collaborationType',
  'expectedOutput',
  'workMode',
  'requiredSkills',
];

const SYSTEM = `Sen GİRVAK'ın ihtiyaç yapılandırma asistanısın. Bir kurum sana bir derdini anlatır;
senin işin bunu üçüncü bir kişinin uygulayabileceği kadar net bir "ihtiyaç kartı"na çevirmek.

Kurallar:
- Her adımda elindeki bilgiyle taslak kartı en iyi tahminle doldur; emin olmadığın alanı boş bırak (null/boş dizi), uydurma.
- Bitmediyse TEK bir soru sor; en çok belirsizlik gideren soruyu seç. Aynı anda birden fazla şey sorma.
- Soru dili sade Türkçe; jargon yok; kurum temsilcisi teknik olmayabilir.
- Şu alanlar dolmadan bitmiş sayma: başlık, özet, iş birliği türü, beklenen çıktı, çalışma biçimi, gerekli beceriler.
- İş birliği türü seçenekleri: staj (internship), proje (project), yarı zamanlı (part_time), tam zamanlı (full_time), pilot müşteri (pilot_customer), kurucu ortak (co_founder), mentor (mentor). Kurum "eleman" derken çoğu zaman proje ya da yarı zamanlı kastediyor olabilir; sor.
- Beceri listesi somut olsun ("mobil" değil "React Native"), ama kurum bilmiyorsa zorlamak yerine çıktıdan çıkar.
- Süre haftalarla; bilinmiyorsa null.
- ${MAX_QUESTIONS} sorudan sonra elindekiyle kartı bitir ve done=true ver.`;

export function buildMessages(rawText: string, turns: NeedTurn[]): LlmMessage[] {
  const gecmis = turns
    .map((t, i) => `Soru ${i + 1}: ${t.question}\nCevap ${i + 1}: ${t.answer}`)
    .join('\n\n');
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Kurumun ilk metni:\n"""${rawText}"""\n\n${gecmis ? `Şimdiye kadarki sorular ve cevaplar:\n${gecmis}\n\n` : ''}Sorulan soru sayısı: ${turns.length}. Taslak kartı güncelle; gerekiyorsa tek bir sonraki soruyu ver.`,
    },
  ];
}

/** Eksik alanları modelden bağımsız hesaplar; model "bitti" dese bile zorunlu alan boşsa bitmez. */
export function missingRequired(draft: DraftNeedCard): string[] {
  return REQUIRED.filter((k) => {
    const v = draft[k];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  });
}

export async function runNeedStructurer(
  llm: LlmProvider,
  input: { rawText: string; turns: NeedTurn[] },
): Promise<{
  step: NeedStructurerStep;
  usage: Awaited<ReturnType<LlmProvider['structured']>>['usage'];
}> {
  const { value, usage } = await llm.structured(
    buildMessages(input.rawText, input.turns),
    NeedStructurerStep,
    {
      schemaName: 'need_step',
    },
  );
  const missing = missingRequired(value.draft);
  const soruHakkiBitti = input.turns.length >= MAX_QUESTIONS;
  const done = missing.length === 0 || soruHakkiBitti;
  return {
    step: {
      ...value,
      missing,
      done,
      nextQuestion: done ? null : value.nextQuestion,
    },
    usage,
  };
}

/** Onay anında taslak tam NeedCard olmalı; değilse hangi alanın eksik olduğu söylenir. */
export function finalizeNeedCard(draft: DraftNeedCard) {
  return NeedCard.safeParse(draft);
}
