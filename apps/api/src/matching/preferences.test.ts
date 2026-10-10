import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import {
  cardClaims,
  collaborations,
  matches,
  needs,
  organizations,
  talents,
  users,
} from '@evidex/db';
import { createFakeProvider } from '@evidex/ai';
import { TalentPreferences, type NeedCard } from '@evidex/shared';
import { createMatchingService } from './service';
import { createAuthService } from '../auth/service';
import { testApp } from '../test/setup';

const card: NeedCard = {
  title: 'Preference project',
  summary: 'A remote development project lasting twelve weeks.',
  collaborationType: 'project',
  expectedOutput: 'An application',
  durationWeeks: 12,
  workMode: 'remote',
  compensation: null,
  requiredSkills: [],
  niceToHaveSkills: [],
  worksWith: null,
  constraints: [],
};

describe('working preferences and shortlist refresh', () => {
  it('filters unavailable or incompatible candidates before their profiles reach the model', async () => {
    const { db, app } = testApp();
    const suffix = crypto.randomUUID();
    const [user] = await db
      .insert(users)
      .values({
        email: `preferences-${suffix}@example.com`,
        name: 'Preference Talent',
        role: 'talent',
      })
      .returning();
    const [talent] = await db
      .insert(talents)
      .values({ userId: user!.id, cardStatus: 'approved' })
      .returning();
    await db.insert(cardClaims).values({
      talentId: talent!.id,
      text: 'A sustained software project',
      level: 'declared',
      approved: true,
    });
    const [org] = await db
      .insert(organizations)
      .values({ name: 'Preference Organization' })
      .returning();
    const [need] = await db
      .insert(needs)
      .values({ organizationId: org!.id, rawText: card.summary, card, cardStatus: 'approved' })
      .returning();
    const llm = createFakeProvider({
      value: {
        results: [
          {
            talentId: talent!.id,
            strength: 'possible',
            fits: [],
            gaps: [],
            summaryForOrganization: 'Possible candidate.',
          },
        ],
      },
    });
    const original = llm.structured.bind(llm);
    let sentProfile = false;
    llm.structured = async (...args) => {
      sentProfile = JSON.stringify(args[0]).includes(talent!.id);
      return original(...args);
    };
    const matching = createMatchingService(db, llm);
    for (const patch of [
      { availability: 'unavailable' },
      { collaborationTypes: ['internship'] },
      { workModes: ['onsite'] },
      { maxDurationWeeks: 8 },
    ]) {
      await db
        .update(talents)
        .set({ preferences: TalentPreferences.parse(patch) })
        .where(eq(talents.id, talent!.id));
      sentProfile = false;
      const result = await matching.runForNeed(need!.id);
      expect(result.matches.some((match) => match.talentId === talent!.id)).toBe(false);
      expect(sentProfile).toBe(false);
    }
    const auth = createAuthService(db);
    const session = await auth.consumeMagicLink(await auth.requestMagicLink(user!.email));
    const cookie = `evidex_session=${session.sessionToken}`;
    const save = (body: unknown) =>
      app.request('/api/me/preferences', {
        method: 'PUT',
        headers: { cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await save({ weeklyHours: 1000 })).status).toBe(422);
    expect(
      (await save(TalentPreferences.parse({ weeklyHours: 20, availability: 'limited' }))).status,
    ).toBe(200);
    const result = await matching.runForNeed(need!.id);
    expect(result.matches.some((match) => match.talentId === talent!.id)).toBe(true);
    expect(sentProfile).toBe(true);
    const [storedNeed] = await db.select().from(needs).where(eq(needs.id, need!.id));
    expect(storedNeed!.shortlistPublishedAt).toBeNull();
  });

  it('retains an introduced match and its collaboration when rerunning produces no candidates', async () => {
    const { db } = testApp();
    const [user] = await db
      .insert(users)
      .values({
        email: `retained-${crypto.randomUUID()}@example.com`,
        name: 'Retained Talent',
        role: 'talent',
      })
      .returning();
    const [talent] = await db.insert(talents).values({ userId: user!.id }).returning();
    const [org] = await db
      .insert(organizations)
      .values({ name: 'Retained Organization' })
      .returning();
    const [need] = await db
      .insert(needs)
      .values({
        organizationId: org!.id,
        rawText: card.summary,
        card,
        cardStatus: 'approved',
        shortlistPublishedAt: new Date(),
      })
      .returning();
    const [match] = await db
      .insert(matches)
      .values({
        needId: need!.id,
        talentId: talent!.id,
        rank: 1,
        strength: 'possible',
        reasoning: {},
        introducedAt: new Date(),
      })
      .returning();
    await db.insert(collaborations).values({ matchId: match!.id, status: 'ongoing' });
    const matching = createMatchingService(db, createFakeProvider({ value: { results: [] } }));
    await matching.runForNeed(need!.id);
    expect((await db.select().from(matches).where(eq(matches.id, match!.id))).length).toBe(1);
    expect(
      (await db.select().from(collaborations).where(eq(collaborations.matchId, match!.id)))[0]!
        .status,
    ).toBe('ongoing');
  });
});
