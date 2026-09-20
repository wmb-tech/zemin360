import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '@evidex/ai';
import type { PublicRepoEvidence } from '@evidex/evidence';
import { users } from '@evidex/db';
import { cookieOf, testApp } from '../test/setup';

const json = (body: unknown, cookie?: string, method = 'POST') => ({
  method,
  headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

const tamKart = {
  title: 'Kafe için sipariş ekranı',
  summary: 'Küçük bir kafe için masadan sipariş alan basit web ekranı.',
  collaborationType: 'project',
  expectedOutput: 'Çalışan web ekranı',
  workMode: 'remote',
  requiredSkills: ['React'],
  niceToHaveSkills: [],
  constraints: [],
  durationWeeks: 4,
  compensation: null,
  worksWith: null,
};

const rubric = [
  { name: 'Çalışıyor', weight: 5, description: 'Uygulama açılıyor ve sipariş alınabiliyor' },
  { name: 'Okunabilir', weight: 2, description: 'Kod ve README anlaşılır' },
  { name: 'Kararlar', weight: 1, description: 'Teknik kararlar açıklanmış' },
];

async function oturum(
  app: ReturnType<typeof testApp>['app'],
  gonderilen: { text: string }[],
  email: string,
) {
  await app.request('/api/auth/magic-link', json({ email }));
  const path = gonderilen.at(-1)!.text.match(/\/api\/auth\/magic\/\S+/)![0];
  return cookieOf(await app.request(path, { redirect: 'manual' }), 'evidex_session');
}

const sahteRepo: PublicRepoEvidence = {
  async extract(repoUrl) {
    return {
      fullName: repoUrl.replace('https://github.com/', ''),
      languages: ['TypeScript'],
      fileCount: 12,
      filePaths: ['README.md', 'src/App.tsx'],
      readme: 'Kurulum: bun dev',
      hasTests: repoUrl.includes('iyi'),
      hasReadme: true,
      lastCommitAt: '2026-09-21T10:00:00Z',
      commitCount: 9,
      description: null,
    };
  },
};

describe('meydan okuma (keşfet)', () => {
  it('ihtiyaç → tasarım → aç → iki teslim → kapat → değerlendir → sıralama, kart kanıtı, kurum ilk üç', async () => {
    const llm = createFakeProvider({
      bySchema: {
        need_step: { draft: tamKart, missing: [], done: true, nextQuestion: null },
        match_batch: { results: [] },
        challenge_design: {
          title: 'Kafe için masadan sipariş ekranı (48 saat)',
          brief:
            'Herkese açık örnek menüyle, masa numarası girip sipariş oluşturan tek sayfalık bir web ekranı yap. Teslim: GitHub reposu, README’de çalıştırma adımı. Yapay zekâ araçları serbest. Kapsam dışı: ödeme, kullanıcı girişi.',
          durationHours: 48,
          rubric,
        },
      },
    });
    // Değerlendirici teslime göre farklı bant döner (repo adına bakarak).
    llm.structured = (async (messages, schema, opts) => {
      const metin = messages.map((m) => m.content).join('\n');
      if (opts?.schemaName === 'submission_evaluation') {
        const iyi = metin.includes('github.com/ayse/iyi');
        return {
          value: schema.parse({
            band: iyi ? 'strong' : 'partial',
            scores: [
              {
                name: 'Çalışıyor',
                score: iyi ? 5 : 2,
                comment: iyi ? 'Açılıyor, sipariş oluşuyor' : 'Sipariş akışı eksik',
              },
              { name: 'Okunabilir', score: iyi ? 4 : 3, comment: 'README var' },
              { name: 'Kararlar', score: iyi ? 4 : 1, comment: iyi ? 'Açıklanmış' : 'Yok' },
            ],
            strengths: ['Hızlı teslim'],
            gaps: iyi ? [] : ['Sipariş gönderimi çalışmıyor'],
            summary: iyi ? 'Görevi tam karşılıyor.' : 'Kısmen karşılıyor.',
            evidenceClaim: `GİRVAK meydan okuması 'Kafe için masadan sipariş ekranı': 48 saatte React teslimi, değerlendirme: ${iyi ? 'strong' : 'partial'}.`,
          }),
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            model: 'fake',
            provider: 'fake',
            durationMs: 0,
          },
        };
      }
      const base = createFakeProvider({
        bySchema: {
          need_step: { draft: tamKart, missing: [], done: true, nextQuestion: null },
          match_batch: { results: [] },
          challenge_design: {
            title: 'Kafe için masadan sipariş ekranı (48 saat)',
            brief:
              'Herkese açık örnek menüyle, masa numarası girip sipariş oluşturan tek sayfalık bir web ekranı yap. Teslim: GitHub reposu, README’de çalıştırma adımı. Yapay zekâ araçları serbest. Kapsam dışı: ödeme, kullanıcı girişi.',
            durationHours: 48,
            rubric,
          },
        },
      });
      return base.structured(messages, schema, opts);
    }) as typeof llm.structured;

    const { app, gonderilen, db } = testApp({ llm, publicRepo: sahteRepo });
    await db
      .insert(users)
      .values({ email: 'op3@girvak.org', name: 'Op', role: 'operator' })
      .onConflictDoNothing();
    const op = await oturum(app, gonderilen, 'op3@girvak.org');
    const kurum = await oturum(app, gonderilen, 'kafe@firma.com');

    // İhtiyaç onaylanır (eşleştirme boş liste döner, kuyruk boş).
    const need = (
      await (
        await app.request(
          '/api/needs',
          json({ rawText: 'Kafemiz için masadan sipariş alan basit bir ekran lazım.' }, kurum),
        )
      ).json()
    ).data;
    await app.request(`/api/needs/${need.id}/approve`, json({ edits: tamKart }, kurum));

    // Operatör ihtiyaçtan görev tasarlar; taslak; açar.
    const tasarim = await app.request(
      `/api/operator/challenges/from-need/${need.id}`,
      json({}, op),
    );
    expect(tasarim.status).toBe(201);
    const ch = (await tasarim.json()).data;
    expect(ch.status).toBe('draft');
    expect(ch.rubric).toHaveLength(3);
    // Kurum, kendi ihtiyacındaki görevleri görür ama henüz sonuç yok.
    let kurumGorunumu = (
      await (
        await app.request(`/api/needs/${need.id}/challenges`, { headers: { cookie: kurum } })
      ).json()
    ).data;
    expect(kurumGorunumu).toHaveLength(1);
    expect(kurumGorunumu[0].submissions).toHaveLength(0);

    // Taslağa teslim edilemez.
    const gencA = cookieOf(
      await await (async () => {
        const { app: a } = testApp({
          llm,
          publicRepo: sahteRepo,
          githubProfile: {
            id: 701,
            login: 'ayse',
            name: 'Ayşe Demir',
            email: 'ayse701@example.com',
          },
        });
        return a.request('/api/auth/github/callback?code=x&state=s7', {
          headers: { cookie: 'evidex_oauth_state=s7' },
          redirect: 'manual',
        });
      })(),
      'evidex_session',
    );
    expect(
      (
        await app.request(
          `/api/me/challenges/${ch.id}/submit`,
          json({ repoUrl: 'https://github.com/ayse/iyi-teslim' }, gencA),
        )
      ).status,
    ).toBe(409);

    expect((await app.request(`/api/operator/challenges/${ch.id}/open`, json({}, op))).status).toBe(
      200,
    );

    // Genç açık görevleri görür ve teslim eder; ikinci genç zayıf teslim.
    const acik = (
      await (await app.request('/api/me/challenges', { headers: { cookie: gencA } })).json()
    ).data;
    expect(acik.find((c: { id: string }) => c.id === ch.id)).toBeTruthy();
    expect(
      (
        await app.request(
          `/api/me/challenges/${ch.id}/submit`,
          json({ repoUrl: 'https://gitlab.com/x/y' }, gencA),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await app.request(
          `/api/me/challenges/${ch.id}/submit`,
          json({ repoUrl: 'https://github.com/ayse/iyi-teslim', note: 'bun dev' }, gencA),
        )
      ).status,
    ).toBe(201);

    const gencB = cookieOf(
      await await (async () => {
        const { app: a } = testApp({
          llm,
          publicRepo: sahteRepo,
          githubProfile: { id: 702, login: 'mert', name: 'Mert Can', email: 'mert702@example.com' },
        });
        return a.request('/api/auth/github/callback?code=x&state=s8', {
          headers: { cookie: 'evidex_oauth_state=s8' },
          redirect: 'manual',
        });
      })(),
      'evidex_session',
    );
    expect(
      (
        await app.request(
          `/api/me/challenges/${ch.id}/submit`,
          json({ repoUrl: 'https://github.com/mert/zayif' }, gencB),
        )
      ).status,
    ).toBe(201);

    // Açıkken değerlendirilemez; kapat → değerlendir.
    expect(
      (await app.request(`/api/operator/challenges/${ch.id}/evaluate`, json({}, op))).status,
    ).toBe(409);
    expect(
      (await app.request(`/api/operator/challenges/${ch.id}/close`, json({}, op))).status,
    ).toBe(200);
    const degerlendir = await app.request(
      `/api/operator/challenges/${ch.id}/evaluate`,
      json({}, op),
    );
    expect(degerlendir.status).toBe(200);
    expect((await degerlendir.json()).data.evaluated).toBe(2);

    // Operatör tam sıralamayı görür; iyi teslim 1.
    const sonuc = (
      await (
        await app.request(`/api/operator/challenges/${ch.id}`, { headers: { cookie: op } })
      ).json()
    ).data;
    expect(sonuc.submissions[0].rank).toBe(1);
    expect(sonuc.submissions[0].name).toBe('Ayşe Demir');
    expect(sonuc.submissions[0].evaluation.band).toBe('strong');
    expect(sonuc.submissions[1].evaluation.band).toBe('partial');

    // Kurum ilk üçü ilk adla görür.
    kurumGorunumu = (
      await (
        await app.request(`/api/needs/${need.id}/challenges`, { headers: { cookie: kurum } })
      ).json()
    ).data;
    expect(kurumGorunumu[0].submissions[0].name).toBe('Ayşe');
    expect(kurumGorunumu[0].submissions[0].evaluation.band).toBe('strong');

    // Gencin kartına doğrulanmış (taslak) iddia ve challenge_submission kaynağı düştü.
    const kart = (await (await app.request('/api/me/card', { headers: { cookie: gencA } })).json())
      .data;
    expect(kart.sources.some((s: { kind: string }) => s.kind === 'challenge_submission')).toBe(
      true,
    );
    const iddia = kart.claims.find((c: { text: string }) => c.text.includes('meydan okuması'));
    expect(iddia.level).toBe('verified');
    expect(iddia.approved).toBe(false);
  });
});
