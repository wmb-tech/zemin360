import { ChallengeDesign, SubmissionEvaluation, type NeedCard } from '@evidex/shared';
import type { LlmMessage, LlmProvider } from '../provider';

/**
 * ### challenge_designer — döngü adımı: keşfet (01)
 * Onaylı ihtiyaç kartından 24–48 saatlik, gerçekçi, değerlendirilebilir bir görev ve rubrik
 * üretir. Kanıtı olmayan genç bu görevi teslim ederek kartına doğrulanmış kanıt kazanır.
 * AI kullanmak serbesttir — ölçülen şey teslimattır. ⚠ Görev "gerçek işi bedavaya yaptırma"
 * olmamalı: ihtiyacın küçük, temsilî bir dilimi; kurumun gerçek verisi/sırrı gerekmez.
 */
const DESIGN_SYSTEM = `Sen GİRVAK'ın meydan okuma tasarımcısısın. Bir ihtiyaç kartı alırsın; ondan gençlerin
24 ya da 48 saatte teslim edebileceği küçük, temsilî bir görev ve rubrik üretirsin. Kurallar:
- Görev, ihtiyacın çekirdek becerisini ölçen KÜÇÜK bir dilim olsun; kurumun gerçek işini bedavaya
  yaptırma. Kurumun gizli verisi ya da erişimi gerekmesin; herkese açık/örnek veri kullanılsın.
- Teslim biçimi: bir GitHub reposu (kod) ya da herkese açık bir link (tasarım/içerik). Görev metni
  ne teslim edileceğini, nasıl çalıştırılacağını ve neyin kapsam dışı olduğunu söylesin.
- Yapay zekâ araçları kullanmak serbest; bunu açıkça yaz. Ölçülen şey çalışan teslimattır.
- Rubrik 3–6 ölçüt; her ölçüt gözlemlenebilir olsun ("çalışıyor mu", "istenen çıktı var mı",
  "okunabilir mi", "kararlar açıklanmış mı"). Ağırlık 1–5.
- Süre: net ve kapsamlı işler 48, küçükler 24 saat.
- Türkçe, sade; başlık 5–12 kelime. Görev metni DÜZ METİN olsun: markdown yok (yıldız, diyez,
  ters tırnak kullanma); bölümleri satır başı ve "Başlık:" ile ayır, maddeleri "- " ile yaz.`;

export function buildDesignMessages(need: NeedCard): LlmMessage[] {
  return [
    { role: 'system', content: DESIGN_SYSTEM },
    {
      role: 'user',
      content: `İHTİYAÇ KARTI:\n${JSON.stringify(need, null, 1)}\n\nGörev ve rubriği üret.`,
    },
  ];
}

export async function runChallengeDesigner(llm: LlmProvider, need: NeedCard) {
  const { value, usage } = await llm.structured(buildDesignMessages(need), ChallengeDesign, {
    schemaName: 'challenge_design',
    maxTokens: 3000,
  });
  return { design: value, usage };
}

/**
 * ### submission_evaluator
 * Görev + rubrik + teslimin makine sinyalleri (README özeti, dosya ağacı, diller, çalışma
 * talimatı var mı) → rubrik puanları, bant, güçlü/eksik, karta girecek tek cümle.
 * ⚠ Kod indirilip saklanmaz; ajana yalnız sinyal ve README gider, çıktı yalnız değerlendirme.
 */
export interface SubmissionInput {
  repoUrl: string;
  note: string | null;
  signals: Record<string, unknown>; // languages, fileTree (kısaltılmış), readme (≤4000 kr), hasTests, lastCommitAt...
}

const EVAL_SYSTEM = `Sen GİRVAK'ın teslim değerlendiricisisin. Bir görev, rubrik ve teslimin sinyallerini alırsın.
Kurallar:
- Her rubrik ölçütüne 0–5 puan ve tek cümle gerekçe. Gözlemleyemediğin şeye puan verme; "sinyalde
  yok" de ve düşük puan ver.
- Bant: strong (ölçütlerin çoğu 4–5, çalışıyor), solid (çalışıyor, eksikler küçük), partial
  (kısmen), incomplete (çalışmıyor/teslim boş).
- strengths/gaps somut ve kısa.
- evidenceClaim: kişinin kartına girecek TEK cümle; görev adını, ne teslim edildiğini ve bandı
  içersin. Örn: "GİRVAK meydan okuması 'Kafe için sipariş ekranı': 48 saatte çalışan React Native
  teslimi, değerlendirme: solid."
- Türkçe.`;

export function buildEvalMessages(
  challenge: { title: string; brief: string; rubric: unknown },
  sub: SubmissionInput,
): LlmMessage[] {
  return [
    { role: 'system', content: EVAL_SYSTEM },
    {
      role: 'user',
      content: `GÖREV: ${challenge.title}\n${challenge.brief}\n\nRUBRİK:\n${JSON.stringify(challenge.rubric, null, 1)}\n\nTESLİM: ${sub.repoUrl}\nNot: ${sub.note ?? '-'}\nSİNYALLER:\n${JSON.stringify(sub.signals, null, 1)}\n\nDeğerlendir.`,
    },
  ];
}

export async function runSubmissionEvaluator(
  llm: LlmProvider,
  challenge: { title: string; brief: string; rubric: unknown },
  sub: SubmissionInput,
) {
  const { value, usage } = await llm.structured(
    buildEvalMessages(challenge, sub),
    SubmissionEvaluation,
    {
      schemaName: 'submission_evaluation',
      maxTokens: 2000,
    },
  );
  return { evaluation: value, usage };
}

/** Sıralama için ağırlıklı puan (0–100). Kart/kurum yüzünde bant gösterilir, sayı yalnız sıralama içindir. */
export function weightedScore(
  rubric: { name: string; weight: number }[],
  scores: { name: string; score: number }[],
) {
  const toplamAgirlik = rubric.reduce((a, r) => a + r.weight, 0) || 1;
  const puan = rubric.reduce(
    (a, r) => a + r.weight * (scores.find((s) => s.name === r.name)?.score ?? 0),
    0,
  );
  return Math.round((puan / (toplamAgirlik * 5)) * 100);
}
