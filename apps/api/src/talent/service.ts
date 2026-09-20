import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import { cardClaims, evidenceSignals, evidenceSources, talents, users } from '@evidex/db';
import { runCardDrafter, type LlmProvider } from '@evidex/ai';
import type { GithubEvidence } from '@evidex/evidence';
import { recordAgentRun } from '../agents/runs';
import { AppError } from '../lib/response';

const MAX_REPOS = 20;

/**
 * ### Genç servisi — döngü adımı: doğrula (02)
 * GitHub App kurulumu → repolar kaynak olur → sinyal çıkarılır → ajan taslak iddialar yazar →
 * kişi iddiaları tek tek onaylar/düzeltir/siler → kartı onaylar. Onaylı iddialar yeniden
 * senkronda korunur; yalnız onaysız taslaklar yenilenir.
 * ⚠ Ham kod hiçbir yerde tutulmaz; evidence_signals yalnız makine sinyali (ADR-0003).
 */
export function createTalentService(db: Db, llm: LlmProvider, github: GithubEvidence | null) {
  async function talentOf(userId: string) {
    const [satir] = await db
      .select({ talent: talents, user: users })
      .from(talents)
      .innerJoin(users, eq(users.id, talents.userId))
      .where(eq(talents.userId, userId))
      .limit(1);
    if (!satir) throw new AppError('no_talent', 'Bu hesabın kişi kartı yok', 403);
    return satir;
  }

  return {
    async card(userId: string) {
      const { talent, user } = await talentOf(userId);
      const sources = await db
        .select()
        .from(evidenceSources)
        .where(eq(evidenceSources.talentId, talent.id));
      const claims = await db
        .select()
        .from(cardClaims)
        .where(eq(cardClaims.talentId, talent.id))
        .orderBy(cardClaims.createdAt);
      return {
        talent: {
          id: talent.id,
          headline: talent.headline,
          story: talent.story,
          cardStatus: talent.cardStatus,
          githubConnected: Boolean(talent.githubInstallationId),
          lastSignalAt: talent.lastSignalAt,
        },
        user: { name: user.name, githubLogin: user.githubLogin },
        sources,
        claims,
      };
    },

    /**
     * Kurulumu kaydetmeden önce sahibini doğrular: installation_id callback'te kullanıcı
     * kontrolündedir; başkasının kurulumunu kendi kartına bağlamak (IDOR) 403 ile düşer.
     */
    async saveInstallation(userId: string, installationId: string) {
      if (!github) throw new AppError('not_configured', 'GitHub App yapılandırılmamış', 503);
      const { talent, user } = await talentOf(userId);
      const sahip = await github.installationOwner(installationId);
      if (!sahip || !user.githubId || sahip.id !== user.githubId) {
        throw new AppError(
          'installation_owner_mismatch',
          'Bu kurulum bu GitHub hesabına ait değil',
          403,
        );
      }
      await db
        .update(talents)
        .set({ githubInstallationId: installationId, updatedAt: new Date() })
        .where(eq(talents.id, talent.id));
    },

    /** Kurulumdaki repoları oku, sinyal çıkar, taslak iddiaları yenile. */
    async syncGithub(userId: string) {
      if (!github) throw new AppError('not_configured', 'GitHub App yapılandırılmamış', 503);
      const { talent, user } = await talentOf(userId);
      if (!talent.githubInstallationId)
        throw new AppError('github_not_connected', 'Önce GitHub bağlantısı kur', 409);
      if (!user.githubLogin)
        throw new AppError('github_login_missing', 'GitHub kullanıcı adı yok', 409);

      const repos = (await github.listRepos(talent.githubInstallationId)).slice(0, MAX_REPOS);
      const repoInputs: { ref: string; signals: Record<string, unknown> }[] = [];

      for (const r of repos) {
        const [kaynak] = await db
          .insert(evidenceSources)
          .values({
            talentId: talent.id,
            kind: 'github_repo',
            ref: r.fullName,
            ownershipVerified: true,
            ownershipMethod: 'github_app',
            lastScannedAt: new Date(),
          })
          .onConflictDoNothing()
          .returning();
        const sourceId =
          kaynak?.id ??
          (
            await db
              .select({ id: evidenceSources.id })
              .from(evidenceSources)
              .where(
                and(eq(evidenceSources.talentId, talent.id), eq(evidenceSources.ref, r.fullName)),
              )
              .limit(1)
          )[0]!.id;

        const signals = await github.extract(
          talent.githubInstallationId,
          r.fullName,
          user.githubLogin,
        );
        await db
          .insert(evidenceSignals)
          .values({ sourceId, signals: signals as Record<string, unknown> });
        await db
          .update(evidenceSources)
          .set({ lastScannedAt: new Date() })
          .where(eq(evidenceSources.id, sourceId));
        repoInputs.push({ ref: r.fullName, signals: signals as Record<string, unknown> });
      }

      const { draft, usage } = await runCardDrafter(llm, user.githubLogin, repoInputs);
      await recordAgentRun(db, {
        agent: 'card_drafter',
        subjectType: 'talent',
        subjectId: talent.id,
        inputSummary: { repos: repoInputs.length },
        outputSummary: { claims: draft.claims.length },
        usage,
      });

      // Onaysız taslaklar yenilenir; kişinin onayladıkları korunur.
      await db
        .delete(cardClaims)
        .where(and(eq(cardClaims.talentId, talent.id), eq(cardClaims.approved, false)));
      const kaynaklar = await db
        .select({ id: evidenceSources.id, ref: evidenceSources.ref })
        .from(evidenceSources)
        .where(eq(evidenceSources.talentId, talent.id));
      const refToId = new Map(kaynaklar.map((k) => [k.ref, k.id]));
      if (draft.claims.length) {
        await db.insert(cardClaims).values(
          draft.claims.map((c) => ({
            talentId: talent.id,
            text: c.text,
            draftText: c.text,
            level: 'verified' as const, // GitHub App kaynağı: sahiplik doğrulanmış
            sourceIds: c.sourceRefs
              .map((s) => refToId.get(s))
              .filter((x): x is string => Boolean(x)),
            periodStart: c.periodStart,
            periodEnd: c.periodEnd,
            approved: false,
          })),
        );
      }
      await db
        .update(talents)
        .set({
          headline: talent.headline ?? draft.headline,
          story: talent.story ?? draft.story,
          lastSignalAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(talents.id, talent.id));
      return this.card(userId);
    },

    async updateClaim(
      userId: string,
      claimId: string,
      patch: { text?: string | undefined; approved?: boolean | undefined },
    ) {
      const { talent } = await talentOf(userId);
      const [guncel] = await db
        .update(cardClaims)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(cardClaims.id, claimId), eq(cardClaims.talentId, talent.id)))
        .returning();
      if (!guncel) throw new AppError('not_found', 'İddia bulunamadı', 404);
      return guncel;
    },

    async deleteClaim(userId: string, claimId: string) {
      const { talent } = await talentOf(userId);
      const silinen = await db
        .delete(cardClaims)
        .where(and(eq(cardClaims.id, claimId), eq(cardClaims.talentId, talent.id)))
        .returning({ id: cardClaims.id });
      if (!silinen.length) throw new AppError('not_found', 'İddia bulunamadı', 404);
    },

    async updateProfile(
      userId: string,
      patch: { headline?: string | undefined; story?: string | undefined },
    ) {
      const { talent } = await talentOf(userId);
      await db
        .update(talents)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(talents.id, talent.id));
      return this.card(userId);
    },

    /** Kart onayı: en az bir onaylı iddia şart; onaysız kart ağa girmez. */
    async approveCard(userId: string) {
      const { talent } = await talentOf(userId);
      const onayli = await db
        .select({ id: cardClaims.id })
        .from(cardClaims)
        .where(and(eq(cardClaims.talentId, talent.id), eq(cardClaims.approved, true)));
      if (onayli.length === 0)
        throw new AppError('no_approved_claims', 'Onaylı en az bir iddia gerekli', 422);
      await db
        .update(talents)
        .set({ cardStatus: 'approved', cardApprovedAt: new Date(), updatedAt: new Date() })
        .where(eq(talents.id, talent.id));
      return this.card(userId);
    },

    async sourceSignals(userId: string, sourceIds: string[]) {
      const { talent } = await talentOf(userId);
      if (!sourceIds.length) return [];
      return db
        .select({
          sourceId: evidenceSignals.sourceId,
          signals: evidenceSignals.signals,
          extractedAt: evidenceSignals.extractedAt,
        })
        .from(evidenceSignals)
        .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceSignals.sourceId))
        .where(
          and(
            eq(evidenceSources.talentId, talent.id),
            inArray(evidenceSignals.sourceId, sourceIds),
          ),
        );
    },
  };
}

export type TalentService = ReturnType<typeof createTalentService>;
