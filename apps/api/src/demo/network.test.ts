import { describe, expect, it } from 'bun:test';
import { eq, like } from 'drizzle-orm';
import { cardClaims, collaborations, demoMail, matches, needs, talents, users } from '@evidex/db';
import type { EmailSender } from '../lib/email';
import { cookieOf, testApp } from '../test/setup';
import {
  DEMO_DOMAIN,
  DEMO_TALENTS,
  demoStatus,
  removeDemoNetwork,
  seedDemoNetwork,
  withDemoInbox,
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
    expect(ilk).toMatchObject({ talents: DEMO_TALENTS.length, organizations: 2 });
    expect(ilk.accounts.map((a) => a.slug)).toContain('kahve');
    expect(await seedDemoNetwork(db)).toMatchObject({
      talents: DEMO_TALENTS.length,
      organizations: 2,
    }); // ikinci basış kopya üretmez

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

    expect(await removeDemoNetwork(db)).toMatchObject({ talents: 0, organizations: 0 });
    expect(await demoIsBirligi()).toHaveLength(0);
    expect(await demoStatus(db)).toMatchObject({ talents: 0, organizations: 0 });
    expect(
      await db
        .select()
        .from(users)
        .where(like(users.email, `%${DEMO_DOMAIN}`)),
    ).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, gercek!.id))).toHaveLength(1);
  });

  it('operatör yalnız demo hesabı için giriş bağlantısı üretir; gerçek kullanıcı ve kurum için asla', async () => {
    const { app, db, gonderilen } = testApp();
    await seedDemoNetwork(db);
    await db
      .insert(users)
      .values({ email: 'op-demo@girvak.org', name: 'Op', role: 'operator' })
      .onConflictDoNothing();
    const oturumAc = async (email: string) => {
      await app.request('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const path = gonderilen.at(-1)!.text.match(/\/api\/auth\/magic\/\S+/)![0];
      return cookieOf(await app.request(path, { redirect: 'manual' }), 'evidex_session');
    };
    const op = await oturumAc('op-demo@girvak.org');
    const al = (slug: string, cookie: string) =>
      app.request(`/api/operator/demo/login/${slug}`, { method: 'POST', headers: { cookie } });

    const r = await al('kahve', op);
    expect(r.status).toBe(200);
    const url = (await r.json()).data.url as string;
    // Bağlantı demo kuruma oturum açar.
    const giris = await app.request(new URL(url).pathname, { redirect: 'manual' });
    const kurum = cookieOf(giris, 'evidex_session');
    const me = (await (await app.request('/api/auth/me', { headers: { cookie: kurum } })).json())
      .data;
    expect(me.email).toBe(`kahve${DEMO_DOMAIN}`);

    // Gerçek kullanıcı adına üretilemez; demo olmayan e-posta "bulunamadı".
    expect((await al('op-demo', op)).status).toBe(404);
    expect((await al('../gercek', op)).status).toBe(404);
    // Operatör olmayan üretemez.
    expect((await al('kahve', kurum)).status).toBe(403);
    await removeDemoNetwork(db);
  });

  it("demo adrese giden e-posta kutuya yazılır, SMTP'ye çıkmaz; gerçek alıcı yine alır", async () => {
    const { db } = testApp();
    const giden: (string | string[])[] = [];
    const inner: EmailSender = { send: async (m) => void giden.push(m.to) };
    const posta = withDemoInbox(db, inner);
    await posta.send({
      to: [`kahve${DEMO_DOMAIN}`, `elif${DEMO_DOMAIN}`],
      subject: 'Tanıştırma',
      text: 'a',
    });
    await posta.send({
      to: ['gercek@example.com', `kahve${DEMO_DOMAIN}`],
      subject: 'Karışık',
      text: 'b',
    });
    await posta.send({ to: 'gercek@example.com', subject: 'Gerçek', text: 'c' });
    expect(giden).toEqual([['gercek@example.com'], 'gercek@example.com']);
    const kutu = await db.select().from(demoMail);
    expect(kutu.map((m) => m.subject).sort()).toEqual(['Karışık', 'Tanıştırma']);
    await seedDemoNetwork(db);
    await removeDemoNetwork(db);
    expect(await db.select().from(demoMail)).toHaveLength(0);
  });
});
