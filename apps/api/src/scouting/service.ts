import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import { approvalQueue, matches, needs, organizations, scoutInvites, users } from '@evidex/db';
import { runScout, type LlmProvider } from '@evidex/ai';
import { skillsToQuery, type GithubScout } from '@evidex/evidence';
import { THRESHOLDS, type NeedCard } from '@evidex/shared';
import { recordAgentRun } from '../agents/runs';
import { AppError } from '../lib/response';

/**
 * ### Keşif servisi — döngü adımı: keşfet (01)
 * Ağ içi eşleştirme yetersiz kaldığında (ya da operatör isteyince) ihtiyaçtan GitHub araması
 * kurulur, ağ dışı adaylar çekilir, ajan gerekçeli seçer → tek `invite` kaydı olarak onay
 * kuyruğuna düşer. Herkese açık e-postası olanlara onayla davet gider; olmayanlar payload'da
 * "elle ulaş" listesidir (profil linki). Ağdakiler (githubLogin) baştan elenir.
 * ⚠ Hiçbir aday verisi saklanmaz; yalnız kuyruk payload'ında seçilenlerin login/url/gerekçesi.
 */
export function createScoutingService(db: Db, llm: LlmProvider, scout: GithubScout) {
  return {
    /** Operatörün ihtiyaç listesi: onaylı kartlar, kurum adı, eşleşme sayıları. */
    async needsForOperator() {
      const satirlar = await db
        .select({
          id: needs.id,
          title: sql<string | null>`${needs.card}->>'title'`,
          cardStatus: needs.cardStatus,
          organizationName: organizations.name,
          shortlistPublishedAt: needs.shortlistPublishedAt,
          createdAt: needs.createdAt,
        })
        .from(needs)
        .innerJoin(organizations, eq(organizations.id, needs.organizationId))
        .orderBy(desc(needs.createdAt));
      const sayimlar = await db
        .select({
          needId: matches.needId,
          strength: matches.strength,
          n: sql<number>`count(*)::int`,
          introduced: sql<number>`count(${matches.introducedAt})::int`,
        })
        .from(matches)
        .groupBy(matches.needId, matches.strength);
      return satirlar.map((s) => {
        const m = sayimlar.filter((x) => x.needId === s.id);
        return {
          ...s,
          matches: {
            strong: m.find((x) => x.strength === 'strong')?.n ?? 0,
            possible: m.find((x) => x.strength === 'possible')?.n ?? 0,
            weak: m.find((x) => x.strength === 'weak')?.n ?? 0,
            introduced: m.reduce((a, x) => a + x.introduced, 0),
          },
        };
      });
    },

    async scoutForNeed(needId: string) {
      const [need] = await db
        .select({ need: needs, orgName: organizations.name })
        .from(needs)
        .innerJoin(organizations, eq(organizations.id, needs.organizationId))
        .where(eq(needs.id, needId))
        .limit(1);
      if (!need) throw new AppError('not_found', 'İhtiyaç bulunamadı', 404);
      if (need.need.cardStatus !== 'approved')
        throw new AppError('need_not_approved', 'İhtiyaç kartı onaylı değil', 409);
      const card = need.need.card as NeedCard;

      const sorgu = skillsToQuery([...card.requiredSkills, ...card.niceToHaveSkills]);
      const bulunan = await scout.search(sorgu);
      // Ağdakiler elenir: keşif ağ DIŞI içindir.
      const logins = bulunan.map((b) => b.login);
      const agdakiler = logins.length
        ? await db
            .select({ login: users.githubLogin })
            .from(users)
            .where(inArray(users.githubLogin, logins))
        : [];
      const agSet = new Set(agdakiler.map((a) => a.login));
      // Yakın zamanda davet edilenler de elenir: gerçek insanlara tekrar tekrar yazılmaz.
      const yakinDavet = logins.length
        ? await db
            .select({ login: scoutInvites.login })
            .from(scoutInvites)
            .where(
              and(
                inArray(scoutInvites.login, logins),
                gt(
                  scoutInvites.invitedAt,
                  new Date(Date.now() - THRESHOLDS.scoutReinviteAfterDays * 86_400_000),
                ),
              ),
            )
        : [];
      const davetSet = new Set(yakinDavet.map((d) => d.login));
      const adaylar = bulunan.filter((b) => !agSet.has(b.login) && !davetSet.has(b.login));

      const started = Date.now();
      const { picks, usage } = await runScout(
        llm,
        card,
        // E-posta ajana gitmez; yalnız davet gönderiminde kullanılır.
        adaylar.map((a) => ({
          login: a.login,
          url: a.url,
          name: a.name,
          bio: a.bio,
          location: a.location,
          publicRepos: a.publicRepos,
          followers: a.followers,
          createdAt: a.createdAt,
          topLanguages: a.topLanguages,
          recentRepos: a.recentRepos,
          lastPushedAt: a.lastPushedAt,
        })),
      );
      if (usage)
        await recordAgentRun(db, {
          agent: 'scout',
          subjectType: 'need',
          subjectId: needId,
          inputSummary: { searched: bulunan.length, inNetwork: agSet.size, query: sorgu },
          outputSummary: { picked: picks.length, ms: Date.now() - started },
          usage,
        });

      const byLogin = new Map(adaylar.map((a) => [a.login, a]));
      const secilen = picks.map((p) => {
        const a = byLogin.get(p.login)!;
        return {
          login: p.login,
          url: a.url,
          name: a.name,
          email: a.email,
          fit: p.fit,
          why: p.why,
          inviteLine: p.inviteLine,
        };
      });
      const emails = secilen.map((s) => s.email).filter((e): e is string => Boolean(e));
      const summary = {
        searched: bulunan.length,
        inNetwork: agSet.size,
        recentlyInvited: davetSet.size,
        picked: secilen.length,
        withEmail: emails.length,
      };
      if (secilen.length === 0) return { queued: null, summary };

      const [kayit] = await db
        .insert(approvalQueue)
        .values({
          action: 'invite',
          subjectType: 'need',
          subjectId: needId,
          payload: {
            source: `GitHub keşfi · ${card.title}`,
            needTitle: card.title,
            emails,
            skipped: 0,
            candidates: secilen,
            manual: secilen.filter((s) => !s.email).map((s) => ({ login: s.login, url: s.url })),
            subject: `GİRVAK ağına davet · ${need.orgName} bir ${card.collaborationType === 'internship' ? 'stajyer' : 'iş birliği'} arıyor`,
            message: `Merhaba,\n\nGİRVAK gençlik ağında bir kurum "${card.title}" için birini arıyor; GitHub'daki işlerin bu ihtiyaca yakın görünüyor. Evidex'te kart beyanla değil kanıtla oluşur: reponu bağlarsın, sistem sinyalleri çıkarır, sen onaylarsın; kurum gerekçeli eşleşmeyle seni görür.`,
          },
        })
        .returning();
      return { queued: kayit!, summary };
    },
  };
}

export type ScoutingService = ReturnType<typeof createScoutingService>;
