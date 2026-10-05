import { describe, expect, it } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import {
  collaborations,
  matches,
  organizationMembers,
  organizations,
  talents,
  users,
} from '@evidex/db';
import { cookieOf, testApp } from '../test/setup';
import { DEMO_DOMAIN, seedDemoNetwork } from '../demo/network';

describe('hesabını sil (KVKK)', () => {
  it('genç kendi hesabını ve iş birliklerini siler; ortak kurum kalır; operatör silinemez', async () => {
    const { app, db, gonderilen } = testApp();
    await seedDemoNetwork(db);
    await db
      .insert(users)
      .values({ email: 'op-silme@girvak.org', name: 'Op', role: 'operator' })
      .onConflictDoNothing();
    await app.request('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'op-silme@girvak.org' }),
    });
    const path = gonderilen.at(-1)!.text.match(/\/api\/auth\/magic\/\S+/)![0];
    const op = cookieOf(await app.request(path, { redirect: 'manual' }), 'evidex_session');
    const girisAl = async (slug: string) => {
      const r = await app.request(`/api/operator/demo/login/${slug}`, {
        method: 'POST',
        headers: { cookie: op },
      });
      const url = (await r.json()).data.url as string;
      return cookieOf(
        await app.request(new URL(url).pathname, { redirect: 'manual' }),
        'evidex_session',
      );
    };
    const sil = (cookie: string) =>
      app.request('/api/me/account', { method: 'DELETE', headers: { cookie } });

    // Operatör hesabı bu yoldan silinmez.
    expect((await sil(op)).status).toBe(403);

    // Genç: Deniz'in Yeşil Adım ile tanıştırması var.
    const [deniz] = await db
      .select({ uid: users.id, tid: talents.id })
      .from(users)
      .innerJoin(talents, eq(talents.userId, users.id))
      .where(eq(users.email, `deniz${DEMO_DOMAIN}`));
    const denizIsBirlikleri = await db
      .select({ id: collaborations.id })
      .from(collaborations)
      .innerJoin(matches, eq(matches.id, collaborations.matchId))
      .where(eq(matches.talentId, deniz!.tid));
    expect(denizIsBirlikleri.length).toBeGreaterThan(0);
    const denizOturum = await girisAl('deniz');
    const r = await sil(denizOturum);
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie') ?? '').toContain('evidex_session=;');
    expect(await db.select().from(users).where(eq(users.id, deniz!.uid))).toHaveLength(0);
    expect(await db.select().from(talents).where(eq(talents.id, deniz!.tid))).toHaveLength(0);
    expect((await app.request('/api/auth/me', { headers: { cookie: denizOturum } })).status).toBe(
      401,
    );
    // Kurum kalır; iş birliği gencin eşleşmesiyle birlikte gider.
    const [yesil] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, 'Yeşil Adım Derneği'));
    expect(yesil).toBeDefined();
    expect(
      await db
        .select()
        .from(collaborations)
        .where(
          inArray(
            collaborations.id,
            denizIsBirlikleri.map((c) => c.id),
          ),
        ),
    ).toHaveLength(0);

    // Kurum: başka üyesi varken hesap silinse kurum kalır.
    const [kahveUye] = await db
      .select({ orgId: organizationMembers.organizationId })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(users.email, `kahve${DEMO_DOMAIN}`));
    const [ikinci] = await db
      .insert(users)
      .values({ email: 'ortak-uye@example.com', name: 'Ortak Üye', role: 'organization' })
      .returning();
    await db
      .insert(organizationMembers)
      .values({ organizationId: kahveUye!.orgId, userId: ikinci!.id });
    expect((await sil(await girisAl('kahve'))).status).toBe(200);
    expect(
      await db.select().from(organizations).where(eq(organizations.id, kahveUye!.orgId)),
    ).toHaveLength(1);
    await db.delete(users).where(eq(users.id, ikinci!.id));
  });
});
