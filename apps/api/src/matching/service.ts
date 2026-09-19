import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import { approvalQueue, cardClaims, matches, needs, talents, users } from '@evidex/db';
import { runMatcher, type CandidateCard, type LlmProvider } from '@evidex/ai';
import type { NeedCard } from '@evidex/shared';
import { recordAgentRun } from '../agents/runs';
import { AppError } from '../lib/response';

const MAX_CANDIDATES = 15;

/**
 * ### Eşleştirme servisi — döngü adımı: eşleştir (03)
 * Onaylı ihtiyaç → onaylı kartlar arasından ön eleme → tek ajan çağrısı → sıralı gerekçeli
 * liste → operatörün onay kuyruğuna "kısa listeyi yayınla" önerisi (ADR-0004).
 * ⚠ Kurum, operatör onaylayana kadar hiçbir adayı görmez (KARAR-09).
 */
export function createMatchingService(db: Db, llm: LlmProvider) {
  async function loadCandidates(need: NeedCard): Promise<CandidateCard[]> {
    const satirlar = await db
      .select({
        talentId: talents.id,
        name: users.name,
        headline: talents.headline,
        story: talents.story,
      })
      .from(talents)
      .innerJoin(users, eq(users.id, talents.userId))
      .where(eq(talents.cardStatus, 'approved'));
    if (satirlar.length === 0) return [];

    const iddialar = await db
      .select()
      .from(cardClaims)
      .where(
        and(
          inArray(
            cardClaims.talentId,
            satirlar.map((s) => s.talentId),
          ),
          eq(cardClaims.approved, true),
        ),
      );

    const kartlar: CandidateCard[] = satirlar.map((s) => ({
      ...s,
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

      const adaylar = await loadCandidates(kart);
      const { results, usage } = await runMatcher(llm, kart, adaylar);
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

      // Eski liste silinir; yeniden çalıştırma eski gerekçeleri biriktirmez.
      await db.delete(matches).where(eq(matches.needId, needId));
      if (results.length === 0) return { matches: [], queued: false };

      const eklenen = await db
        .insert(matches)
        .values(
          results.map((r, i) => ({
            needId,
            talentId: r.talentId,
            strength: r.strength,
            reasoning: {
              fits: r.fits,
              gaps: r.gaps,
              summaryForOrganization: r.summaryForOrganization,
            },
            rank: i + 1,
          })),
        )
        .returning();

      await db.insert(approvalQueue).values({
        action: 'publish_shortlist',
        subjectType: 'need',
        subjectId: needId,
        payload: {
          needTitle: kart.title,
          matchIds: eklenen.map((m) => m.id),
          counts: {
            strong: results.filter((r) => r.strength === 'strong').length,
            possible: results.filter((r) => r.strength === 'possible').length,
            weak: results.filter((r) => r.strength === 'weak').length,
          },
        },
      });
      return { matches: eklenen, queued: true };
    },

    /** Kurumun gördüğü aday listesi: kısa liste yayınlanmadıysa boş; yayınlandıysa özet (KARAR-09). */
    async candidatesForNeed(needId: string) {
      const [need] = await db.select().from(needs).where(eq(needs.id, needId)).limit(1);
      if (!need) throw new AppError('not_found', 'İhtiyaç bulunamadı', 404);
      if (!need.shortlistPublishedAt) return { published: false as const, candidates: [] };
      const satirlar = await db
        .select({
          matchId: matches.id,
          rank: matches.rank,
          strength: matches.strength,
          reasoning: matches.reasoning,
          introducedAt: matches.introducedAt,
          name: users.name,
          headline: talents.headline,
        })
        .from(matches)
        .innerJoin(talents, eq(talents.id, matches.talentId))
        .innerJoin(users, eq(users.id, talents.userId))
        .where(eq(matches.needId, needId))
        .orderBy(matches.rank);
      return {
        published: true as const,
        candidates: satirlar.map((s) => ({
          matchId: s.matchId,
          rank: s.rank,
          strength: s.strength,
          // Tanıştırma öncesi yalnız ilk ad; tam kart tanıştırma sonrası.
          name: s.introducedAt ? s.name : (s.name.split(' ')[0] ?? s.name),
          headline: s.headline,
          reasoning: s.reasoning,
          introduced: Boolean(s.introducedAt),
        })),
      };
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
