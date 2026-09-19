import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '@evidex/ai';
import { cookieOf, testApp } from '../test/setup';

const bosTaslak = {
  title: 'Mobil uygulama',
  collaborationType: null,
  workMode: null,
  requiredSkills: [],
  niceToHaveSkills: [],
  constraints: [],
  durationWeeks: null,
  compensation: null,
  worksWith: null,
};
const tamTaslak = {
  ...bosTaslak,
  summary: 'Mevcut web mağazasının React Native ile mobil uygulaması.',
  collaborationType: 'project',
  expectedOutput: 'Mağazalarda yayınlanmış uygulama',
  workMode: 'remote',
  requiredSkills: ['React Native'],
};

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Kurum oturumu: sihirli linkle girer. */
async function kurumOturumu(
  app: ReturnType<typeof testApp>['app'],
  gonderilen: { text: string }[],
  email: string,
) {
  await app.request('/api/auth/magic-link', json({ email }));
  const path = gonderilen.at(-1)!.text.match(/\/api\/auth\/magic\/\S+/)![0];
  const res = await app.request(path, { redirect: 'manual' });
  return cookieOf(res, 'evidex_session');
}

describe('ihtiyaçlar (tanımla)', () => {
  it('ham metin → taslak + soru; cevap → yeni adım; eksik kart onaylanamaz; tam kart onaylanır', async () => {
    const llm = createFakeProvider({
      value: {
        draft: bosTaslak,
        missing: [],
        done: false,
        nextQuestion: { text: 'Ne kadar sürede?', why: 'süre' },
      },
    });
    const { app: appLlm, gonderilen } = testApp({ llm });
    const cookie = await kurumOturumu(appLlm, gonderilen, 'kurum1@example.com');

    const olustur = await appLlm.request('/api/needs', {
      ...json({ rawText: 'Mobil tarafa birine ihtiyacımız var, e-ticaret sitemiz için.' }),
      headers: { ...json({}).headers, cookie },
    });
    expect(olustur.status).toBe(201);
    const need = (await olustur.json()).data;
    expect(need.cardStatus).toBe('draft');
    expect(need.pendingQuestion.text).toBe('Ne kadar sürede?');
    expect(need.missingFields).toContain('collaborationType');

    const cevap = await appLlm.request(`/api/needs/${need.id}/answer`, {
      ...json({ answer: '3 ay' }),
      headers: { ...json({}).headers, cookie },
    });
    expect(cevap.status).toBe(200);
    expect((await cevap.json()).data.turns).toHaveLength(1);

    const eksikOnay = await appLlm.request(`/api/needs/${need.id}/approve`, {
      ...json({}),
      headers: { ...json({}).headers, cookie },
    });
    expect(eksikOnay.status).toBe(422);
    expect((await eksikOnay.json()).error.code).toBe('incomplete_card');

    const onay = await appLlm.request(`/api/needs/${need.id}/approve`, {
      ...json({ edits: tamTaslak }),
      headers: { ...json({}).headers, cookie },
    });
    expect(onay.status).toBe(200);
    expect((await onay.json()).data.cardStatus).toBe('approved');

    // Onaylı karta cevap yazılamaz.
    const sonra = await appLlm.request(`/api/needs/${need.id}/answer`, {
      ...json({ answer: 'x' }),
      headers: { ...json({}).headers, cookie },
    });
    expect(sonra.status).toBe(409);
  });

  it('başka kurumun ihtiyacı 404 döner (varlığı bile sızmaz)', async () => {
    const llm = createFakeProvider({
      value: {
        draft: bosTaslak,
        missing: [],
        done: false,
        nextQuestion: { text: 'Süre ne kadar?', why: 'w' },
      },
    });
    const { app, gonderilen } = testApp({ llm });
    const a = await kurumOturumu(app, gonderilen, 'a@example.com');
    const b = await kurumOturumu(app, gonderilen, 'b@example.com');
    const created = await app.request('/api/needs', {
      ...json({ rawText: 'Bize bir web sitesi lazım, küçük bir kafe için.' }),
      headers: { ...json({}).headers, cookie: a },
    });
    const id = (await created.json()).data.id;
    expect((await app.request(`/api/needs/${id}`, { headers: { cookie: b } })).status).toBe(404);
    expect((await app.request(`/api/needs/${id}`, { headers: { cookie: a } })).status).toBe(200);
  });

  it('genç hesabı ihtiyaç uçlarına giremez (403), oturumsuz 401', async () => {
    const { app } = testApp({
      github: { id: 99, login: 'genc', name: 'Genç', email: 'genc@example.com' },
    });
    expect((await app.request('/api/needs')).status).toBe(401);
    const res = await app.request('/api/auth/github/callback?code=abc&state=s9', {
      headers: { cookie: 'evidex_oauth_state=s9' },
      redirect: 'manual',
    });
    const cookie = cookieOf(res, 'evidex_session');
    expect((await app.request('/api/needs', { headers: { cookie } })).status).toBe(403);
  });
});
