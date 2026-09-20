import { Hono } from 'hono';
import { z } from 'zod';
import { withRole } from '../auth/middleware';
import type { AuthService } from '../auth/service';
import type { MatchingService } from '../matching/service';
import { AppError, ok } from '../lib/response';
import type { OperatorService } from './service';
import type { createMetricsService } from '../metrics/service';
import type { FollowUpService } from '../followups/service';
import type { ScoutingService } from '../scouting/service';
import { CollaborationStatus } from '@evidex/shared';

const DecideBody = z.object({
  decision: z.enum(['approve', 'reject', 'edit']),
  editedPayload: z.record(z.string(), z.unknown()).optional(),
});
const InviteBody = z.object({
  emails: z.array(z.string().email()).min(1).max(200),
  source: z.string().min(2).max(120), // "Boğaziçi Yazılım Kulübü", "Hackathon X"
  message: z.string().min(20).max(2000),
});
const IntroBody = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(4000),
});

async function parse<T>(schema: z.ZodType<T>, raw: unknown): Promise<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError('validation', 'Geçersiz istek', 422, r.error.issues);
  return r.data;
}

export function operatorRoutes(
  auth: AuthService,
  ops: OperatorService,
  matching: MatchingService,
  metrics: ReturnType<typeof createMetricsService>,
  followUp: FollowUpService,
  scouting: ScoutingService,
) {
  return (
    new Hono()
      .use('*', withRole(auth, 'operator'))
      .get('/queue', async (c) => ok(c, await ops.queue()))
      .post('/queue/:id', async (c) => {
        const body = await parse(DecideBody, await c.req.json().catch(() => ({})));
        return ok(
          c,
          await ops.decide(c.get('user').id, c.req.param('id'), body.decision, body.editedPayload),
        );
      })
      .post('/needs/:id/match', async (c) => ok(c, await matching.runForNeed(c.req.param('id'))))
      .get('/needs/:id/matches', async (c) =>
        ok(c, await matching.matchesForNeed(c.req.param('id'))),
      )
      .get('/metrics', async (c) => ok(c, await metrics.summary()))
      .post('/collaborations/:matchId/status', async (c) => {
        const body = await parse(
          z.object({ status: CollaborationStatus }),
          await c.req.json().catch(() => ({})),
        );
        return ok(
          c,
          await ops.setCollaborationStatus(c.get('user').id, c.req.param('matchId'), body.status),
        );
      })
      // İzle (06): iş birliği listesi + takip taraması (zamanlayıcı da aynı fonksiyonu çağırır)
      .get('/collaborations', async (c) => ok(c, await followUp.list()))
      .post('/follow-ups/scan', async (c) => ok(c, await followUp.scan()))
      // Keşfet (01): operatörün ihtiyaç listesi + ağ dışı keşif (GitHub → ajan → davet kuyruğu)
      .get('/needs', async (c) => ok(c, await scouting.needsForOperator()))
      .post('/needs/:id/scout', async (c) => ok(c, await scouting.scoutForNeed(c.req.param('id'))))
      // Keşfet (01): kulüp kanalı — liste kuyruğa, onayla davet gider
      .post('/invites', async (c) => {
        const body = await parse(InviteBody, await c.req.json().catch(() => ({})));
        return ok(c, await ops.proposeInvites(body), 201);
      })
      .post('/matches/:id/introduce', async (c) => {
        const body = await parse(IntroBody, await c.req.json().catch(() => ({})));
        return ok(c, await ops.proposeIntroduction(c.req.param('id'), body), 201);
      })
  );
}
