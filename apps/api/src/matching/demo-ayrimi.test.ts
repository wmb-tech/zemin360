import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { needs, organizationMembers, organizations, users } from '@evidex/db';
import type { LlmProvider } from '@evidex/ai';
import { testApp } from '../test/setup';
import { createMatchingService } from './service';
import { removeDemoNetwork, seedDemoNetwork } from '../demo/network';

/** Ajana giden aday listesini yakalayan sağlayıcı: kimin aday gösterildiğini ölçer. */
function yakalayan() {
  const istemler: string[] = [];
  const llm: LlmProvider = {
    name: 'yakalayan',
    async complete() {
      return {
        text: '',
        usage: { inputTokens: 0, outputTokens: 0, model: 'x', provider: 'x', durationMs: 0 },
      };
    },
    async structured(messages, schema) {
      istemler.push(messages.map((m) => m.content).join('\n'));
      return {
        value: schema.parse({ results: [] }),
        usage: { inputTokens: 0, outputTokens: 0, model: 'x', provider: 'x', durationMs: 0 },
      };
    },
  };
  return { llm, istemler };
}

describe('demo ayrımı', () => {
  it('gerçek kurumun ihtiyacına kurgusal demo genci aday gösterilmez; demo kurumunkine gösterilir', async () => {
    const { db } = testApp();
    await seedDemoNetwork(db);
    const [kurum] = await db.insert(organizations).values({ name: 'Gerçek Kurum' }).returning();
    const [uye] = await db
      .insert(users)
      .values({ email: 'gercek-kurum@example.com', name: 'Gerçek', role: 'organization' })
      .returning();
    await db.insert(organizationMembers).values({ organizationId: kurum!.id, userId: uye!.id });
    const kart = {
      title: 'Web paneli',
      summary: 'Sipariş paneli',
      collaborationType: 'project',
      workMode: 'remote',
      durationWeeks: 8,
      compensation: null,
      expectedOutput: 'Panel',
      requiredSkills: ['TypeScript'],
      niceToHaveSkills: [],
      constraints: [],
      worksWith: null,
    };
    const [gercekIhtiyac] = await db
      .insert(needs)
      .values({
        organizationId: kurum!.id,
        rawText: 'x',
        card: kart,
        turns: [],
        cardStatus: 'approved',
      })
      .returning();
    const { llm, istemler } = yakalayan();
    const eslestirme = createMatchingService(db, llm);
    await eslestirme.runForNeed(gercekIhtiyac!.id);
    expect(istemler.at(-1) ?? '').not.toContain('Elif Karaca');

    const [demoIhtiyac] = await db
      .select({ id: needs.id })
      .from(needs)
      .innerJoin(organizations, eq(organizations.id, needs.organizationId))
      .where(eq(organizations.name, 'Anadolu Kahve Evleri'))
      .limit(1);
    await eslestirme.runForNeed(demoIhtiyac!.id);
    expect(istemler.at(-1)).toContain('Elif Karaca');

    await db.delete(organizations).where(eq(organizations.id, kurum!.id));
    await db.delete(users).where(eq(users.id, uye!.id));
    await removeDemoNetwork(db);
  });
});
