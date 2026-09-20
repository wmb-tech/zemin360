import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import { cardClaims, evidenceSignals, evidenceSources, talents, users } from '@evidex/db';
import { runCardDrafter, type LlmProvider } from '@evidex/ai';
import type { GithubEvidence, LiveUrlEvidence } from '@evidex/evidence';
import { newRawToken } from '../auth/tokens';
import { assertPublicUrl } from '@evidex/evidence';
import { recordAgentRun } from '../agents/runs';
import { AppError } from '../lib/response';
import { isSilentCard } from '../network/service';

const MAX_REPOS = 20;

/**
 * ### Genç servisi — döngü adımı: doğrula (02)
 * GitHub App kurulumu → repolar kaynak olur → sinyal çıkarılır → ajan taslak iddialar yazar →
 * kişi iddiaları tek tek onaylar/düzeltir/siler → kartı onaylar. Onaylı iddialar yeniden
 * senkronda korunur; yalnız onaysız taslaklar yenilenir.
 * ⚠ Ham kod hiçbir yerde tutulmaz; evidence_signals yalnız makine sinyali (ADR-0003).
 */
/** Kaynak sinyallerindeki en yeni etkinlik tarihi (GitHub lastActivityAt, teslim lastCommitAt). Canlı URL tarih taşımaz. */
function sonEtkinlik(inputs: { signals: Record<string, unknown> }[]): Date | null {
  let en: Date | null = null;
  for (const i of inputs) {
    for (const k of ['lastActivityAt', 'lastCommitAt']) {
      const v = i.signals[k];
      if (typeof v !== 'string') continue;
      const d = new Date(v);
      if (!Number.isNaN(d.getTime()) && (!en || d > en)) en = d;
    }
  }
  return en;
}

export function createTalentService(
  db: Db,
  llm: LlmProvider,
  github: GithubEvidence | null,
  liveUrl: LiveUrlEvidence,
) {
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

  /**
   * Tüm doğrulanmış kaynakların son sinyallerinden kartı yeniden taslakla. Onaylı iddialar
   * korunur; yalnız onaysız taslaklar yenilenir. İddia seviyesi: tüm kaynakları doğrulanmışsa
   * verified, değilse declared.
   */
  async function redraft(talentId: string, login: string) {
    const kaynaklar = await db
      .select()
      .from(evidenceSources)
      .where(eq(evidenceSources.talentId, talentId));
    const inputs: { ref: string; signals: Record<string, unknown> }[] = [];
    for (const k of kaynaklar) {
      const [son] = await db
        .select({ signals: evidenceSignals.signals })
        .from(evidenceSignals)
        .where(eq(evidenceSignals.sourceId, k.id))
        .orderBy(desc(evidenceSignals.extractedAt))
        .limit(1);
      if (son)
        inputs.push({
          ref: k.ref,
          signals: { kind: k.kind, ownershipVerified: k.ownershipVerified, ...son.signals },
        });
    }
    if (inputs.length === 0) return;
    const { draft, usage } = await runCardDrafter(llm, login, inputs);
    await recordAgentRun(db, {
      agent: 'card_drafter',
      subjectType: 'talent',
      subjectId: talentId,
      inputSummary: { sources: inputs.length },
      outputSummary: { claims: draft.claims.length },
      usage,
    });
    await db
      .delete(cardClaims)
      .where(and(eq(cardClaims.talentId, talentId), eq(cardClaims.approved, false)));
    const refToSource = new Map(kaynaklar.map((k) => [k.ref, k]));
    if (draft.claims.length) {
      await db.insert(cardClaims).values(
        draft.claims.map((c) => {
          const srcs = c.sourceRefs
            .map((r) => refToSource.get(r))
            .filter((x): x is NonNullable<typeof x> => Boolean(x));
          return {
            talentId,
            text: c.text,
            draftText: c.text,
            level: srcs.every((x) => x.ownershipVerified)
              ? ('verified' as const)
              : ('declared' as const),
            sourceIds: srcs.map((x) => x.id),
            periodStart: c.periodStart,
            periodEnd: c.periodEnd,
            approved: false,
          };
        }),
      );
    }
    const [t] = await db.select().from(talents).where(eq(talents.id, talentId)).limit(1);
    await db
      .update(talents)
      .set({
        headline: t?.headline ?? draft.headline,
        story: t?.story ?? draft.story,
        // Sessiz kart ölçütü (canlı tut 04): taslağın yazıldığı an değil, kanıttaki son etkinlik.
        lastSignalAt: sonEtkinlik(inputs) ?? t?.lastSignalAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(talents.id, talentId));
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
          // Canlı tut (04): kaynak var ama uzun süredir etkinlik yok → genç uyarı görür
          silent: sources.length > 0 && isSilentCard(talent.lastSignalAt),
          publicSlug: talent.publicSlug,
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

      await redraft(talent.id, user.githubLogin);
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

    /**
     * Paylaşılabilir kart (keşfet 01): genç açar/kapatır. Slug rastgele, tahmin edilemez; kapatınca
     * eski link ölür (slug silinir), tekrar açınca yeni slug. Yalnız onaylı kart paylaşılır.
     */
    async setShare(userId: string, enabled: boolean) {
      const { talent } = await talentOf(userId);
      if (enabled && talent.cardStatus !== 'approved')
        throw new AppError('card_not_approved', 'Önce kartını onayla', 409);
      const publicSlug = enabled ? (talent.publicSlug ?? newRawToken(9)) : null;
      await db
        .update(talents)
        .set({ publicSlug, updatedAt: new Date() })
        .where(eq(talents.id, talent.id));
      return { publicSlug };
    },

    /** Herkese açık kart: oturum yok. Yalnız onaylı iddialar, e-posta/GitHub kimliği yok. */
    async publicCard(slug: string) {
      const [satir] = await db
        .select({ talent: talents, user: users })
        .from(talents)
        .innerJoin(users, eq(users.id, talents.userId))
        .where(and(eq(talents.publicSlug, slug), eq(talents.cardStatus, 'approved')))
        .limit(1);
      if (!satir) throw new AppError('not_found', 'Kart bulunamadı', 404);
      const claims = await db
        .select({
          id: cardClaims.id,
          text: cardClaims.text,
          level: cardClaims.level,
          periodStart: cardClaims.periodStart,
          periodEnd: cardClaims.periodEnd,
          sourceCount: sql<number>`cardinality(${cardClaims.sourceIds})`,
        })
        .from(cardClaims)
        .where(and(eq(cardClaims.talentId, satir.talent.id), eq(cardClaims.approved, true)))
        .orderBy(cardClaims.createdAt);
      const sources = await db
        .select({ kind: evidenceSources.kind, verified: evidenceSources.ownershipVerified })
        .from(evidenceSources)
        .where(eq(evidenceSources.talentId, satir.talent.id));
      return {
        name: satir.user.name,
        headline: satir.talent.headline,
        story: satir.talent.story,
        city: satir.talent.city,
        cardApprovedAt: satir.talent.cardApprovedAt,
        lastSignalAt: satir.talent.lastSignalAt,
        silent: isSilentCard(satir.talent.lastSignalAt),
        claims,
        sources,
      };
    },

    /** Canlı URL ekle: kaynak taslak olarak açılır, sahiplik token'ı döner; doğrulanana kadar beyan. */
    async addLiveUrl(userId: string, rawUrl: string) {
      const { talent } = await talentOf(userId);
      let url: string;
      try {
        url = assertPublicUrl(rawUrl).toString();
      } catch (e) {
        throw new AppError('invalid_url', e instanceof Error ? e.message : 'Geçersiz URL', 422);
      }
      const token = `evidex-${newRawToken(9)}`;
      const [kaynak] = await db
        .insert(evidenceSources)
        .values({
          talentId: talent.id,
          kind: 'live_url',
          ref: url,
          ownershipVerified: false,
          verifyToken: token,
        })
        .onConflictDoNothing()
        .returning();
      if (!kaynak) throw new AppError('already_added', 'Bu adres zaten ekli', 409);
      return kaynak;
    },

    async verifyLiveUrl(userId: string, sourceId: string) {
      const { talent, user } = await talentOf(userId);
      const [kaynak] = await db
        .select()
        .from(evidenceSources)
        .where(
          and(
            eq(evidenceSources.id, sourceId),
            eq(evidenceSources.talentId, talent.id),
            eq(evidenceSources.kind, 'live_url'),
          ),
        )
        .limit(1);
      if (!kaynak || !kaynak.verifyToken) throw new AppError('not_found', 'Kaynak bulunamadı', 404);
      const sonuc = await liveUrl.verifyOwnership(kaynak.ref, kaynak.verifyToken);
      if (!sonuc.verified) {
        throw new AppError(
          'not_verified',
          'Sahiplik doğrulanamadı: meta etiketi ya da well-known dosyası bulunamadı',
          422,
          sonuc,
        );
      }
      const signals = await liveUrl.extract(kaynak.ref);
      await db
        .insert(evidenceSignals)
        .values({ sourceId: kaynak.id, signals: signals as Record<string, unknown> });
      await db
        .update(evidenceSources)
        .set({
          ownershipVerified: true,
          ownershipMethod: sonuc.method,
          lastScannedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(evidenceSources.id, kaynak.id));
      await redraft(talent.id, user.githubLogin ?? user.name);
      return this.card(userId);
    },

    async removeSource(userId: string, sourceId: string) {
      const { talent } = await talentOf(userId);
      const silinen = await db
        .delete(evidenceSources)
        .where(and(eq(evidenceSources.id, sourceId), eq(evidenceSources.talentId, talent.id)))
        .returning({ id: evidenceSources.id });
      if (!silinen.length) throw new AppError('not_found', 'Kaynak bulunamadı', 404);
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
