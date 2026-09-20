import { desc, eq } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import {
  approvalQueue,
  auditLog,
  collaborations,
  matches,
  needs,
  organizationMembers,
  organizations,
  talents,
  users,
} from '@evidex/db';
import type { ApprovalAction, CollaborationStatus } from '@evidex/shared';
import type { EmailSender } from '../lib/email';
import { AppError } from '../lib/response';
import type { FollowUpPayload, FollowUpService } from '../followups/service';

/**
 * ### Operatör servisi — onay kuyruğu ve yürütme (ADR-0004)
 * Ajanın dışa dönük her eylemi burada `proposed` bekler. Operatör onaylar/düzenler/reddeder;
 * yalnız o zaman yürütülür. Her karar denetim izine yazılır.
 * ⚠ Yürütme fonksiyonları yalnız bu servisten çağrılır; ajan doğrudan e-posta göndermez.
 */
export function createOperatorService(db: Db, email: EmailSender, followUp: FollowUpService) {
  async function audit(
    actorId: string,
    action: string,
    subjectType: string,
    subjectId: string,
    detail?: Record<string, unknown>,
  ) {
    await db
      .insert(auditLog)
      .values({ actorId, action, subjectType, subjectId, detail: detail ?? null });
  }

  async function execute(
    item: typeof approvalQueue.$inferSelect,
    payload: Record<string, unknown>,
  ) {
    const action = item.action as ApprovalAction;
    switch (action) {
      case 'publish_shortlist': {
        await db
          .update(needs)
          .set({ shortlistPublishedAt: new Date() })
          .where(eq(needs.id, item.subjectId));
        return;
      }
      case 'introduce': {
        const [m] = await db.select().from(matches).where(eq(matches.id, item.subjectId)).limit(1);
        if (!m) throw new AppError('not_found', 'Eşleşme bulunamadı', 404);
        const [need] = await db.select().from(needs).where(eq(needs.id, m.needId)).limit(1);
        const [talent] = await db
          .select({ email: users.email, name: users.name })
          .from(talents)
          .innerJoin(users, eq(users.id, talents.userId))
          .where(eq(talents.id, m.talentId))
          .limit(1);
        const kurumUyeleri = need
          ? await db
              .select({ email: users.email })
              .from(organizationMembers)
              .innerJoin(users, eq(users.id, organizationMembers.userId))
              .where(eq(organizationMembers.organizationId, need.organizationId))
          : [];
        const [kurum] = need
          ? await db
              .select({ name: organizations.name })
              .from(organizations)
              .where(eq(organizations.id, need.organizationId))
              .limit(1)
          : [];
        const metin = String(payload.message ?? '');
        const konu = String(
          payload.subject ??
            `Evidex tanıştırma: ${kurum?.name ?? 'Kurum'} · ${talent?.name ?? 'Genç yetenek'}`,
        );
        const alicilar = [talent?.email, ...kurumUyeleri.map((u) => u.email)].filter(
          (e): e is string => Boolean(e),
        );
        for (const to of alicilar) await email.send({ to, subject: konu, text: metin });
        await db.update(matches).set({ introducedAt: new Date() }).where(eq(matches.id, m.id));
        await db.insert(collaborations).values({ matchId: m.id }).onConflictDoNothing();
        return;
      }
      case 'send_follow_up': {
        // Taslak ajanın; gönderim takip servisinde (tek kullanımlık linkler orada üretilir).
        await followUp.send({
          collaborationId: item.subjectId,
          subject: String(payload.subject ?? 'Evidex takip'),
          messageTalent: String(payload.messageTalent ?? ''),
          messageOrganization: String(payload.messageOrganization ?? ''),
        } satisfies FollowUpPayload);
        return;
      }
      case 'invite':
        throw new AppError('not_implemented', `${action} henüz yürütülmüyor`, 501);
    }
  }

  return {
    async queue() {
      return db
        .select()
        .from(approvalQueue)
        .where(eq(approvalQueue.status, 'proposed'))
        .orderBy(desc(approvalQueue.createdAt));
    },

    async decide(
      operatorId: string,
      itemId: string,
      decision: 'approve' | 'reject' | 'edit',
      editedPayload?: Record<string, unknown>,
    ) {
      const [item] = await db
        .select()
        .from(approvalQueue)
        .where(eq(approvalQueue.id, itemId))
        .limit(1);
      if (!item) throw new AppError('not_found', 'Kuyruk kaydı bulunamadı', 404);
      // Aynı kaydı iki kez yürütmek (iki tanıştırma e-postası) olmaz.
      if (item.status !== 'proposed')
        throw new AppError('already_decided', 'Bu kayıt karara bağlanmış', 409);

      const status =
        decision === 'approve' ? 'approved' : decision === 'edit' ? 'edited' : 'rejected';
      const payload =
        decision === 'edit' ? { ...item.payload, ...(editedPayload ?? {}) } : item.payload;

      if (status !== 'rejected') await execute(item, payload);

      const [guncel] = await db
        .update(approvalQueue)
        .set({
          status,
          decidedBy: operatorId,
          decidedAt: new Date(),
          editedPayload: decision === 'edit' ? (editedPayload ?? null) : null,
          executedAt: status !== 'rejected' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(approvalQueue.id, itemId))
        .returning();
      await audit(operatorId, `approval.${status}`, item.subjectType, item.subjectId, {
        action: item.action,
      });
      return guncel!;
    },

    /** İş birliği durumu (döngü adımı 06): tanıştırıldı → görüşme → başladı → sürüyor → bitti/olmadı. */
    async setCollaborationStatus(operatorId: string, matchId: string, status: CollaborationStatus) {
      const [kayit] = await db
        .update(collaborations)
        .set({ status, lastCheckinAt: new Date(), updatedAt: new Date() })
        .where(eq(collaborations.matchId, matchId))
        .returning();
      if (!kayit)
        throw new AppError('not_found', 'İş birliği kaydı yok (tanıştırma yapılmamış)', 404);
      await audit(operatorId, 'collaboration.status', 'match', matchId, { status });
      return kayit;
    },

    /** Operatör bir eşleşme için tanıştırma önerir; e-posta taslağı kuyruğa düşer, onayla gider. */
    async proposeIntroduction(matchId: string, draft: { subject: string; message: string }) {
      const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
      if (!m) throw new AppError('not_found', 'Eşleşme bulunamadı', 404);
      if (m.introducedAt) throw new AppError('already_introduced', 'Tanıştırma yapılmış', 409);
      const [kayit] = await db
        .insert(approvalQueue)
        .values({ action: 'introduce', subjectType: 'match', subjectId: matchId, payload: draft })
        .returning();
      return kayit!;
    },
  };
}

export type OperatorService = ReturnType<typeof createOperatorService>;
