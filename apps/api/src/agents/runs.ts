import type { Db } from '@evidex/db';
import { agentRuns } from '@evidex/db';
import type { LlmUsage } from '@evidex/ai';

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
    })
    .returning({ id: agentRuns.id });
  return kayit!.id;
}
