import { and, desc, eq, inArray, like, notLike } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import {
  organizationMembers,
  approvalQueue,
  cardClaims,
  matches,
  needs,
  organizations,
  talents,
  users,
} from '@evidex/db';
import { runIntroducer, runMatcher, type CandidateCard, type LlmProvider } from '@evidex/ai';
import { TalentPreferences, type MatchReasoning, type NeedCard } from '@evidex/shared';
import { recordAgentRun } from '../agents/runs';
import { skillsForTalent } from '../talent/skills';
import { AppError } from '../lib/response';
import { DEMO_DOMAIN } from '../demo/network';
import { notifyIntroduction } from '../introductions/notifications';
import type { EmailSender } from '../lib/email';

const MAX_CANDIDATES = 15;

/**
 * ### Eşleştirme servisi — döngü adımı: eşleştir (03)
 * Onaylı ihtiyaç → onaylı kartlar arasından ön eleme → tek ajan çağrısı → sıralı gerekçeli
 * liste → operatörün onay kuyruğuna "kısa listeyi yayınla" önerisi (ADR-0004).
 * ⚠ Kurum, operatör onaylayana kadar hiçbir adayı görmez (KARAR-09).
 */
export function createMatchingService(
  db: Db,
  llm: LlmProvider,
  notifications?: { email: EmailSender; webOrigin: string },
) {
  async function loadCandidates(need: NeedCard, demoKurum: boolean): Promise<CandidateCard[]> {
    const satirlar = await db
      .select({
        talentId: talents.id,
        name: users.name,
        headline: talents.headline,
        story: talents.story,
        city: talents.city,
        preferences: talents.preferences,
      })
      .from(talents)
      .innerJoin(users, eq(users.id, talents.userId))
      .where(
        // Gerçek bir kurumun ihtiyacına kurgusal demo genci aday gösterilmez (kurum var olmayan
        // birini tanımak ister). Demo kurumu gerçek gençleri de görebilir: sunumda gerçek kart.
        demoKurum
          ? eq(talents.cardStatus, 'approved')
          : and(eq(talents.cardStatus, 'approved'), notLike(users.email, `%${DEMO_DOMAIN}`)),
      );
    const eligible = satirlar.filter((candidate) => {
      const parsed = TalentPreferences.safeParse(candidate.preferences);
      const preferences = parsed.success ? parsed.data : TalentPreferences.parse({});
      return (
        preferences.availability !== 'unavailable' &&
        (preferences.collaborationTypes.length === 0 ||
          preferences.collaborationTypes.includes(need.collaborationType)) &&
        (preferences.workModes.length === 0 || preferences.workModes.includes(need.workMode)) &&
        (preferences.maxDurationWeeks === null ||
          need.durationWeeks === null ||
          need.durationWeeks <= preferences.maxDurationWeeks)
      );
    });
    if (eligible.length === 0) return [];

    const iddialar = await db
      .select()
      .from(cardClaims)
      .where(
        and(
          inArray(
            cardClaims.talentId,
            eligible.map((s) => s.talentId),
          ),
          eq(cardClaims.approved, true),
        ),
      );

    const yetkinlikler = new Map<string, CandidateCard['skills']>();
    for (const s of eligible) yetkinlikler.set(s.talentId, await skillsForTalent(db, s.talentId));
    const kartlar: CandidateCard[] = eligible.map((s) => ({
      ...s,
      skills: yetkinlikler.get(s.talentId) ?? [],
      claims: iddialar
        .filter((i) => i.talentId === s.talentId)
        .map((i) => ({
          id: i.id,
          text: i.text,
          level: i.level,
          periodStart: i.periodStart,
          periodEnd: i.periodEnd,
        })),
    }));

    // Ön eleme: ucuz anahtar kelime örtüşmesi. Aday az ise hepsi gider; ajan zaten "weak" der.
    if (kartlar.length <= MAX_CANDIDATES) return kartlar;
    const anahtarlar = [...need.requiredSkills, ...need.niceToHaveSkills].map((k) =>
      k.toLowerCase(),
    );
    const puanla = (k: CandidateCard) => {
      const metin = [k.headline, k.story, ...k.claims.map((c) => c.text)].join(' ').toLowerCase();
      return anahtarlar.filter((a) => metin.includes(a)).length;
    };
    return kartlar
      .map((k) => ({ k, p: puanla(k) }))
      .sort((a, b) => b.p - a.p)
      .slice(0, MAX_CANDIDATES)
      .map((x) => x.k);
  }

  return {
    async runForNeed(needId: string) {
      const [need] = await db.select().from(needs).where(eq(needs.id, needId)).limit(1);
      if (!need) throw new AppError('not_found', 'İhtiyaç bulunamadı', 404);
      if (need.cardStatus !== 'approved')
        throw new AppError('need_not_approved', 'İhtiyaç kartı onaylı değil', 409);
      const kart = need.card as NeedCard;

      const [demoUye] = await db
        .select({ id: users.id })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        .where(
          and(
            eq(organizationMembers.organizationId, need.organizationId),
            like(users.email, `%${DEMO_DOMAIN}`),
          ),
        )
        .limit(1);
      const adaylar = await loadCandidates(kart, Boolean(demoUye));
      const [kurum] = await db
        .select({ city: organizations.city })
        .from(organizations)
        .where(eq(organizations.id, need.organizationId))
        .limit(1);
      const { results, usage } = await runMatcher(llm, kart, adaylar, kurum?.city ?? null);
      for (const result of results) {
        const preferences = adaylar.find(
          (candidate) => candidate.talentId === result.talentId,
        )?.preferences;
        if (preferences?.weeklyHours)
          result.gaps.push(
            `Kişi haftada ${preferences.weeklyHours} saat ayırabileceğini belirtti; ihtiyaç takvimi görüşmede netleştirilmeli.`,
          );
        if (preferences?.maxDurationWeeks && kart.durationWeeks === null)
          result.gaps.push(
            `Kişinin süre sınırı ${preferences.maxDurationWeeks} hafta; ihtiyacın süresi henüz netleşmedi.`,
          );
        if (preferences?.availability === 'limited' && !preferences.weeklyHours)
          result.gaps.push('Kişinin zamanı sınırlı; haftalık uygunluğu görüşmede netleştirilmeli.');
      }
      if (usage) {
        await recordAgentRun(db, {
          agent: 'matcher',
          subjectType: 'need',
          subjectId: needId,
          inputSummary: { candidates: adaylar.length },
          outputSummary: {
            strong: results.filter((r) => r.strength === 'strong').length,
            total: results.length,
          },
          usage,
        });
      }

      return db.transaction(async (tx) => {
        await tx
          .select()
          .from(approvalQueue)
          .where(
            and(
              eq(approvalQueue.action, 'publish_shortlist'),
              eq(approvalQueue.subjectId, needId),
              eq(approvalQueue.status, 'proposed'),
            ),
          )
          .for('update');
        await tx.select().from(needs).where(eq(needs.id, needId)).for('update');
        // Active introductions and collaborations must survive a shortlist refresh.
        const preserved = await tx
          .select()
          .from(matches)
          .where(eq(matches.needId, needId))
          .for('update');
        const retained = preserved.filter(
          (match) => match.introducedAt || match.introductionRequestedAt,
        );
        const retainedTalentIds = new Set(retained.map((match) => match.talentId));
        const staleIds = preserved
          .filter((match) => !match.introducedAt && !match.introductionRequestedAt)
          .map((match) => match.id);
        if (staleIds.length) await tx.delete(matches).where(inArray(matches.id, staleIds));
        await tx
          .update(approvalQueue)
          .set({ status: 'rejected', decidedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(approvalQueue.action, 'publish_shortlist'),
              eq(approvalQueue.subjectId, needId),
              eq(approvalQueue.status, 'proposed'),
            ),
          );
        const freshResults = results.filter((result) => !retainedTalentIds.has(result.talentId));
        if (freshResults.length === 0) return { matches: retained, queued: false };

        await tx
          .update(needs)
          .set({ shortlistPublishedAt: null, updatedAt: new Date() })
          .where(eq(needs.id, needId));
        const usedRanks = new Set(retained.map((match) => match.rank));
        let nextRank = 1;
        function allocateRank() {
          while (usedRanks.has(nextRank)) nextRank++;
          return nextRank++;
        }
        const eklenen = await tx
          .insert(matches)
          .values(
            freshResults.map((r) => ({
              needId,
              talentId: r.talentId,
              strength: r.strength,
              reasoning: {
                fits: r.fits,
                gaps: r.gaps,
                summaryForOrganization: r.summaryForOrganization,
              },
              rank: allocateRank(),
            })),
          )
          .returning();

        await tx.insert(approvalQueue).values({
          action: 'publish_shortlist',
          subjectType: 'need',
          subjectId: needId,
          payload: {
            needTitle: kart.title,
            matchIds: [...retained, ...eklenen].map((m) => m.id),
            counts: {
              strong: [...retained, ...eklenen].filter((r) => r.strength === 'strong').length,
              possible: [...retained, ...eklenen].filter((r) => r.strength === 'possible').length,
              weak: [...retained, ...eklenen].filter((r) => r.strength === 'weak').length,
            },
          },
        });
        return { matches: eklenen, queued: true };
      });
    },

    /** Kurumun gördüğü aday listesi: kısa liste yayınlanmadıysa boş; yayınlandıysa özet (KARAR-09). */
    async candidatesForNeed(needId: string) {
      const [need] = await db.select().from(needs).where(eq(needs.id, needId)).limit(1);
      if (!need) throw new AppError('not_found', 'İhtiyaç bulunamadı', 404);

      const bekleyenler = await db
        .select({ subjectId: approvalQueue.subjectId })
        .from(approvalQueue)
        .where(and(eq(approvalQueue.action, 'introduce'), eq(approvalQueue.status, 'proposed')));
      const istekte = new Set(bekleyenler.map((b) => b.subjectId));
      const satirlar = await db
        .select({
          matchId: matches.id,
          rank: matches.rank,
          strength: matches.strength,
          reasoning: matches.reasoning,
          introducedAt: matches.introducedAt,
          talentConsent: matches.talentConsent,
          organizationConsent: matches.organizationConsent,
          introductionRequestedAt: matches.introductionRequestedAt,
          shortlistedAt: matches.shortlistedAt,
          name: users.name,
          headline: talents.headline,
          talentId: talents.id,
        })
        .from(matches)
        .innerJoin(talents, eq(talents.id, matches.talentId))
        .innerJoin(users, eq(users.id, talents.userId))
        .where(eq(matches.needId, needId))
        .orderBy(matches.rank);
      // Yetkinlikler kimlik açmaz (dil/araç × repo × commit); tanıştırma öncesi de görünür.
      const yetkinlikler = new Map<string, Awaited<ReturnType<typeof skillsForTalent>>>();
      for (const s of satirlar)
        if (!yetkinlikler.has(s.talentId))
          yetkinlikler.set(s.talentId, (await skillsForTalent(db, s.talentId)).slice(0, 8));
      return {
        published: Boolean(need.shortlistPublishedAt),
        candidates: satirlar
          .filter(
            (match) => match.shortlistedAt || match.introducedAt || match.introductionRequestedAt,
          )
          .map((s) => ({
            matchId: s.matchId,
            rank: s.rank,
            strength: s.strength,
            // Tanıştırma öncesi yalnız ilk ad; tam kart tanıştırma sonrası.
            name: s.introducedAt ? s.name : (s.name.split(' ')[0] ?? s.name),
            headline: s.headline,
            skills: yetkinlikler.get(s.talentId) ?? [],
            reasoning: s.reasoning,
            introduced: Boolean(s.introducedAt),
            introRequested: istekte.has(s.matchId),
            consentRequested: Boolean(s.introductionRequestedAt),
            talentConsent: s.talentConsent,
            organizationConsent: s.organizationConsent,
          })),
      };
    },

    /**
     * Kurum "tanıştır" der (KARAR-09'un kapısı): ajan tanıştırma e-postasını taslaklar, kuyruğa
     * düşer; operatör düzenler/onaylar, ancak o zaman iki tarafa gider. Aynı eşleşme için
     * bekleyen istek varsa ikincisi 409.
     */
    async requestIntroduction(needId: string, matchId: string) {
      const [m] = await db
        .select({
          match: matches,
          need: needs,
          orgName: organizations.name,
          talentName: users.name,
        })
        .from(matches)
        .innerJoin(needs, eq(needs.id, matches.needId))
        .innerJoin(organizations, eq(organizations.id, needs.organizationId))
        .innerJoin(talents, eq(talents.id, matches.talentId))
        .innerJoin(users, eq(users.id, talents.userId))
        .where(and(eq(matches.id, matchId), eq(matches.needId, needId)))
        .limit(1);
      if (!m) throw new AppError('not_found', 'Aday bulunamadı', 404);
      if (!m.match.shortlistedAt && !m.need.shortlistPublishedAt)
        throw new AppError('not_published', 'Kısa liste henüz açılmadı', 409);
      if (m.match.introductionRequestedAt)
        throw new AppError('already_requested', 'Tanıştırma isteği zaten iletildi', 409);
      if (m.match.introducedAt)
        throw new AppError('already_introduced', 'Tanıştırma yapılmış', 409);
      const [bekleyen] = await db
        .select({ id: approvalQueue.id })
        .from(approvalQueue)
        .where(
          and(
            eq(approvalQueue.action, 'introduce'),
            eq(approvalQueue.subjectId, matchId),
            eq(approvalQueue.status, 'proposed'),
          ),
        )
        .limit(1);
      if (bekleyen) throw new AppError('already_requested', 'İstek zaten kuyrukta', 409);

      const { draft, usage } = await runIntroducer(llm, {
        organizationName: m.orgName,
        talentName: m.talentName,
        need: m.need.card as NeedCard,
        reasoning: m.match.reasoning as unknown as MatchReasoning,
      });
      await recordAgentRun(db, {
        agent: 'introducer',
        subjectType: 'match',
        subjectId: matchId,
        outputSummary: { subject: draft.subject },
        usage,
      });
      const record = await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, matchId))
          .for('update');
        if (!locked || locked.introductionRequestedAt || locked.introducedAt)
          throw new AppError('already_requested', 'Tanıştırma isteği zaten iletildi', 409);
        await tx
          .update(matches)
          .set({
            introductionRequestedAt: new Date(),
            talentConsent: 'pending',
            organizationConsent: 'accepted',
            updatedAt: new Date(),
          })
          .where(eq(matches.id, matchId));
        const [kayit] = await tx
          .insert(approvalQueue)
          .values({
            action: 'introduce',
            subjectType: 'match',
            subjectId: matchId,
            payload: {
              ...draft,
              requestedBy: 'organization',
              needTitle: (m.need.card as NeedCard).title,
            },
          })
          .returning();
        return kayit!;
      });
      if (notifications)
        await notifyIntroduction(db, notifications.email, notifications.webOrigin, matchId).catch(
          (error: unknown) => console.error('[introduction notification]', error),
        );
      return { queued: record.id };
    },

    async matchesForNeed(needId: string) {
      return db
        .select()
        .from(matches)
        .where(eq(matches.needId, needId))
        .orderBy(desc(matches.rank));
    },
  };
}

export type MatchingService = ReturnType<typeof createMatchingService>;
