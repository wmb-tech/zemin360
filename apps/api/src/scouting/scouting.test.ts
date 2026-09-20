import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '@evidex/ai';
import type { GithubScout } from '@evidex/evidence';
import { users } from '@evidex/db';
import { cookieOf, testApp } from '../test/setup';

const json = (body: unknown, cookie?: string) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

const tamKart = {
  title: 'React Native ile sipariş uygulaması',
  summary: 'Kafe zinciri için masadan sipariş alan mobil uygulama.',
  collaborationType: 'internship',
  expectedOutput: 'Mağazada yayınlanmış uygulama',
  workMode: 'hybrid',
  requiredSkills: ['React Native', 'TypeScript'],
  niceToHaveSkills: ['Figma'],
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

const aday = (login: string, email: string | null) => ({
  login,
  url: `https://github.com/${login}`,
  name: login.toUpperCase(),
  bio: 'mobile dev',
  location: 'Istanbul',
  email,
  publicRepos: 12,
  followers: 30,
  createdAt: '2023-01-01T00:00:00Z',
  topLanguages: ['TypeScript'],
  recentRepos: [{ name: 'rn-app', language: 'TypeScript', pushedAt: '2026-09-01', stars: 3 }],
  lastPushedAt: '2026-09-01',
});

describe('keşif ajanı (01)', () => {
  it('ihtiyaçtan GitHub araması → ağdakiler elenir → ajan seçer → davet kuyruğu → onayla kişiye özel e-posta; e-postasızlar elle listesinde', async () => {
    let sonSorgu: unknown = null;
    const sahteScout: GithubScout = {
      async search(q) {
        sonSorgu = q;
        return [
          aday('zey-scout', 'zeynep@example.com'),
          aday('agdaki', 'x@y.com'),
          aday('bar-scout', null),
        ];
      },
    };
    const llm = createFakeProvider({
      bySchema: {
        need_step: { draft: tamKart, missing: [], done: true, nextQuestion: null },
        match_batch: { results: [] },
        scout_batch: {
          picks: [
            {
              login: 'zey-scout',
              fit: 'strong',
              why: 'Son ay itilen TypeScript React Native reposu var.',
              inviteLine: 'rn-app reponu gördük; masadan sipariş uygulaması tam senin alanın.',
            },
            {
              login: 'bar-scout',
              fit: 'possible',
              why: 'TypeScript aktif ama mobil sinyal zayıf.',
              inviteLine: 'TypeScript işlerin ilgimizi çekti.',
            },
            {
              login: 'agdaki',
              fit: 'strong',
              why: 'Ağda zaten var; elenmeli.',
              inviteLine: 'Bu satır hiç gönderilmemeli, kişi ağda.',
            },
            {
              login: 'hayalet',
              fit: 'strong',
              why: 'Uydurma login; ajan hallüsinasyonu.',
              inviteLine: 'Bu satır da hiç gönderilmemeli, kişi yok.',
            },
          ],
        },
      },
    });
    const { app, db, gonderilen } = testApp({ llm, githubScout: sahteScout });
    await db
      .insert(users)
      .values([
        { email: 'op7@girvak.org', name: 'Op', role: 'operator' },
        {
          email: 'agdaki@uye.com',
          name: 'Ağdaki',
          role: 'talent',
          githubId: 'g-1',
          githubLogin: 'agdaki',
        },
      ])
      .onConflictDoNothing();
    const op = await oturum(app, gonderilen, 'op7@girvak.org');
    const kurum = await oturum(app, gonderilen, 'kafe2@firma.com');
    const need = (
      await (
        await app.request(
          '/api/needs',
          json({ rawText: 'Mobil sipariş uygulaması yapacak stajyer' }, kurum),
        )
      ).json()
    ).data;
    // Onaysız ihtiyaçta keşif yok.
    expect((await app.request(`/api/operator/needs/${need.id}/scout`, json({}, op))).status).toBe(
      409,
    );
    await app.request(`/api/needs/${need.id}/approve`, json({ edits: tamKart }, kurum));

    // Operatör ihtiyaç listesini görür.
    const liste = (
      await (await app.request('/api/operator/needs', { headers: { cookie: op } })).json()
    ).data;
    expect(liste.find((n: { id: string }) => n.id === need.id).organizationName).toBeTruthy();

    const r = await app.request(`/api/operator/needs/${need.id}/scout`, json({}, op));
    expect(r.status).toBe(200);
    const { queued, summary } = (await r.json()).data;
    expect((sonSorgu as { languages: string[] }).languages).toEqual(['TypeScript']);
    expect(summary).toEqual({
      searched: 3,
      inNetwork: 1,
      recentlyInvited: 0,
      picked: 2,
      withEmail: 1,
    });
    expect(queued.payload.emails).toEqual(['zeynep@example.com']);
    expect(queued.payload.manual).toEqual([
      { login: 'bar-scout', url: 'https://github.com/bar-scout' },
    ]);
    expect(queued.payload.candidates.map((c: { login: string }) => c.login)).toEqual([
      'zey-scout',
      'bar-scout',
    ]);

    const onceki = gonderilen.length;
    await app.request(`/api/operator/queue/${queued.id}`, json({ decision: 'approve' }, op));
    const giden = gonderilen.slice(onceki);
    expect(giden).toHaveLength(1);
    expect(giden[0]!.to).toBe('zeynep@example.com');
    expect(giden[0]!.text).toContain('rn-app reponu gördük');

    // İkinci keşif: davet edilenler (e-postasız olan dahil) 90 gün elenir → aday kalmaz.
    const r2 = (
      await (await app.request(`/api/operator/needs/${need.id}/scout`, json({}, op))).json()
    ).data;
    expect(r2.summary.recentlyInvited).toBe(2);
    expect(r2.queued).toBeNull();
  });
});
