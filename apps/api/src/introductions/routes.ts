import { Hono } from 'hono';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  approvalQueue,
  introductionDeliveries,
  auditLog,
  matches,
  needs,
  organizationMembers,
  organizations,
  talents,
  users,
  type Db,
} from '@evidex/db';
import { withRole } from '../auth/middleware';
import type { AuthService } from '../auth/service';
import { AppError, ok } from '../lib/response';

export function introductionRoutes(db: Db, auth: AuthService) {
  async function matchIdsFor(userId: string, role: string) {
    if (role === 'talent') {
      const rows = await db
        .select({ id: matches.id })
        .from(matches)
        .innerJoin(talents, eq(talents.id, matches.talentId))
        .where(and(eq(talents.userId, userId), isNotNull(matches.introductionRequestedAt)));
      return rows.map((row) => row.id);
    }
    const rows = await db
      .select({ id: matches.id })
      .from(matches)
      .innerJoin(needs, eq(needs.id, matches.needId))
      .innerJoin(organizationMembers, eq(organizationMembers.organizationId, needs.organizationId))
      .where(
        and(eq(organizationMembers.userId, userId), isNotNull(matches.introductionRequestedAt)),
      );
    return rows.map((row) => row.id);
  }

  return new Hono()
    .use('*', withRole(auth, 'talent', 'organization'))
    .get('/', async (c) => {
      const user = c.get('user');
      const ids = await matchIdsFor(user.id, user.role);
      if (ids.length === 0) return ok(c, []);
      const rows = await db
        .select({ match: matches, card: needs.card, city: organizations.city, name: users.name })
        .from(matches)
        .innerJoin(needs, eq(needs.id, matches.needId))
        .innerJoin(organizations, eq(organizations.id, needs.organizationId))
        .innerJoin(talents, eq(talents.id, matches.talentId))
        .innerJoin(users, eq(users.id, talents.userId))
        .where(inArray(matches.id, ids))
        .orderBy(desc(matches.introductionRequestedAt));
      const pending = new Set(
        (
          await db
            .select({ id: approvalQueue.subjectId })
            .from(approvalQueue)
            .where(
              and(
                inArray(approvalQueue.subjectId, ids),
                eq(approvalQueue.action, 'introduce'),
                eq(approvalQueue.status, 'proposed'),
              ),
            )
        ).map((row) => row.id),
      );
      const deliveryStatuses = new Map(
        (
          await db
            .select({
              matchId: introductionDeliveries.matchId,
              status: introductionDeliveries.status,
            })
            .from(introductionDeliveries)
            .where(inArray(introductionDeliveries.matchId, ids))
        ).map((row) => [row.matchId, row.status]),
      );
      return ok(
        c,
        rows.map(({ match, card, city, name }) => ({
          matchId: match.id,
          needTitle: card?.title ?? 'İş birliği',
          summary: card?.summary ?? '',
          workMode: card?.workMode ?? null,
          compensation: card?.compensation ?? null,
          durationWeeks: card?.durationWeeks ?? null,
          party:
            user.role === 'talent'
              ? city
                ? `${city} konumunda bir kurum`
                : 'Bir kurum'
              : name.split(' ')[0],
          ownConsent: user.role === 'talent' ? match.talentConsent : match.organizationConsent,
          otherConsent: user.role === 'talent' ? match.organizationConsent : match.talentConsent,
          introduced: Boolean(match.introducedAt),
          deliveryStatus: deliveryStatuses.get(match.id) ?? null,
          closed: !pending.has(match.id) && !match.introducedAt,
        })),
      );
    })
    .post('/:id', async (c) => {
      const body = z
        .object({ accepted: z.boolean() })
        .safeParse(await c.req.json().catch(() => ({})));
      if (!body.success) throw new AppError('validation', 'Kararını seç', 422);
      const user = c.get('user');
      const matchId = c.req.param('id');
      if (!(await matchIdsFor(user.id, user.role)).includes(matchId))
        throw new AppError('not_found', 'Tanıştırma isteği bulunamadı', 404);
      await db.transaction(async (tx) => {
        // Keep lock order aligned with operator decisions: queue, then match.
        const items = await tx
          .select()
          .from(approvalQueue)
          .where(
            and(
              eq(approvalQueue.subjectId, matchId),
              eq(approvalQueue.action, 'introduce'),
              eq(approvalQueue.status, 'proposed'),
            ),
          )
          .for('update');
        const [match] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, matchId))
          .for('update');
        if (!match || match.introducedAt)
          throw new AppError(
            'already_introduced',
            'Tanıştırma tamamlandı; bu karar artık değiştirilemez',
            409,
          );
        if (
          match.talentConsent === 'declined' ||
          match.organizationConsent === 'declined' ||
          items.length === 0
        )
          throw new AppError('request_closed', 'Bu tanıştırma isteği kapandı', 409);
        const consent = body.data.accepted ? 'accepted' : 'declined';
        await tx
          .update(matches)
          .set({
            ...(user.role === 'talent'
              ? { talentConsent: consent }
              : { organizationConsent: consent }),
            updatedAt: new Date(),
          })
          .where(eq(matches.id, matchId));
        if (!body.data.accepted) {
          await tx
            .update(approvalQueue)
            .set({
              status: 'rejected',
              decidedBy: user.id,
              decidedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              inArray(
                approvalQueue.id,
                items.map((item) => item.id),
              ),
            );
        }
        await tx.insert(auditLog).values({
          actorId: user.id,
          action: `introduction.${consent}`,
          subjectType: 'match',
          subjectId: matchId,
          detail: { side: user.role },
        });
      });
      return ok(c, { saved: true });
    });
}
