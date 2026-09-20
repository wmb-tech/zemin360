import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createFakeProvider } from '@evidex/ai';
import {
  cardClaims,
  collaborations,
  matches,
  needs,
  organizationMembers,
  organizations,
  talents,
  users,
} from '@evidex/db';
import { cookieOf, testApp } from '../test/setup';

const json = (body: unknown, cookie?: string) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});
const gunOnce = (n: number) => new Date(Date.now() - n * 86_400_000);

async function oturum(
  app: ReturnType<typeof testApp>['app'],
  gonderilen: { text: string }[],
  email: string,
) {
  await app.request('/api/auth/magic-link', json({ email }));
  const path = gonderilen.at(-1)!.text.match(/\/api\/auth\/magic\/\S+/)![0];
  return cookieOf(await app.request(path, { redirect: 'manual' }), 'evidex_session');
}

/** Tanıştırılmış bir iş birliği kurar (eşleştirme akışını yeniden koşmadan). */
async function isBirligiKur(db: ReturnType<typeof testApp>['db'], kurumOnayli: boolean) {
  const [gencUser] = await db
    .insert(users)
    .values({
      email: `genc-${crypto.randomUUID()}@example.com`,
      name: 'Deniz Kaya',
      role: 'talent',
      githubId: `gh-${crypto.randomUUID()}`,
    })
    .returning();
  const [genc] = await db
    .insert(talents)
    .values({ userId: gencUser!.id, cardStatus: 'approved', cardApprovedAt: new Date() })
    .returning();
  const [kurumUser] = await db
    .insert(users)
    .values({
      email: `kurum-${crypto.randomUUID()}@firma.com`,
      name: 'Kurum',
      role: 'organization',
    })
    .returning();
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Lodos Yazılım', approvedByOperatorAt: kurumOnayli ? new Date() : null })
    .returning();
  await db.insert(organizationMembers).values({ organizationId: org!.id, userId: kurumUser!.id });
  const [need] = await db
    .insert(needs)
    .values({
      organizationId: org!.id,
      rawText: 'Stajyer arıyoruz',
      card: { title: 'Yaz stajı: React arayüz' },
      cardStatus: 'approved',
    })
    .returning();
  const [m] = await db
    .insert(matches)
    .values({
      needId: need!.id,
      talentId: genc!.id,
      strength: 'strong',
      reasoning: {},
      rank: 1,
      introducedAt: gunOnce(4),
    })
    .returning();
  const [c] = await db.insert(collaborations).values({ matchId: m!.id }).returning();
  return { genc: genc!, gencEmail: gencUser!.email, kurumEmail: kurumUser!.email, collab: c! };
}

describe('takip (izle)', () => {
  it('4 gün sessiz tanıştırma → ajan soru taslağı kuyrukta → onay → iki linkli e-posta → cevaplar → referanslı kanıt, çelişki, sessizlik', async () => {
    const llm = createFakeProvider({
      bySchema: {
        follow_up_draft: {
          subject: 'Lodos ile görüşme nasıl gitti?',
          messageTalent:
            'Selam Deniz, Lodos Yazılım ile tanıştırmanın üzerinden birkaç gün geçti. Görüşebildiniz mi? Kısa bir cevap yeter: [link]',
          messageOrganization:
            'Merhaba, Deniz ile tanıştırmanın üzerinden birkaç gün geçti. Görüşme oldu mu, başladı mı? Tek tıkla cevap: [link]',
        },
        checkin_insight: {
          summary: 'Kurum işin tamamlandığını ve teslimin beklentiyi karşıladığını söylüyor.',
          flags: ['ended', 'positive'],
          needsOperator: false,
          operatorNote: null,
          referenceClaim:
            'Lodos Yazılım ile "Yaz stajı: React arayüz" iş birliğini tamamladı; kurum teslimi beklentiyi karşıladı olarak değerlendirdi.',
        },
      },
    });
    const { app, db, gonderilen, followUp } = testApp({ llm });
    await db
      .insert(users)
      .values({ email: 'op4@girvak.org', name: 'Op', role: 'operator' })
      .onConflictDoNothing();
    const op = await oturum(app, gonderilen, 'op4@girvak.org');
    const { genc, gencEmail, kurumEmail, collab } = await isBirligiKur(db, true);

    // Tarama: öneri kuyruğa düşer; ikinci tarama aynı iş birliği için yenisini yazmaz.
    let tarama = await (await app.request('/api/operator/follow-ups/scan', json({}, op))).json();
    expect(tarama.data.proposed).toBe(1);
    tarama = await (await app.request('/api/operator/follow-ups/scan', json({}, op))).json();
    expect(tarama.data.proposed).toBe(0);

    const kuyruk = (
      await (await app.request('/api/operator/queue', { headers: { cookie: op } })).json()
    ).data;
    const oneri = kuyruk.find(
      (k: { action: string; subjectId: string }) =>
        k.action === 'send_follow_up' && k.subjectId === collab.id,
    );
    expect(oneri).toBeTruthy();
    expect(oneri.payload.messageTalent).toContain('[link]');

    // Onay → iki e-posta, her birinde farklı /takip/ linki; [link] yer tutucusu dolduruldu.
    const onceki = gonderilen.length;
    expect(
      (await app.request(`/api/operator/queue/${oneri.id}`, json({ decision: 'approve' }, op)))
        .status,
    ).toBe(200);
    const mailler = gonderilen.slice(onceki);
    expect(mailler.map((m) => m.to).sort()).toEqual([gencEmail, kurumEmail].sort());
    const linkOf = (to: string) =>
      mailler.find((m) => m.to === to)!.text.match(/\/takip\/([A-Za-z0-9_-]+)/)![1]!;
    const gencToken = linkOf(gencEmail);
    const kurumToken = linkOf(kurumEmail);
    expect(gencToken).not.toBe(kurumToken);
    expect(mailler[0]!.text).not.toContain('[link]');

    // Linkten bağlam: giriş yok, yalnız kurum adı / ihtiyaç / taraf.
    const baglam = (await (await app.request(`/api/checkin/${gencToken}`)).json()).data;
    expect(baglam.side).toBe('talent');
    expect(baglam.organizationName).toBe('Lodos Yazılım');
    expect(baglam.answered).toBe(false);
    expect((await app.request('/api/checkin/yok-boyle-token')).status).toBe(404);

    // Genç: "görüştük" (metinsiz → ajan çağrısı yok). Kurum: "tamamlandı" + metin → referans.
    expect(
      (await app.request(`/api/checkin/${gencToken}`, json({ status: 'meeting', feedback: '' })))
        .status,
    ).toBe(200);
    expect(
      (await app.request(`/api/checkin/${gencToken}`, json({ status: 'meeting', feedback: '' })))
        .status,
    ).toBe(409);
    const kurumCevap = await app.request(
      `/api/checkin/${kurumToken}`,
      json({
        status: 'completed',
        feedback: 'Deniz iki haftada arayüzü teslim etti, beklentimizi karşıladı.',
      }),
    );
    expect(kurumCevap.status).toBe(200);

    // Kart: referanslı taslak iddia + network_reference kaynağı (KARAR-10).
    const iddialar = await db.select().from(cardClaims).where(eq(cardClaims.talentId, genc.id));
    expect(iddialar).toHaveLength(1);
    expect(iddialar[0]!.level).toBe('referenced');
    expect(iddialar[0]!.approved).toBe(false);
    expect(iddialar[0]!.text).toContain('Lodos Yazılım');

    // Operatör listesi: durum kurumun son cevabı, çelişki (meeting ≠ completed) işaretli.
    const liste = (
      await (await app.request('/api/operator/collaborations', { headers: { cookie: op } })).json()
    ).data;
    const satir = liste.find((l: { id: string }) => l.id === collab.id);
    expect(satir.status).toBe('completed');
    expect(satir.conflict).toBe(true);
    expect(satir.lastRound).toHaveLength(2);
    expect(satir.silentSince).toBeNull();

    // Sessizlik: ikinci bir iş birliğine soru gitmiş, 6 gündür cevap yok → işaretlenir;
    // sessiz kayda yeni öneri yazılmaz.
    const ikinci = await isBirligiKur(db, false);
    await db
      .update(collaborations)
      .set({ lastFollowUpAt: gunOnce(6) })
      .where(eq(collaborations.id, ikinci.collab.id));
    const r = await followUp.scan();
    expect(r.silent).toBe(1);
    expect(r.proposed).toBe(0);
    const [sessiz] = await db
      .select()
      .from(collaborations)
      .where(eq(collaborations.id, ikinci.collab.id));
    expect(sessiz!.silentSince).not.toBeNull();
  });

  it('onaysız kurum "tamamlandı" dese de referanslı iddia düşmez (KARAR-10)', async () => {
    const llm = createFakeProvider({
      bySchema: {
        follow_up_draft: {
          subject: 'Nasıl gidiyor?',
          messageTalent:
            'Selam, tanıştırmanın üzerinden birkaç gün geçti; görüşebildiniz mi? [link]',
          messageOrganization:
            'Merhaba, tanıştırmanın üzerinden birkaç gün geçti; görüşme oldu mu? [link]',
        },
        checkin_insight: {
          summary: 'Kurum iş bitti diyor.',
          flags: ['ended'],
          needsOperator: false,
          operatorNote: null,
          referenceClaim: 'Bu cümle karta girmemeli.',
        },
      },
    });
    const { db, gonderilen, followUp } = testApp({ llm });
    const { genc, kurumEmail, collab } = await isBirligiKur(db, false);
    await followUp.send({
      collaborationId: collab.id,
      subject: 'Takip',
      messageTalent: 'Selam [link]',
      messageOrganization: 'Merhaba [link]',
    });
    const token = gonderilen
      .find((m) => m.to === kurumEmail)!
      .text.match(/\/takip\/([A-Za-z0-9_-]+)/)![1]!;
    const sonuc = await followUp.answer(token, { status: 'completed', feedback: 'İş bitti.' });
    expect(sonuc.status).toBe('completed');
    expect(await db.select().from(cardClaims).where(eq(cardClaims.talentId, genc.id))).toHaveLength(
      0,
    );
  });
});
