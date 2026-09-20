import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { cardClaims, talents, users } from '@evidex/db';
import { cookieOf, testApp } from '../test/setup';

const json = (body: unknown, cookie?: string) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

async function oturum(
  app: ReturnType<typeof testApp>['app'],
  gonderilen: { text: string }[],
  email: string,
) {
  await app.request('/api/auth/magic-link', json({ email }));
  const path = gonderilen.at(-1)!.text.match(/\/api\/auth\/magic\/\S+/)![0];
  return cookieOf(await app.request(path, { redirect: 'manual' }), 'evidex_session');
}

describe('keşfet (01): paylaşılabilir kart + kulüp kanalı', () => {
  it('kart onaysızken paylaşılamaz; paylaşınca herkese açık uçta yalnız onaylı iddialar, kimlik yok; kapatınca link ölür', async () => {
    const { app, db, gonderilen } = testApp({
      githubProfile: { id: 811, login: 'kerem', name: 'Kerem Uslu', email: 'kerem811@example.com' },
    });
    const genc = cookieOf(
      await app.request('/api/auth/github/callback?code=x&state=s9', {
        headers: { cookie: 'evidex_oauth_state=s9' },
        redirect: 'manual',
      }),
      'evidex_session',
    );
    expect((await app.request('/api/me/card/share', json({ enabled: true }, genc))).status).toBe(
      409,
    );

    // Onaylı ve onaysız iddia; kart onayı.
    const [u] = await db.select().from(users).where(eq(users.githubId, '811'));
    const [t] = await db.select().from(talents).where(eq(talents.userId, u!.id));
    await db.insert(cardClaims).values([
      { talentId: t!.id, text: 'Onaylı: React ile canlı site', level: 'verified', approved: true },
      { talentId: t!.id, text: 'Taslak: gizli kalmalı', level: 'declared', approved: false },
    ]);
    await app.request('/api/me/card/approve', json({}, genc));

    const { publicSlug } = (
      await (await app.request('/api/me/card/share', json({ enabled: true }, genc))).json()
    ).data;
    expect(typeof publicSlug).toBe('string');

    const acik = await app.request(`/api/cards/${publicSlug}`);
    expect(acik.status).toBe(200);
    const kart = (await acik.json()).data;
    expect(kart.name).toBe('Kerem Uslu');
    expect(kart.claims).toHaveLength(1);
    expect(kart.claims[0].text).toContain('Onaylı');
    expect(JSON.stringify(kart)).not.toContain('kerem811@example.com');
    expect(JSON.stringify(kart)).not.toContain('"githubLogin"');

    await app.request('/api/me/card/share', json({ enabled: false }, genc));
    expect((await app.request(`/api/cards/${publicSlug}`)).status).toBe(404);
    expect(gonderilen.length).toBe(0);
  });

  it('kulüp listesi: ağdakiler elenir, hepsi ağdaysa 422, onayla davet e-postaları gider', async () => {
    const { app, db, gonderilen } = testApp();
    await db
      .insert(users)
      .values([
        { email: 'op6@girvak.org', name: 'Op', role: 'operator' },
        { email: 'zaten@uye.com', name: 'Üye', role: 'talent', githubId: 'gh-zaten' },
      ])
      .onConflictDoNothing();
    const op = await oturum(app, gonderilen, 'op6@girvak.org');

    expect(
      (
        await app.request(
          '/api/operator/invites',
          json(
            {
              emails: ['zaten@uye.com'],
              source: 'Kulüp',
              message: 'Sizi Evidex ağına davet ediyoruz.',
            },
            op,
          ),
        )
      ).status,
    ).toBe(422);

    const oneri = await app.request(
      '/api/operator/invites',
      json(
        {
          emails: ['zaten@uye.com', 'yeni1@uni.edu.tr', 'yeni2@uni.edu.tr', 'yeni2@uni.edu.tr'],
          source: 'İTÜ Bilgisayar Kulübü',
          message: 'GİRVAK ağında kanıta dayalı kartınızı açın; kurum ihtiyaçlarıyla eşleşin.',
        },
        op,
      ),
    );
    expect(oneri.status).toBe(201);
    const kayit = (await oneri.json()).data;
    expect(kayit.payload.emails).toEqual(['yeni1@uni.edu.tr', 'yeni2@uni.edu.tr']);
    expect(kayit.payload.skipped).toBe(2);

    const onceki = gonderilen.length;
    expect(
      (await app.request(`/api/operator/queue/${kayit.id}`, json({ decision: 'approve' }, op)))
        .status,
    ).toBe(200);
    const gidenler = gonderilen.slice(onceki);
    expect(gidenler.map((m) => m.to).sort()).toEqual(['yeni1@uni.edu.tr', 'yeni2@uni.edu.tr']);
    expect(gidenler[0]!.text).toContain('GitHub ile giriş');
  });
});
