import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '@evidex/ai';
import { cardClaims, talents, users } from '@evidex/db';
import { cookieOf, testApp } from '../test/setup';

const json = (body: unknown, cookie?: string) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

const tamKart = {
  title: 'Mobil uygulama',
  summary: 'Mevcut web mağazasının React Native ile mobil uygulaması.',
  collaborationType: 'project',
  expectedOutput: 'Mağazalarda yayınlanmış uygulama',
  workMode: 'remote',
  requiredSkills: ['React Native'],
  niceToHaveSkills: [],
  constraints: [],
  durationWeeks: 12,
  compensation: null,
  worksWith: null,
};

async function oturum(
  app: ReturnType<typeof testApp>['app'],
  gonderilen: { text: string }[],
  email: string,
) {
  await app.request('/api/auth/magic-link', json({ email }));
  const path = gonderilen.at(-1)!.text.match(/\/api\/auth\/magic\/\S+/)![0];
  return cookieOf(await app.request(path, { redirect: 'manual' }), 'evidex_session');
}

describe('eşleştir + onay kuyruğu', () => {
  it('onay → kısa liste kuyrukta → operatör yayınlar → kurum özet görür → tanıştırma e-postası gider', async () => {
    // Onaylı bir genç kartı (iddialarıyla) doğrudan DB'ye.
    const { db } = testApp();
    const [gencUser] = await db
      .insert(users)
      .values({
        email: 'ayse@example.com',
        name: 'Ayşe Yılmaz',
        role: 'talent',
        githubId: 'gh-ayse',
        githubLogin: 'ayse',
      })
      .returning();
    const [genc] = await db
      .insert(talents)
      .values({
        userId: gencUser!.id,
        headline: 'Mobil geliştirici',
        cardStatus: 'approved',
        cardApprovedAt: new Date(),
      })
      .returning();
    const [iddia] = await db
      .insert(cardClaims)
      .values({
        talentId: genc!.id,
        text: 'React Native ile 8 aydır sürdürülen mağaza uygulaması',
        level: 'verified',
        approved: true,
        periodStart: '2026-01-01',
      })
      .returning();

    const llm = createFakeProvider({
      bySchema: {
        need_step: { draft: tamKart, missing: [], done: true, nextQuestion: null },
        intro_draft: {
          subject: 'Tanıştırma: Firma · Ayşe Yılmaz · Mobil uygulama',
          message:
            "Merhaba, mağaza için mobil uygulama ihtiyacınızla Ayşe'yi tanıştırmak istedik. Sekiz aydır sürdürdüğü canlı bir React Native uygulaması var. Önerimiz 30 dakikalık bir tanışma görüşmesi; tarihi siz belirleyin. Üç gün sonra kısa bir takip sorusu göndereceğiz.",
        },
        match_batch: {
          results: [
            {
              talentId: genc!.id,
              strength: 'strong',
              fits: [{ text: 'React Native ile 8 aylık canlı uygulama', claimIds: [iddia!.id] }],
              gaps: ['App Store yayın deneyimi görünmüyor'],
              summaryForOrganization:
                'Sekiz aydır sürdürülen gerçek bir mobil uygulaması var; ihtiyacın çekirdeğini karşılıyor.',
            },
          ],
        },
      },
    });
    const { app, gonderilen } = testApp({ llm });

    // Operatör: tohum kullanıcı + sihirli link.
    await db
      .insert(users)
      .values({ email: 'op@girvak.org', name: 'Zehra', role: 'operator' })
      .onConflictDoNothing();
    const opCookie = await oturum(app, gonderilen, 'op@girvak.org');
    const orgCookie = await oturum(app, gonderilen, 'mehmet@firma.com');

    // Kurum ihtiyaç açar ve onaylar → eşleştirme koşar, kuyruk dolar.
    const need = (
      await (
        await app.request(
          '/api/needs',
          json({ rawText: 'Mağazamız için mobil uygulama yapacak birini arıyoruz.' }, orgCookie),
        )
      ).json()
    ).data;
    expect(
      (await app.request(`/api/needs/${need.id}/approve`, json({ edits: tamKart }, orgCookie)))
        .status,
    ).toBe(200);

    // Kurum henüz aday görmez.
    let adaylar = (
      await (
        await app.request(`/api/needs/${need.id}/candidates`, { headers: { cookie: orgCookie } })
      ).json()
    ).data;
    expect(adaylar.published).toBe(false);

    // Operatör kuyruğunda "kısa listeyi yayınla" bekler.
    const kuyruk = (
      await (await app.request('/api/operator/queue', { headers: { cookie: opCookie } })).json()
    ).data;
    const yayin = kuyruk.find((k: { action: string }) => k.action === 'publish_shortlist');
    expect(yayin).toBeTruthy();
    expect(yayin.payload.counts.strong).toBe(1);

    // Kurum operatör kuyruğuna giremez.
    expect(
      (await app.request('/api/operator/queue', { headers: { cookie: orgCookie } })).status,
    ).toBe(403);

    expect(
      (
        await app.request(
          `/api/operator/queue/${yayin.id}`,
          json({ decision: 'approve' }, opCookie),
        )
      ).status,
    ).toBe(200);
    // Canlı tut (04): güçlü aday "kartın eşleşti" haberini alır; kurum adı yok.
    const firsat = gonderilen.at(-1)!;
    expect(firsat.to).toBe('ayse@example.com');
    expect(firsat.text).not.toContain('firma');

    // İkinci karar 409: aynı kayıt iki kez yürütülmez.
    expect(
      (
        await app.request(
          `/api/operator/queue/${yayin.id}`,
          json({ decision: 'approve' }, opCookie),
        )
      ).status,
    ).toBe(409);

    // Kurum artık özet görür: yalnız ilk ad, gerekçe, tanıştırma yok.
    adaylar = (
      await (
        await app.request(`/api/needs/${need.id}/candidates`, { headers: { cookie: orgCookie } })
      ).json()
    ).data;
    expect(adaylar.published).toBe(true);
    expect(adaylar.candidates).toHaveLength(1);
    expect(adaylar.candidates[0].name).toBe('Ayşe');
    expect(adaylar.candidates[0].introduced).toBe(false);
    expect(adaylar.candidates[0].reasoning.fits[0].claimIds).toEqual([iddia!.id]);

    // Kurum "tanıştır" der → ajan e-postayı taslaklar → kuyruk → onay → iki tarafa, tam ad açılır.
    const matchId = adaylar.candidates[0].matchId;
    expect(adaylar.candidates[0].introRequested).toBe(false);
    const istek = await app.request(
      `/api/needs/${need.id}/candidates/${matchId}/introduce`,
      json({}, orgCookie),
    );
    expect(istek.status).toBe(201);
    // İkinci istek 409; aday listesinde "istek kuyrukta" görünür.
    expect(
      (
        await app.request(
          `/api/needs/${need.id}/candidates/${matchId}/introduce`,
          json({}, orgCookie),
        )
      ).status,
    ).toBe(409);
    adaylar = (
      await (
        await app.request(`/api/needs/${need.id}/candidates`, { headers: { cookie: orgCookie } })
      ).json()
    ).data;
    expect(adaylar.candidates[0].introRequested).toBe(true);
    const oneri = { id: (await istek.json()).data.queued as string };
    const oncekiMail = gonderilen.length;
    expect(
      (
        await app.request(
          `/api/operator/queue/${oneri.id}`,
          json({ decision: 'approve' }, opCookie),
        )
      ).status,
    ).toBe(200);
    const yeniMailler = gonderilen
      .slice(oncekiMail)
      .map((m) => m.to)
      .sort();
    expect(yeniMailler).toEqual(['ayse@example.com', 'mehmet@firma.com']);

    adaylar = (
      await (
        await app.request(`/api/needs/${need.id}/candidates`, { headers: { cookie: orgCookie } })
      ).json()
    ).data;
    expect(adaylar.candidates[0].introduced).toBe(true);
    expect(adaylar.candidates[0].name).toBe('Ayşe Yılmaz');

    // İzle (06): operatör görüşme oldu der; ölçüm paneli paydalarıyla döner.
    const durum = await app.request(
      `/api/operator/collaborations/${matchId}/status`,
      json({ status: 'meeting' }, opCookie),
    );
    expect(durum.status).toBe(200);
    const olcum = (
      await (await app.request('/api/operator/metrics', { headers: { cookie: opCookie } })).json()
    ).data;
    expect(olcum.topFiveConversion.introduced).toBeGreaterThanOrEqual(1);
    expect(olcum.topFiveConversion.reachedMeeting).toBeGreaterThanOrEqual(1);
    expect(olcum.agentProposals.approved).toBeGreaterThanOrEqual(2);
    expect(olcum.timeToIntroduction.needsWithIntroduction).toBeGreaterThanOrEqual(1);
    expect(olcum.needClarity.approvedNeeds).toBeGreaterThanOrEqual(1);
  });

  it('reddedilen kuyruk kaydı yürütülmez: kısa liste yayınlanmaz, e-posta gitmez', async () => {
    const llm = createFakeProvider({
      bySchema: {
        need_step: { draft: tamKart, missing: [], done: true, nextQuestion: null },
        match_batch: { results: [] },
      },
    });
    const { app, gonderilen, db } = testApp({ llm });
    await db
      .insert(users)
      .values({ email: 'op2@girvak.org', name: 'Op', role: 'operator' })
      .onConflictDoNothing();
    const opCookie = await oturum(app, gonderilen, 'op2@girvak.org');
    const orgCookie = await oturum(app, gonderilen, 'k2@firma.com');
    const need = (
      await (
        await app.request(
          '/api/needs',
          json({ rawText: 'Web sitemiz için tasarımcı arıyoruz, küçük bir iş.' }, orgCookie),
        )
      ).json()
    ).data;
    await app.request(`/api/needs/${need.id}/approve`, json({ edits: tamKart }, orgCookie));
    // Aday yok → kuyruğa hiçbir şey düşmez, kurum "yayınlanmadı" görür.
    const kuyruk = (
      await (await app.request('/api/operator/queue', { headers: { cookie: opCookie } })).json()
    ).data;
    expect(kuyruk.filter((k: { subjectId: string }) => k.subjectId === need.id)).toHaveLength(0);
    const adaylar = (
      await (
        await app.request(`/api/needs/${need.id}/candidates`, { headers: { cookie: orgCookie } })
      ).json()
    ).data;
    expect(adaylar.published).toBe(false);
  });
});
