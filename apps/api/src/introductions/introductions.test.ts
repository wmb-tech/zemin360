import { describe, expect, it } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import {
  approvalQueue,
  collaborations,
  introductionDeliveries,
  matches,
  needs,
  organizationMembers,
  organizations,
  shortlistEntries,
  talents,
  users,
} from '@evidex/db';
import { createAuthService } from '../auth/service';
import { testApp } from '../test/setup';
import { createFakeProvider } from '@evidex/ai';
import { createMatchingService } from '../matching/service';
import { createMetricsService } from '../metrics/service';
import { createIntroductionDeliveryService } from './deliveries';

async function fixture() {
  const { app, db, gonderilen } = testApp();
  const suffix = crypto.randomUUID();
  const [talentUser] = await db
    .insert(users)
    .values({ name: 'Consent Talent', email: `talent-${suffix}@example.com`, role: 'talent' })
    .returning();
  const [orgUser] = await db
    .insert(users)
    .values({
      name: 'Consent Organization',
      email: `org-${suffix}@example.com`,
      role: 'organization',
    })
    .returning();
  const [operator] = await db
    .insert(users)
    .values({ name: 'Consent Operator', email: `op-${suffix}@example.com`, role: 'operator' })
    .returning();
  const [talent] = await db
    .insert(talents)
    .values({ userId: talentUser!.id, cardStatus: 'approved' })
    .returning();
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Hidden Full Organization Name', city: 'İstanbul' })
    .returning();
  await db.insert(organizationMembers).values({ organizationId: org!.id, userId: orgUser!.id });
  const [need] = await db
    .insert(needs)
    .values({
      organizationId: org!.id,
      rawText: 'A project',
      cardStatus: 'approved',
      shortlistPublishedAt: new Date(),
      card: {
        title: 'Consent project',
        summary: 'A clearly scoped project',
        workMode: 'remote',
        durationWeeks: 4,
        collaborationType: 'project',
        expectedOutput: 'A delivered project',
        requiredSkills: [],
        niceToHaveSkills: [],
        compensation: null,
        worksWith: null,
        constraints: [],
      },
    })
    .returning();
  const [match] = await db
    .insert(matches)
    .values({
      needId: need!.id,
      talentId: talent!.id,
      rank: 1,
      strength: 'possible',
      reasoning: { fits: [], gaps: [], summaryForOrganization: 'A potential match.' },
    })
    .returning();
  const auth = createAuthService(db);
  async function session(email: string) {
    return `evidex_session=${(await auth.consumeMagicLink(await auth.requestMagicLink(email))).sessionToken}`;
  }
  const talentCookie = await session(talentUser!.email);
  const orgCookie = await session(orgUser!.email);
  const opCookie = await session(operator!.email);
  async function post(path: string, body: unknown, cookie: string) {
    return app.request(path, {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  const request = await post(
    `/api/operator/matches/${match!.id}/introduce`,
    {
      subject: 'Consent project introduction',
      message: 'This is the reviewed introduction draft.',
    },
    opCookie,
  );
  expect(request.status).toBe(201);
  const queueId = (await request.json()).data.id as string;
  return {
    app,
    db,
    gonderilen,
    talentCookie,
    orgCookie,
    opCookie,
    matchId: match!.id,
    needId: need!.id,
    queueId,
    operatorId: operator!.id,
    post,
    orgUser,
  };
}

describe('mutual introduction consent', () => {
  it('does not send an email when the approval transaction fails after preparing delivery', async () => {
    const f = await fixture();
    await f.post(`/api/introductions/${f.matchId}`, { accepted: true }, f.talentCookie);
    await f.post(`/api/introductions/${f.matchId}`, { accepted: true }, f.orgCookie);
    const constraint = `reject_test_approval_${f.matchId.replaceAll('-', '')}`;
    await f.db.execute(
      sql.raw(
        `ALTER TABLE audit_log ADD CONSTRAINT "${constraint}" CHECK (action != 'approval.approved' OR subject_id != '${f.matchId}'::uuid) NOT VALID`,
      ),
    );
    const before = f.gonderilen.length;
    try {
      expect(
        (await f.post(`/api/operator/queue/${f.queueId}`, { decision: 'approve' }, f.opCookie))
          .status,
      ).toBe(500);
      expect(f.gonderilen.length).toBe(before);
      expect(
        (
          await f.db
            .select()
            .from(introductionDeliveries)
            .where(eq(introductionDeliveries.queueId, f.queueId))
        ).length,
      ).toBe(0);
      expect(
        (await f.db.select().from(matches).where(eq(matches.id, f.matchId)))[0]!.introducedAt,
      ).toBeNull();
      expect(
        (await f.db.select().from(approvalQueue).where(eq(approvalQueue.id, f.queueId)))[0]!.status,
      ).toBe('proposed');
    } finally {
      await f.db.execute(sql.raw(`ALTER TABLE audit_log DROP CONSTRAINT "${constraint}"`));
    }
    expect(
      (await f.post(`/api/operator/queue/${f.queueId}`, { decision: 'approve' }, f.opCookie))
        .status,
    ).toBe(200);
    expect(f.gonderilen.length - before).toBe(2);
  });

  it('keeps published conversion history and existing introductions during a new review', async () => {
    const f = await fixture();
    await f.post(`/api/introductions/${f.matchId}`, { accepted: true }, f.talentCookie);
    await f.post(`/api/introductions/${f.matchId}`, { accepted: true }, f.orgCookie);
    await f.post(`/api/operator/queue/${f.queueId}`, { decision: 'approve' }, f.opCookie);
    await f.db
      .update(collaborations)
      .set({ status: 'meeting' })
      .where(eq(collaborations.matchId, f.matchId));
    const previous = await f.db.select().from(matches).where(eq(matches.id, f.matchId));
    await f.db
      .insert(shortlistEntries)
      .values({ needId: f.needId, talentId: previous[0]!.talentId, matchId: f.matchId, rank: 1 });
    for (let rank = 2; rank <= 5; rank++) {
      const [user] = await f.db
        .insert(users)
        .values({
          name: 'Historic candidate',
          role: 'talent',
          email: `historic-${crypto.randomUUID()}@example.com`,
        })
        .returning();
      const [talent] = await f.db.insert(talents).values({ userId: user!.id }).returning();
      const [match] = await f.db
        .insert(matches)
        .values({
          needId: f.needId,
          talentId: talent!.id,
          rank,
          strength: 'weak',
          reasoning: {},
          shortlistedAt: new Date(),
        })
        .returning();
      await f.db
        .insert(shortlistEntries)
        .values({ needId: f.needId, talentId: talent!.id, matchId: match!.id, rank });
    }
    const metrics = createMetricsService(f.db);
    const before = await metrics.summary();
    const [user] = await f.db
      .insert(users)
      .values({
        name: 'Fresh candidate',
        role: 'talent',
        email: `fresh-${crypto.randomUUID()}@example.com`,
      })
      .returning();
    const [talent] = await f.db
      .insert(talents)
      .values({ userId: user!.id, cardStatus: 'approved' })
      .returning();
    const matching = createMatchingService(
      f.db,
      createFakeProvider({
        value: {
          results: [
            {
              talentId: talent!.id,
              strength: 'possible',
              fits: [],
              gaps: [],
              summaryForOrganization: 'A new candidate.',
            },
          ],
        },
      }),
    );
    await matching.runForNeed(f.needId);
    const after = await metrics.summary();
    expect(after.topFiveConversion).toEqual(before.topFiveConversion);
    const candidates = await matching.candidatesForNeed(f.needId);
    expect(candidates.published).toBe(false);
    expect(candidates.candidates.map((candidate) => candidate.matchId)).toEqual([f.matchId]);
  });

  it('does not automatically resend an ambiguous SMTP delivery', async () => {
    const f = await fixture();
    const [delivery] = await f.db
      .insert(introductionDeliveries)
      .values({
        queueId: f.queueId,
        matchId: f.matchId,
        recipients: [f.orgUser!.email],
        subject: 'Delivery test',
        message: 'A reviewed message.',
      })
      .returning();
    let attempts = 0;
    let fail = true;
    const service = createIntroductionDeliveryService(f.db, {
      async send() {
        attempts++;
        if (fail) throw new Error('Simulated SMTP interruption');
      },
    });
    await service.send(f.queueId);
    expect(await service.status(f.queueId)).toBe('uncertain');
    await service.drain();
    await service.send(f.queueId);
    expect(attempts).toBe(1);
    fail = false;
    await service.retry(delivery!.id, f.operatorId);
    expect(attempts).toBe(2);
    expect(await service.status(f.queueId)).toBe('sent');
  });

  it('counts an introduction only after confirmed delivery', async () => {
    const f = await fixture();
    const metrics = createMetricsService(f.db);
    await f.db
      .update(needs)
      .set({ cardApprovedAt: new Date(Date.now() - 3_600_000) })
      .where(eq(needs.id, f.needId));
    await f.db.insert(shortlistEntries).values({
      needId: f.needId,
      talentId: (await f.db.select().from(matches).where(eq(matches.id, f.matchId)))[0]!.talentId,
      matchId: f.matchId,
      rank: 1,
    });
    const before = await metrics.summary();
    await f.db.update(matches).set({ introducedAt: new Date() }).where(eq(matches.id, f.matchId));
    await f.db.insert(introductionDeliveries).values({
      queueId: f.queueId,
      matchId: f.matchId,
      recipients: [f.orgUser!.email],
      subject: 'Metrics delivery',
      message: 'Reviewed',
      status: 'uncertain',
    });
    const uncertain = await metrics.summary();
    expect(uncertain.topFiveConversion).toEqual(before.topFiveConversion);
    expect(uncertain.timeToIntroduction).toEqual(before.timeToIntroduction);
    const deliveries = createIntroductionDeliveryService(f.db, { async send() {} });
    const [record] = await f.db
      .select()
      .from(introductionDeliveries)
      .where(eq(introductionDeliveries.queueId, f.queueId));
    const list = await deliveries.list();
    expect(list.some((item) => item.id === record!.id)).toBe(true);
    const firstSentIndex = list.findIndex((item) => item.status === 'sent');
    expect(
      firstSentIndex === -1 || list.findIndex((item) => item.id === record!.id) < firstSentIndex,
    ).toBe(true);
    await deliveries.retry(record!.id, f.operatorId);
    const sent = await metrics.summary();
    expect(sent.topFiveConversion.introduced).toBe(before.topFiveConversion.introduced + 1);
    expect(sent.timeToIntroduction.needsWithIntroduction).toBe(
      before.timeToIntroduction.needsWithIntroduction + 1,
    );
  });

  it('keeps identity private and blocks execution until both parties accept', async () => {
    const f = await fixture();
    const list = await f.app.request('/api/introductions', { headers: { cookie: f.talentCookie } });
    const data = await list.json();
    expect(data.data[0].party).toBe('İstanbul konumunda bir kurum');
    expect(JSON.stringify(data)).not.toContain('Hidden Full Organization Name');
    expect(JSON.stringify(data)).not.toContain('@example.com');
    const before = f.gonderilen.length;
    expect(
      (await f.post(`/api/operator/queue/${f.queueId}`, { decision: 'approve' }, f.opCookie))
        .status,
    ).toBe(409);
    expect(
      (await f.post(`/api/introductions/${f.matchId}`, { accepted: true }, f.talentCookie)).status,
    ).toBe(200);
    expect(
      (await f.post(`/api/operator/queue/${f.queueId}`, { decision: 'approve' }, f.opCookie))
        .status,
    ).toBe(409);
    expect(f.gonderilen.length).toBe(before);
    expect(
      (await f.post(`/api/introductions/${f.matchId}`, { accepted: true }, f.orgCookie)).status,
    ).toBe(200);
    const results = await Promise.all([
      f.post(`/api/operator/queue/${f.queueId}`, { decision: 'approve' }, f.opCookie),
      f.post(`/api/operator/queue/${f.queueId}`, { decision: 'approve' }, f.opCookie),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(f.gonderilen.length - before).toBe(2);
    expect(
      (await f.db.select().from(collaborations).where(eq(collaborations.matchId, f.matchId)))
        .length,
    ).toBe(1);
    expect(
      (await f.post(`/api/introductions/${f.matchId}`, { accepted: false }, f.talentCookie)).status,
    ).toBe(409);
  });

  it('withdrawal closes the request and rejects the pending queue action', async () => {
    const f = await fixture();
    await f.post(`/api/introductions/${f.matchId}`, { accepted: true }, f.talentCookie);
    const before = f.gonderilen.length;
    expect(
      (await f.post(`/api/introductions/${f.matchId}`, { accepted: false }, f.talentCookie)).status,
    ).toBe(200);
    expect(
      (await f.post(`/api/operator/queue/${f.queueId}`, { decision: 'approve' }, f.opCookie))
        .status,
    ).toBe(409);
    expect(
      (await f.post(`/api/introductions/${f.matchId}`, { accepted: true }, f.orgCookie)).status,
    ).toBe(409);
    expect(f.gonderilen.length).toBe(before);
    expect(
      (await f.db.select().from(approvalQueue).where(eq(approvalQueue.id, f.queueId)))[0]!.status,
    ).toBe('rejected');
  });

  it('an unrelated account cannot read or accept someone else’s request', async () => {
    const f = await fixture();
    const auth = createAuthService(f.db);
    const session = await auth.consumeMagicLink(
      await auth.requestMagicLink(`other-${crypto.randomUUID()}@example.com`, 'talent'),
    );
    const cookie = `evidex_session=${session.sessionToken}`;
    expect(
      (await (await f.app.request('/api/introductions', { headers: { cookie } })).json()).data,
    ).toEqual([]);
    expect(
      (await f.post(`/api/introductions/${f.matchId}`, { accepted: true }, cookie)).status,
    ).toBe(404);
  });
});
