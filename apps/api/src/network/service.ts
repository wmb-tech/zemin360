import { and, desc, eq, isNotNull, lt, sql } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import {
  auditLog,
  cardClaims,
  evidenceSources,
  needs,
  organizationMembers,
  organizations,
  talents,
  users,
} from '@evidex/db';
import { THRESHOLDS, type EvidenceLevel } from '@evidex/shared';
import { AppError } from '../lib/response';
import type { TalentService } from '../talent/service';

const SILENT_CARD_AFTER_DAYS = THRESHOLDS.silentCardAfterDays;
const REFRESH_AFTER_DAYS = THRESHOLDS.evidenceRefreshAfterDays;

const gunOnce = (now: Date, n: number) => new Date(now.getTime() - n * 86_400_000);

/** Sessiz kart: kanıtta son etkinlik eşikten eski ya da hiç yok. Talent servisi de kullanır. */
export function isSilentCard(lastSignalAt: Date | null, now = new Date()) {
  return !lastSignalAt || lastSignalAt < gunOnce(now, SILENT_CARD_AFTER_DAYS);
}

/**
 * ### Ağ servisi — döngü adımı: canlı tut (04)
 * Kart bir kez yazılıp unutulmaz: GitHub kaynakları haftada bir yeniden okunur (taslak
 * iddialar yenilenir, onaylılar durur); kanıtta 90 gündür etkinlik yoksa kart "sessiz"
 * işaretlenir — hem operatör listesinde hem gencin kendi kartında. Kurum onayı (KARAR-10)
 * da burada: referans verme yetkisi yalnız operatörün onayladığı kurumda.
 * ⚠ Sessizlik bir sütun değil, hesaptır; eşik değişince geçmiş veri bozulmaz.
 */
export function createNetworkService(db: Db, talent: TalentService) {
  return {
    isSilent(lastSignalAt: Date | null, now = new Date()) {
      return isSilentCard(lastSignalAt, now);
    },

    /** Operatörün ağ görünümü: gençler (kart durumu, kanıt dağılımı, sessizlik) ve kurumlar. */
    async overview(now = new Date()) {
      const gencler = await db
        .select({
          id: talents.id,
          name: users.name,
          githubLogin: users.githubLogin,
          cardStatus: talents.cardStatus,
          lastSignalAt: talents.lastSignalAt,
          githubConnected: sql<boolean>`${talents.githubInstallationId} is not null`,
          createdAt: talents.createdAt,
        })
        .from(talents)
        .innerJoin(users, eq(users.id, talents.userId))
        .orderBy(desc(talents.createdAt));
      const iddialar = await db
        .select({
          talentId: cardClaims.talentId,
          level: cardClaims.level,
          approved: cardClaims.approved,
          n: sql<number>`count(*)::int`,
        })
        .from(cardClaims)
        .groupBy(cardClaims.talentId, cardClaims.level, cardClaims.approved);
      const kaynaklar = await db
        .select({ talentId: evidenceSources.talentId, n: sql<number>`count(*)::int` })
        .from(evidenceSources)
        .groupBy(evidenceSources.talentId);
      const kaynakSayisi = new Map(kaynaklar.map((k) => [k.talentId, k.n]));

      const talentRows = gencler.map((g) => {
        const levels: Record<EvidenceLevel, number> = {
          verified: 0,
          documented: 0,
          referenced: 0,
          declared: 0,
        };
        let approved = 0;
        for (const i of iddialar) {
          if (i.talentId !== g.id) continue;
          levels[i.level] += i.n;
          if (i.approved) approved += i.n;
        }
        return {
          ...g,
          sources: kaynakSayisi.get(g.id) ?? 0,
          claims: levels,
          approvedClaims: approved,
          silent: this.isSilent(g.lastSignalAt, now),
        };
      });

      // ⚠ Alt sorguda drizzle sütunu tablo adı olmadan basar ("organization_id" = "id" ikisi de
      // needs'e çözülür → hep 0). Bu yüzden sayımlar ayrı gruplu sorgu.
      const kurumlar = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          city: organizations.city,
          approvedAt: organizations.approvedByOperatorAt,
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .orderBy(desc(organizations.createdAt));
      const ihtiyacSayisi = new Map(
        (
          await db
            .select({ orgId: needs.organizationId, n: sql<number>`count(*)::int` })
            .from(needs)
            .groupBy(needs.organizationId)
        ).map((r) => [r.orgId, r.n]),
      );
      const uyeSayisi = new Map(
        (
          await db
            .select({ orgId: organizationMembers.organizationId, n: sql<number>`count(*)::int` })
            .from(organizationMembers)
            .groupBy(organizationMembers.organizationId)
        ).map((r) => [r.orgId, r.n]),
      );

      return {
        talents: talentRows,
        organizations: kurumlar.map((k) => ({
          ...k,
          approved: Boolean(k.approvedAt),
          needs: ihtiyacSayisi.get(k.id) ?? 0,
          members: uyeSayisi.get(k.id) ?? 0,
        })),
        silentTalents: talentRows.filter((t) => t.silent).length,
      };
    },

    /** KARAR-10: kurumu referans vermeye yetkili kıl / yetkiyi kaldır. Denetim izine yazılır. */
    async setOrganizationApproval(operatorId: string, organizationId: string, approved: boolean) {
      const [k] = await db
        .update(organizations)
        .set({ approvedByOperatorAt: approved ? new Date() : null, updatedAt: new Date() })
        .where(eq(organizations.id, organizationId))
        .returning();
      if (!k) throw new AppError('not_found', 'Kurum bulunamadı', 404);
      await db.insert(auditLog).values({
        actorId: operatorId,
        action: approved ? 'organization.approved' : 'organization.unapproved',
        subjectType: 'organization',
        subjectId: organizationId,
      });
      return { id: k.id, approved: Boolean(k.approvedByOperatorAt) };
    },

    /**
     * Zamanlanmış: GitHub bağlı ve REFRESH_AFTER_DAYS'tır taranmamış kartları yeniden oku.
     * Her genç ayrı try/catch — birinin kurulumu kaldırılmışsa diğerleri durmaz. İdempotent:
     * tarama tarihi güncellenir, aynı tick'te ikinci kez seçilmez.
     */
    async refreshEvidence(now = new Date(), limit = 20) {
      const esik = gunOnce(now, REFRESH_AFTER_DAYS);
      const adaylar = await db
        .select({ userId: talents.userId, talentId: talents.id })
        .from(talents)
        .where(
          and(
            isNotNull(talents.githubInstallationId),
            sql`not exists (select 1 from ${evidenceSources} where ${evidenceSources.talentId} = ${talents.id} and ${evidenceSources.kind} = 'github_repo' and ${evidenceSources.lastScannedAt} >= ${esik})`,
          ),
        )
        .limit(limit);
      let refreshed = 0;
      let failed = 0;
      for (const a of adaylar) {
        try {
          await talent.syncGithub(a.userId);
          refreshed++;
        } catch (err) {
          failed++;
          console.error(`[jobs] kanıt yenileme başarısız talent=${a.talentId}`, err);
          // Sürekli aynı gençte patlamasın: kaynakların tarama tarihini ilerlet.
          await db
            .update(evidenceSources)
            .set({ lastScannedAt: now })
            .where(
              and(
                eq(evidenceSources.talentId, a.talentId),
                lt(evidenceSources.lastScannedAt, esik),
              ),
            );
        }
      }
      return { refreshed, failed };
    },
  };
}

export type NetworkService = ReturnType<typeof createNetworkService>;
