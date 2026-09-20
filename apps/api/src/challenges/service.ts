import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import {
  cardClaims,
  challengeSubmissions,
  challenges,
  evidenceSignals,
  evidenceSources,
  needs,
  talents,
  users,
} from '@evidex/db';
import {
  runChallengeDesigner,
  runSubmissionEvaluator,
  weightedScore,
  type LlmProvider,
} from '@evidex/ai';
import type { PublicRepoEvidence } from '@evidex/evidence';
import { parseGithubRepoUrl } from '@evidex/evidence';
import type { NeedCard, SubmissionEvaluation } from '@evidex/shared';
import { recordAgentRun } from '../agents/runs';
import { AppError } from '../lib/response';

/**
 * ### Meydan okuma servisi — döngü adımı: keşfet (01)
 * İhtiyaç → ajan görev + rubrik (taslak) → operatör açar → gençler teslim eder → operatör
 * kapatıp değerlendirir → her teslim gencin kartına doğrulanmış kanıt (challenge_submission)
 * olarak döner; kurum ilk üçü görür.
 * ⚠ Görevi açmak/kapatmak/değerlendirmek insan eylemidir; ajan yalnız taslak ve puan üretir.
 */
export function createChallengeService(db: Db, llm: LlmProvider, publicRepo: PublicRepoEvidence) {
  async function talentOf(userId: string) {
    const [t] = await db.select().from(talents).where(eq(talents.userId, userId)).limit(1);
    if (!t) throw new AppError('no_talent', 'Bu hesabın kişi kartı yok', 403);
    return t;
  }

  return {
    async designFromNeed(operatorId: string, needId: string) {
      const [need] = await db.select().from(needs).where(eq(needs.id, needId)).limit(1);
      if (!need) throw new AppError('not_found', 'İhtiyaç bulunamadı', 404);
      if (need.cardStatus !== 'approved')
        throw new AppError('need_not_approved', 'İhtiyaç kartı onaylı değil', 409);
      const { design, usage } = await runChallengeDesigner(llm, need.card as NeedCard);
      const [c] = await db
        .insert(challenges)
        .values({
          needId,
          organizationId: need.organizationId,
          title: design.title,
          brief: design.brief,
          rubric: design.rubric,
          durationHours: design.durationHours,
          createdBy: operatorId,
        })
        .returning();
      await recordAgentRun(db, {
        agent: 'challenge_designer',
        subjectType: 'challenge',
        subjectId: c!.id,
        outputSummary: { rubric: design.rubric.length, hours: design.durationHours },
        usage,
      });
      return c!;
    },

    async list() {
      return db.select().from(challenges).orderBy(desc(challenges.createdAt));
    },

    async get(id: string) {
      const [c] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
      if (!c) throw new AppError('not_found', 'Meydan okuma bulunamadı', 404);
      return c;
    },

    async update(
      id: string,
      patch: {
        title?: string | undefined;
        brief?: string | undefined;
        durationHours?: number | undefined;
      },
    ) {
      const c = await this.get(id);
      if (c.status !== 'draft') throw new AppError('not_draft', 'Yalnız taslak düzenlenir', 409);
      const [g] = await db
        .update(challenges)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(challenges.id, id))
        .returning();
      return g!;
    },

    async open(id: string) {
      const c = await this.get(id);
      if (c.status !== 'draft') throw new AppError('not_draft', 'Yalnız taslak açılır', 409);
      const now = new Date();
      const [g] = await db
        .update(challenges)
        .set({
          status: 'open',
          opensAt: now,
          closesAt: new Date(now.getTime() + c.durationHours * 3600_000),
          updatedAt: now,
        })
        .where(eq(challenges.id, id))
        .returning();
      return g!;
    },

    async close(id: string) {
      const c = await this.get(id);
      if (c.status !== 'open') throw new AppError('not_open', 'Açık değil', 409);
      const [g] = await db
        .update(challenges)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(challenges.id, id))
        .returning();
      return g!;
    },

    /** Gençlerin gördüğü açık görevler + kendi teslim durumu. */
    async openForTalent(userId: string) {
      const t = await talentOf(userId);
      const acik = await db
        .select()
        .from(challenges)
        .where(eq(challenges.status, 'open'))
        .orderBy(desc(challenges.opensAt));
      const teslimler = await db
        .select()
        .from(challengeSubmissions)
        .where(eq(challengeSubmissions.talentId, t.id));
      return acik.map((c) => ({
        ...c,
        mySubmission: teslimler.find((s) => s.challengeId === c.id) ?? null,
      }));
    },

    async submit(userId: string, challengeId: string, repoUrl: string, note: string | null) {
      const t = await talentOf(userId);
      const c = await this.get(challengeId);
      if (c.status !== 'open')
        throw new AppError('not_open', 'Bu meydan okuma teslime kapalı', 409);
      if (c.closesAt && c.closesAt < new Date())
        throw new AppError('deadline_passed', 'Süre doldu', 409);
      if (!parseGithubRepoUrl(repoUrl))
        throw new AppError('invalid_repo', 'Teslim bir GitHub repo adresi olmalı', 422);
      const [s] = await db
        .insert(challengeSubmissions)
        .values({ challengeId, talentId: t.id, repoUrl, note })
        .onConflictDoUpdate({
          target: [challengeSubmissions.challengeId, challengeSubmissions.talentId],
          set: {
            repoUrl,
            note,
            submittedAt: new Date(),
            evaluation: null,
            evaluatedAt: null,
            rank: null,
          },
        })
        .returning();
      return s!;
    },

    /** Kapalı görevi değerlendir: her teslim → sinyal → ajan → puan/bant → kanıt. */
    async evaluate(id: string) {
      const c = await this.get(id);
      if (c.status !== 'closed') throw new AppError('not_closed', 'Önce kapat', 409);
      const teslimler = await db
        .select()
        .from(challengeSubmissions)
        .where(eq(challengeSubmissions.challengeId, id));
      const puanli: { id: string; talentId: string; score: number }[] = [];

      for (const s of teslimler) {
        let signals: Record<string, unknown>;
        try {
          signals = (await publicRepo.extract(s.repoUrl)) as unknown as Record<string, unknown>;
        } catch (e) {
          signals = { reachable: false, error: e instanceof Error ? e.message : 'okunamadı' };
        }
        const { evaluation, usage } = await runSubmissionEvaluator(llm, c, {
          repoUrl: s.repoUrl,
          note: s.note,
          signals,
        });
        await recordAgentRun(db, {
          agent: 'submission_evaluator',
          subjectType: 'challenge_submission',
          subjectId: s.id,
          outputSummary: { band: evaluation.band },
          usage,
        });
        const score = weightedScore(c.rubric, evaluation.scores);
        await db
          .update(challengeSubmissions)
          .set({ evaluation: { ...evaluation, score }, evaluatedAt: new Date() })
          .where(eq(challengeSubmissions.id, s.id));
        puanli.push({ id: s.id, talentId: s.talentId, score });

        // Kanıt: teslim platform içinde oldu → doğrulanmış kaynak; README metni saklanmaz.
        // README ajana gitti; saklanan sinyalde yok (ADR-0003).
        const saklanan = Object.fromEntries(
          Object.entries(signals).filter(([k]) => k !== 'readme'),
        );
        const [kaynak] = await db
          .insert(evidenceSources)
          .values({
            talentId: s.talentId,
            kind: 'challenge_submission',
            ref: s.repoUrl,
            ownershipVerified: true,
            ownershipMethod: 'platform',
            lastScannedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [evidenceSources.talentId, evidenceSources.kind, evidenceSources.ref],
            set: { lastScannedAt: new Date() },
          })
          .returning();
        await db.insert(evidenceSignals).values({
          sourceId: kaynak!.id,
          signals: { ...saklanan, challenge: c.title, band: evaluation.band, score },
        });
        await db.insert(cardClaims).values({
          talentId: s.talentId,
          text: evaluation.evidenceClaim,
          draftText: evaluation.evidenceClaim,
          level: 'verified',
          sourceIds: [kaynak!.id],
          periodStart: c.opensAt ? c.opensAt.toISOString().slice(0, 10) : null,
          periodEnd: new Date().toISOString().slice(0, 10),
          approved: false,
        });
        await db
          .update(talents)
          .set({ lastSignalAt: new Date() })
          .where(eq(talents.id, s.talentId));
      }

      puanli.sort((a, b) => b.score - a.score);
      for (const [i, p] of puanli.entries()) {
        await db
          .update(challengeSubmissions)
          .set({ rank: i + 1 })
          .where(eq(challengeSubmissions.id, p.id));
      }
      const [g] = await db
        .update(challenges)
        .set({ status: 'evaluated', evaluatedAt: new Date(), updatedAt: new Date() })
        .where(eq(challenges.id, id))
        .returning();
      return { challenge: g!, evaluated: puanli.length };
    },

    /** Sonuçlar: operatör tümünü, kurum ilk üçü (ilk adla) görür. */
    async results(id: string, opts: { limit?: number; firstNameOnly?: boolean } = {}) {
      const c = await this.get(id);
      const satirlar = await db
        .select({
          submissionId: challengeSubmissions.id,
          talentId: challengeSubmissions.talentId,
          rank: challengeSubmissions.rank,
          repoUrl: challengeSubmissions.repoUrl,
          evaluation: challengeSubmissions.evaluation,
          name: users.name,
          headline: talents.headline,
        })
        .from(challengeSubmissions)
        .innerJoin(talents, eq(talents.id, challengeSubmissions.talentId))
        .innerJoin(users, eq(users.id, talents.userId))
        .where(eq(challengeSubmissions.challengeId, id))
        .orderBy(challengeSubmissions.rank);
      const liste = (opts.limit ? satirlar.slice(0, opts.limit) : satirlar).map((s) => ({
        ...s,
        name: opts.firstNameOnly ? (s.name.split(' ')[0] ?? s.name) : s.name,
        evaluation: s.evaluation as (SubmissionEvaluation & { score: number }) | null,
      }));
      return { challenge: c, submissions: liste };
    },

    async forNeed(needId: string) {
      return db
        .select()
        .from(challenges)
        .where(and(eq(challenges.needId, needId)))
        .orderBy(desc(challenges.createdAt));
    },
  };
}

export type ChallengeService = ReturnType<typeof createChallengeService>;
