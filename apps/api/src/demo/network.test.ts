import { describe, expect, it } from 'bun:test';
import { eq, like } from 'drizzle-orm';
import { cardClaims, collaborations, matches, needs, talents, users } from '@evidex/db';
import { testApp } from '../test/setup';
import {
  DEMO_DOMAIN,
  DEMO_TALENTS,
  demoStatus,
  removeDemoNetwork,
  seedDemoNetwork,
} from './network';

describe('demo ağı', () => {
  it('yükleme idempotent; kartlar onaylı ve kanıta bağlı; kaldırma yalnız demoya dokunur', async () => {
    const { db } = testApp();
    // Gerçek bir kullanıcı: kaldırma ona dokunmamalı.
    const [gercek] = await db
      .insert(users)
      .values({ email: 'gercek-genc@example.com', name: 'Gerçek Genç', role: 'talent' })
      .returning();
    await db.insert(talents).values({ userId: gercek!.id });

    const ilk = await seedDemoNetwork(db);
    expect(ilk).toEqual({ talents: DEMO_TALENTS.length, organizations: 2 });
    expect(await seedDemoNetwork(db)).toEqual(ilk); // ikinci basış kopya üretmez

    const [elif] = await db
      .select({ id: talents.id, status: talents.cardStatus })
      .from(talents)
      .innerJoin(users, eq(users.id, talents.userId))
      .where(eq(users.email, `elif${DEMO_DOMAIN}`));
    expect(elif!.status).toBe('approved');
    const iddialar = await db.select().from(cardClaims).where(eq(cardClaims.talentId, elif!.id));
    expect(iddialar.length).toBeGreaterThan(0);
    expect(iddialar.every((c) => c.approved && c.sourceIds.length > 0)).toBe(true);
    const demoIhtiyac = await db.select().from(needs).where(eq(needs.cardStatus, 'approved'));
    expect(demoIhtiyac.length).toBeGreaterThanOrEqual(2);
    // Takip gösterimi için Deniz × Yeşil Adım 4 gün önce tanıştırılmış bir iş birliği hazır.
    const demoIsBirligi = () =>
      db
        .select({ id: collaborations.id, introducedAt: matches.introducedAt })
        .from(collaborations)
        .innerJoin(matches, eq(matches.id, collaborations.matchId))
        .innerJoin(talents, eq(talents.id, matches.talentId))
        .innerJoin(users, eq(users.id, talents.userId))
        .where(eq(users.email, `deniz${DEMO_DOMAIN}`));
    const [ib] = await demoIsBirligi();
    expect(Date.now() - ib!.introducedAt!.getTime()).toBeGreaterThan(3.5 * 24 * 3600 * 1000);

    expect(await removeDemoNetwork(db)).toEqual({ talents: 0, organizations: 0 });
    expect(await demoIsBirligi()).toHaveLength(0);
    expect(await demoStatus(db)).toEqual({ talents: 0, organizations: 0 });
    expect(
      await db
        .select()
        .from(users)
        .where(like(users.email, `%${DEMO_DOMAIN}`)),
    ).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, gercek!.id))).toHaveLength(1);
  });
});
