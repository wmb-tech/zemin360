import { and, asc, desc, eq, lt, ne } from 'drizzle-orm';
import { approvalQueue, auditLog, introductionDeliveries, type Db } from '@evidex/db';
import type { EmailSender } from '../lib/email';
import { AppError } from '../lib/response';

export function createIntroductionDeliveryService(db: Db, email: EmailSender) {
  async function send(queueId: string) {
    const [delivery] = await db
      .update(introductionDeliveries)
      .set({ status: 'sending', updatedAt: new Date() })
      .where(
        and(
          eq(introductionDeliveries.queueId, queueId),
          eq(introductionDeliveries.status, 'pending'),
        ),
      )
      .returning();
    if (!delivery) return;
    try {
      await email.send({
        to: delivery.recipients,
        subject: delivery.subject,
        text: delivery.message,
      });
      await db.transaction(async (tx) => {
        await tx
          .update(introductionDeliveries)
          .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
          .where(eq(introductionDeliveries.id, delivery.id));
        await tx
          .update(approvalQueue)
          .set({ executedAt: new Date(), updatedAt: new Date() })
          .where(eq(approvalQueue.id, queueId));
      });
    } catch (error) {
      // SMTP cannot guarantee whether an interrupted send reached the recipient. No automatic retry.
      console.error('[introduction delivery]', error);
      await db
        .update(introductionDeliveries)
        .set({ status: 'uncertain', updatedAt: new Date() })
        .where(eq(introductionDeliveries.id, delivery.id));
    }
  }
  return {
    send,
    async drain() {
      await db
        .update(introductionDeliveries)
        .set({ status: 'uncertain', updatedAt: new Date() })
        .where(
          and(
            eq(introductionDeliveries.status, 'sending'),
            lt(introductionDeliveries.updatedAt, new Date(Date.now() - 10 * 60_000)),
          ),
        );
      const pending = await db
        .select({ queueId: introductionDeliveries.queueId })
        .from(introductionDeliveries)
        .where(eq(introductionDeliveries.status, 'pending'))
        .limit(20);
      for (const delivery of pending) await send(delivery.queueId);
    },
    async list() {
      const query = () =>
        db
          .select({
            id: introductionDeliveries.id,
            subject: introductionDeliveries.subject,
            recipients: introductionDeliveries.recipients,
            status: introductionDeliveries.status,
            createdAt: introductionDeliveries.createdAt,
            updatedAt: introductionDeliveries.updatedAt,
            sentAt: introductionDeliveries.sentAt,
          })
          .from(introductionDeliveries);
      const unresolved = await query()
        .where(ne(introductionDeliveries.status, 'sent'))
        .orderBy(asc(introductionDeliveries.createdAt));
      const sent = await query()
        .where(eq(introductionDeliveries.status, 'sent'))
        .orderBy(desc(introductionDeliveries.createdAt))
        .limit(100);
      return [...unresolved, ...sent];
    },
    async retry(id: string, operatorId: string) {
      const delivery = await db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(introductionDeliveries)
          .set({ status: 'pending', updatedAt: new Date() })
          .where(
            and(eq(introductionDeliveries.id, id), eq(introductionDeliveries.status, 'uncertain')),
          )
          .returning();
        if (!claimed) throw new AppError('not_retryable', 'Bu gönderim yeniden gönderilemez', 409);
        await tx.insert(auditLog).values({
          actorId: operatorId,
          action: 'introduction.delivery_retry',
          subjectType: 'match',
          subjectId: claimed.matchId,
          detail: { deliveryId: id },
        });
        return claimed;
      });
      await send(delivery.queueId);
      return { saved: true };
    },
    async status(queueId: string) {
      const [delivery] = await db
        .select({ status: introductionDeliveries.status })
        .from(introductionDeliveries)
        .where(eq(introductionDeliveries.queueId, queueId))
        .limit(1);
      return delivery?.status ?? null;
    },
  };
}
export type IntroductionDeliveryService = ReturnType<typeof createIntroductionDeliveryService>;
