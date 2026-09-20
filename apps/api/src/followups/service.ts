import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import {
  approvalQueue,
  auditLog,
  cardClaims,
  collaborationCheckins,
  collaborations,
  evidenceSignals,
  evidenceSources,
  matches,
  needs,
  organizationMembers,
  organizations,
  talents,
  users,
} from '@evidex/db';
import { runCheckinInterpreter, runFollowUpDrafter, type LlmProvider } from '@evidex/ai';
import {
  THRESHOLDS,
  type CheckinInsight,
  type CheckinSide,
  type CollaborationStatus,
  type NeedCard,
} from '@evidex/shared';
import { recordAgentRun } from '../agents/runs';
import { hashToken, newRawToken } from '../auth/tokens';
import type { EmailSender } from '../lib/email';
import { AppError } from '../lib/response';

/** Takip eşikleri (gün). Ürün kimliği §izle: "3 gün sonra soru"; cevap yoksa sessiz. */
const FOLLOW_UP_AFTER_DAYS = THRESHOLDS.followUpAfterDays;
const SILENT_AFTER_DAYS = THRESHOLDS.silentCollaborationAfterDays;

const ACIK_DURUMLAR: CollaborationStatus[] = ['introduced', 'meeting', 'started', 'ongoing'];
const gun = (ms: number) => ms / 86_400_000;
const ilkAd = (name: string) => name.split(' ')[0] ?? name;

export interface FollowUpPayload {
  collaborationId: string;
  subject: string;
  messageTalent: string;
  messageOrganization: string;
}

/**
 * ### Takip servisi — döngü adımı: izle (06)
 * Tarama: tanıştırmadan N gün sonra hâlâ haber yoksa ajan iki tarafa soru yazar → kuyruk.
 * Gönderim (operatör onayıyla): her tarafa tek kullanımlık linkli e-posta.
 * Cevap: taraf durumu seçer + serbest metin; ajan metni yorumlar; kurum "tamamlandı" derse
 * gencin kartına referanslı iddia düşer (KARAR-10: yalnız GİRVAK onaylı kurum).
 * Sessizlik: soru gitti, SILENT_AFTER_DAYS içinde cevap yok → `silentSince` işaretlenir.
 * ⚠ Ajan durum belirlemez; durumu taraflar söyler. Çelişen cevaplar operatöre görünür.
 */
export function createFollowUpService(
  db: Db,
  llm: LlmProvider,
  email: EmailSender,
  webOrigin: string,
) {
  /** Bir iş birliğinin bağlamı: kurum, ihtiyaç, genç, e-postalar. */
  async function baglam(collaborationId: string) {
    const [c] = await db
      .select({
        collab: collaborations,
        match: matches,
        need: needs,
        org: organizations,
        talent: talents,
        talentUser: users,
      })
      .from(collaborations)
      .innerJoin(matches, eq(matches.id, collaborations.matchId))
      .innerJoin(needs, eq(needs.id, matches.needId))
      .innerJoin(organizations, eq(organizations.id, needs.organizationId))
      .innerJoin(talents, eq(talents.id, matches.talentId))
      .innerJoin(users, eq(users.id, talents.userId))
      .where(eq(collaborations.id, collaborationId))
      .limit(1);
    if (!c) throw new AppError('not_found', 'İş birliği bulunamadı', 404);
    const uyeler = await db
      .select({ email: users.email })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, c.org.id));
    return { ...c, orgEmails: uyeler.map((u) => u.email) };
  }

  return {
    /**
     * Zamanlanmış tarama (saatte bir) ya da operatör düğmesi. İdempotent: bekleyen öneri varsa
     * yenisini yazmaz; sessizi bir kez işaretler.
     */
    async scan(now = new Date()) {
      let proposed = 0;
      let silent = 0;

      // 1) Sessizlik: son soru SILENT_AFTER_DAYS önce gitti, o tarihten sonra cevap yok.
      const sessizEsik = new Date(now.getTime() - SILENT_AFTER_DAYS * 86_400_000);
      const sessizAdaylar = await db
        .select()
        .from(collaborations)
        .where(
          and(
            inArray(collaborations.status, ACIK_DURUMLAR),
            isNull(collaborations.silentSince),
            lt(collaborations.lastFollowUpAt, sessizEsik),
          ),
        );
      for (const c of sessizAdaylar) {
        if (c.lastCheckinAt && c.lastFollowUpAt && c.lastCheckinAt >= c.lastFollowUpAt) continue;
        await db
          .update(collaborations)
          .set({ silentSince: c.lastFollowUpAt, updatedAt: now })
          .where(eq(collaborations.id, c.id));
        silent++;
      }

      // 2) Takip zamanı gelenler: son hareket FOLLOW_UP_AFTER_DAYS'tan eski, bekleyen öneri yok.
      const bekleyen = await db
        .select({ subjectId: approvalQueue.subjectId })
        .from(approvalQueue)
        .where(
          and(eq(approvalQueue.action, 'send_follow_up'), eq(approvalQueue.status, 'proposed')),
        );
      const bekleyenIds = new Set(bekleyen.map((b) => b.subjectId));

      const acik = await db
        .select({ collab: collaborations, introducedAt: matches.introducedAt })
        .from(collaborations)
        .innerJoin(matches, eq(matches.id, collaborations.matchId))
        .where(inArray(collaborations.status, ACIK_DURUMLAR));

      for (const { collab, introducedAt } of acik) {
        if (bekleyenIds.has(collab.id) || collab.silentSince) continue;
        const sonHareket = [collab.lastCheckinAt, collab.lastFollowUpAt, introducedAt]
          .filter((d): d is Date => d instanceof Date)
          .reduce((a, b) => (a > b ? a : b), new Date(0));
        if (gun(now.getTime() - sonHareket.getTime()) < FOLLOW_UP_AFTER_DAYS) continue;

        const b = await baglam(collab.id);
        const [sayim] = await db
          .select({ tur: sql<number>`count(distinct ${collaborationCheckins.batchId})::int` })
          .from(collaborationCheckins)
          .where(eq(collaborationCheckins.collaborationId, collab.id));
        const tur = sayim?.tur ?? 0;
        const { draft, usage } = await runFollowUpDrafter(llm, {
          organizationName: b.org.name,
          talentFirstName: ilkAd(b.talentUser.name),
          needTitle: (b.need.card as NeedCard | null)?.title ?? b.need.rawText.slice(0, 80),
          status: collab.status,
          daysSinceIntroduction: Math.floor(gun(now.getTime() - (introducedAt ?? now).getTime())),
          round: tur + 1,
          lastTalentFeedback: collab.talentFeedback,
          lastOrganizationFeedback: collab.organizationFeedback,
        });
        await recordAgentRun(db, {
          agent: 'follow_up',
          subjectType: 'collaboration',
          subjectId: collab.id,
          inputSummary: { status: collab.status, round: tur + 1 },
          outputSummary: { subject: draft.subject },
          usage,
        });
        const payload: FollowUpPayload = { collaborationId: collab.id, ...draft };
        await db.insert(approvalQueue).values({
          action: 'send_follow_up',
          subjectType: 'collaboration',
          subjectId: collab.id,
          payload: { ...payload, needTitle: (b.need.card as NeedCard | null)?.title ?? '' },
        });
        proposed++;
      }
      return { proposed, silent };
    },

    /** Kuyruk onayından çağrılır: iki tarafa tek kullanımlık linkli e-posta. */
    async send(payload: FollowUpPayload) {
      const b = await baglam(payload.collaborationId);
      const batchId = crypto.randomUUID();
      const now = new Date();
      const taraflar: { side: CheckinSide; to: string[]; message: string }[] = [
        { side: 'talent', to: [b.talentUser.email], message: payload.messageTalent },
        { side: 'organization', to: b.orgEmails, message: payload.messageOrganization },
      ];
      for (const t of taraflar) {
        const raw = newRawToken();
        await db.insert(collaborationCheckins).values({
          collaborationId: b.collab.id,
          batchId,
          side: t.side,
          tokenHash: hashToken(raw),
          sentAt: now,
        });
        const link = `${webOrigin}/takip/${raw}`;
        const metin = t.message.includes('[link]')
          ? t.message.replace('[link]', link)
          : `${t.message}\n\nCevap için: ${link}`;
        for (const to of t.to) await email.send({ to, subject: payload.subject, text: metin });
      }
      await db
        .update(collaborations)
        .set({ lastFollowUpAt: now, silentSince: null, updatedAt: now })
        .where(eq(collaborations.id, b.collab.id));
    },

    /** Linkteki token → cevap sayfasının bağlamı. Giriş gerektirmez. */
    async context(rawToken: string) {
      const [ci] = await db
        .select()
        .from(collaborationCheckins)
        .where(eq(collaborationCheckins.tokenHash, hashToken(rawToken)))
        .limit(1);
      if (!ci) throw new AppError('not_found', 'Takip linki geçersiz', 404);
      const b = await baglam(ci.collaborationId);
      return {
        side: ci.side,
        answered: Boolean(ci.answeredAt),
        organizationName: b.org.name,
        talentFirstName: ilkAd(b.talentUser.name),
        needTitle: (b.need.card as NeedCard | null)?.title ?? '',
        currentStatus: b.collab.status,
      };
    },

    /** Taraf cevap verir: durum + serbest metin. Tek kullanımlık. */
    async answer(rawToken: string, body: { status: CollaborationStatus; feedback: string }) {
      const [ci] = await db
        .select()
        .from(collaborationCheckins)
        .where(eq(collaborationCheckins.tokenHash, hashToken(rawToken)))
        .limit(1);
      if (!ci) throw new AppError('not_found', 'Takip linki geçersiz', 404);
      if (ci.answeredAt) throw new AppError('already_answered', 'Bu soru cevaplanmış', 409);
      const b = await baglam(ci.collaborationId);
      const now = new Date();
      const feedback = body.feedback.trim();
      const kurumReferansVerebilir = Boolean(b.org.approvedByOperatorAt);

      // Boş metin = ajan çağrısı yok; yorum deterministik.
      let insight: CheckinInsight = {
        summary: 'Serbest metin yok; yalnız durum seçildi.',
        flags: body.status === 'did_not_happen' ? ['no_contact'] : [],
        needsOperator: body.status === 'did_not_happen',
        operatorNote: body.status === 'did_not_happen' ? 'Taraf iş birliği olmadı dedi.' : null,
        referenceClaim: null,
      };
      if (feedback.length > 0) {
        const r = await runCheckinInterpreter(llm, {
          side: ci.side,
          status: body.status,
          feedback,
          organizationName: b.org.name,
          needTitle: (b.need.card as NeedCard | null)?.title ?? '',
          organizationCanReference: kurumReferansVerebilir,
        });
        insight = r.insight;
        await recordAgentRun(db, {
          agent: 'checkin_interpreter',
          subjectType: 'collaboration_checkin',
          subjectId: ci.id,
          inputSummary: { side: ci.side, status: body.status, chars: feedback.length },
          outputSummary: { flags: insight.flags, needsOperator: insight.needsOperator },
          usage: r.usage,
        });
      }

      await db
        .update(collaborationCheckins)
        .set({ answeredAt: now, status: body.status, feedback: feedback || null, insight })
        .where(eq(collaborationCheckins.id, ci.id));
      await db
        .update(collaborations)
        .set({
          status: body.status,
          lastCheckinAt: now,
          silentSince: null,
          ...(ci.side === 'talent'
            ? { talentFeedback: feedback || null }
            : { organizationFeedback: feedback || null }),
          updatedAt: now,
        })
        .where(eq(collaborations.id, ci.collaborationId));
      await db.insert(auditLog).values({
        actorId: null,
        action: `checkin.${ci.side}`,
        subjectType: 'collaboration',
        subjectId: ci.collaborationId,
        detail: { status: body.status, flags: insight.flags },
      });

      // KARAR-10: referanslı kanıt yalnız platform içi iş birliği + onaylı kurum + tamamlandı.
      if (ci.side === 'organization' && body.status === 'completed' && kurumReferansVerebilir) {
        const metin =
          insight.referenceClaim ??
          `${b.org.name} ile "${(b.need.card as NeedCard | null)?.title ?? 'iş birliği'}" tamamlandı; kurum geri bildirimi kayıtlı.`;
        const [kaynak] = await db
          .insert(evidenceSources)
          .values({
            talentId: b.talent.id,
            kind: 'network_reference',
            ref: ci.collaborationId,
            ownershipVerified: true,
            ownershipMethod: 'org_account',
            lastScannedAt: now,
          })
          .onConflictDoUpdate({
            target: [evidenceSources.talentId, evidenceSources.kind, evidenceSources.ref],
            set: { lastScannedAt: now },
          })
          .returning();
        await db.insert(evidenceSignals).values({
          sourceId: kaynak!.id,
          signals: {
            organization: b.org.name,
            need: (b.need.card as NeedCard | null)?.title ?? null,
            status: 'completed',
            flags: insight.flags,
          },
        });
        await db.insert(cardClaims).values({
          talentId: b.talent.id,
          text: metin,
          draftText: metin,
          level: 'referenced',
          sourceIds: [kaynak!.id],
          periodStart: b.match.introducedAt
            ? b.match.introducedAt.toISOString().slice(0, 10)
            : null,
          periodEnd: now.toISOString().slice(0, 10),
          approved: false,
        });
        await db.update(talents).set({ lastSignalAt: now }).where(eq(talents.id, b.talent.id));
      }
      return { side: ci.side, status: body.status, needsOperator: insight.needsOperator };
    },

    /** Operatör listesi: her iş birliği, son turun iki cevabı, sessizlik ve çelişki işareti. */
    async list() {
      const satirlar = await db
        .select({
          collab: collaborations,
          matchId: matches.id,
          introducedAt: matches.introducedAt,
          needTitle: sql<string | null>`${needs.card}->>'title'`,
          organizationName: organizations.name,
          organizationApproved: organizations.approvedByOperatorAt,
          talentName: users.name,
        })
        .from(collaborations)
        .innerJoin(matches, eq(matches.id, collaborations.matchId))
        .innerJoin(needs, eq(needs.id, matches.needId))
        .innerJoin(organizations, eq(organizations.id, needs.organizationId))
        .innerJoin(talents, eq(talents.id, matches.talentId))
        .innerJoin(users, eq(users.id, talents.userId))
        .orderBy(desc(collaborations.updatedAt));
      const sonuc = [];
      for (const s of satirlar) {
        const cevaplar = await db
          .select()
          .from(collaborationCheckins)
          .where(eq(collaborationCheckins.collaborationId, s.collab.id))
          .orderBy(desc(collaborationCheckins.sentAt));
        const sonTur = cevaplar[0]
          ? cevaplar.filter((c) => c.batchId === cevaplar[0]!.batchId)
          : [];
        const cevaplanan = sonTur.filter((c) => c.status);
        const celiski = cevaplanan.length === 2 && cevaplanan[0]!.status !== cevaplanan[1]!.status;
        sonuc.push({
          id: s.collab.id,
          matchId: s.matchId,
          status: s.collab.status,
          introducedAt: s.introducedAt,
          lastCheckinAt: s.collab.lastCheckinAt,
          lastFollowUpAt: s.collab.lastFollowUpAt,
          silentSince: s.collab.silentSince,
          needTitle: s.needTitle,
          organizationName: s.organizationName,
          organizationApproved: Boolean(s.organizationApproved),
          talentName: s.talentName,
          rounds: new Set(cevaplar.map((c) => c.batchId)).size,
          conflict: celiski,
          needsOperator: sonTur.some(
            (c) => (c.insight as CheckinInsight | null)?.needsOperator === true,
          ),
          lastRound: sonTur.map((c) => ({
            side: c.side,
            sentAt: c.sentAt,
            answeredAt: c.answeredAt,
            status: c.status,
            feedback: c.feedback,
            insight: c.insight as CheckinInsight | null,
          })),
        });
      }
      return sonuc;
    },
  };
}

export type FollowUpService = ReturnType<typeof createFollowUpService>;
