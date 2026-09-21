import type { Db } from '@evidex/db';
import { agentRuns } from '@evidex/db';
import type { LlmUsage } from '@evidex/ai';

/**
 * Model liste fiyatları (USD / 1M token), Eylül 2026. Fatura değil TAHMİN: sağlayıcı fiyatı
 * değiştirirse burası güncellenir; hesap ölçüm panelinde "tahmini" olarak gösterilir.
 */
const FIYAT: Record<string, { in: number; out: number }> = {
  'gemini-2.5-pro': { in: 1.25, out: 10 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5 },
  'gemini-2.0-flash': { in: 0.1, out: 0.4 },
};

function maliyet(usage: LlmUsage): string | null {
  const f = FIYAT[usage.model];
  if (!f) return null;
  return ((usage.inputTokens * f.in + usage.outputTokens * f.out) / 1_000_000).toFixed(6);
}

/**
 * Her ajan çağrısı kaydedilir (ADR-0002): ölçüm paneli "AI süs değil" iddiasını buradan
 * kanıtlar. Sonraki insan eylemi (`humanOutcome`) ayrıca güncellenir.
 */
export async function recordAgentRun(
  db: Db,
  run: {
    agent: string;
    subjectType: string;
    subjectId: string;
    inputSummary?: Record<string, unknown>;
    outputSummary?: Record<string, unknown>;
    usage: LlmUsage;
  },
) {
  const [kayit] = await db
    .insert(agentRuns)
    .values({
      agent: run.agent,
      subjectType: run.subjectType,
      subjectId: run.subjectId,
      inputSummary: run.inputSummary ?? null,
      outputSummary: run.outputSummary ?? null,
      provider: run.usage.provider,
      model: run.usage.model,
      durationMs: run.usage.durationMs,
      inputTokens: run.usage.inputTokens,
      outputTokens: run.usage.outputTokens,
      costUsd: maliyet(run.usage),
    })
    .returning({ id: agentRuns.id });
  return kayit!.id;
}
