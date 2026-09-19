import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import { needs, organizationMembers } from '@evidex/db';
import {
  finalizeNeedCard,
  runNeedStructurer,
  type DraftNeedCard,
  type LlmProvider,
} from '@evidex/ai';
import type { NeedCardEdits } from '@evidex/shared';
import { recordAgentRun } from '../agents/runs';
import { AppError } from '../lib/response';
import type { MatchingService } from '../matching/service';

/**
 * ### İhtiyaç servisi — döngü adımı: tanımla (05)
 * Kurum ham metni yazar → ajan taslak + soru → cevap → … → kurum onaylar.
 * ⚠ Onay yalnız kurumun; ajan `done` dese de kart onaysız `draft` kalır.
 */
export function createNeedService(db: Db, llm: LlmProvider, matching: MatchingService) {
  async function organizationOf(userId: string) {
    const [uye] = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1);
    if (!uye) throw new AppError('no_organization', 'Bu hesabın kurumu yok', 403);
    return uye.organizationId;
  }

  async function ownedNeed(userId: string, needId: string) {
    const orgId = await organizationOf(userId);
    const [kayit] = await db
      .select()
      .from(needs)
      .where(and(eq(needs.id, needId), eq(needs.organizationId, orgId)))
      .limit(1);
    // Başka kurumun ihtiyacı: 404, "var ama yasak" bilgisi bile sızmaz.
    if (!kayit) throw new AppError('not_found', 'İhtiyaç bulunamadı', 404);
    return kayit;
  }

  async function step(
    needId: string,
    rawText: string,
    turns: { question: string; answer: string }[],
  ) {
    const { step, usage } = await runNeedStructurer(llm, { rawText, turns });
    await recordAgentRun(db, {
      agent: 'need_structurer',
      subjectType: 'need',
      subjectId: needId,
      inputSummary: { turnCount: turns.length },
      outputSummary: { done: step.done, missing: step.missing },
      usage,
    });
    const [guncel] = await db
      .update(needs)
      .set({
        card: step.draft,
        turns,
        pendingQuestion: step.nextQuestion,
        missingFields: step.missing,
        updatedAt: new Date(),
      })
      .where(eq(needs.id, needId))
      .returning();
    return guncel!;
  }

  return {
    async list(userId: string) {
      const orgId = await organizationOf(userId);
      return db
        .select()
        .from(needs)
        .where(eq(needs.organizationId, orgId))
        .orderBy(desc(needs.createdAt));
    },

    async get(userId: string, needId: string) {
      return ownedNeed(userId, needId);
    },

    async create(userId: string, rawText: string) {
      const orgId = await organizationOf(userId);
      const [yeni] = await db.insert(needs).values({ organizationId: orgId, rawText }).returning();
      return step(yeni!.id, rawText, []);
    },

    async answer(userId: string, needId: string, answer: string) {
      const kayit = await ownedNeed(userId, needId);
      if (kayit.cardStatus === 'approved')
        throw new AppError('already_approved', 'Kart onaylanmış', 409);
      if (!kayit.pendingQuestion) throw new AppError('no_question', 'Bekleyen soru yok', 409);
      const turns = [...kayit.turns, { question: kayit.pendingQuestion.text, answer }];
      return step(needId, kayit.rawText, turns);
    },

    async approve(userId: string, needId: string, edits?: NeedCardEdits) {
      const kayit = await ownedNeed(userId, needId);
      const taslak = { ...(kayit.card as DraftNeedCard), ...(edits ?? {}) } as DraftNeedCard;
      const sonuc = finalizeNeedCard(taslak);
      if (!sonuc.success) {
        throw new AppError('incomplete_card', 'Kart onay için eksik', 422, {
          fields: sonuc.error.issues.map((i: { path: PropertyKey[] }) => i.path.join('.')),
        });
      }
      const [onayli] = await db
        .update(needs)
        .set({
          card: sonuc.data,
          cardStatus: 'approved',
          cardApprovedAt: new Date(),
          pendingQuestion: null,
          missingFields: [],
          updatedAt: new Date(),
        })
        .where(eq(needs.id, needId))
        .returning();
      // Onay eşleştirmeyi tetikler; kısa liste operatör kuyruğuna düşer (kurum henüz görmez).
      await matching.runForNeed(needId);
      return onayli!;
    },
  };
}
