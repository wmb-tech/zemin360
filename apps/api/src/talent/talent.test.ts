import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '@evidex/ai';
import type { GithubEvidence } from '@evidex/evidence';
import { cookieOf, testApp } from '../test/setup';

const json = (body: unknown, cookie?: string, method = 'POST') => ({
  method,
  headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

/** Sahte GitHub: iki repo, biri fork. Ağa çıkmaz. */
const sahteGithub: GithubEvidence = {
  async installationOwner(installationId) {
    // 777 → Ayşe (github id 501); 999 → başkası
    return installationId === '777'
      ? { id: '501', login: 'ayse' }
      : { id: '999', login: 'baskasi' };
  },
  async listRepos() {
    return [
      { fullName: 'ayse/kafe-siparis', private: true, defaultBranch: 'main' },
      { fullName: 'ayse/react-fork', private: false, defaultBranch: 'main' },
    ];
  },
  async verifyOwnership() {
    return true;
  },
  async extract(_inst, fullName) {
    return fullName === 'ayse/kafe-siparis'
      ? {
          languages: ['TypeScript'],
          tools: ['Expo'],
          firstActivityAt: '2026-01-15',
          lastActivityAt: '2026-09-10',
          authorshipRatio: 0.8,
          contributors: 2,
          deployed: true,
          hasTests: true,
          hasReadme: true,
          fork: false,
        }
      : { languages: ['JavaScript'], authorshipRatio: 0, contributors: 900, fork: true };
  },
};

describe('genç kartı (doğrula)', () => {
  it('kurulum → senkron → taslak iddialar → onayla/düzelt/sil → kart onayı; onaysız iddiasız kart onaylanmaz', async () => {
    const llm = createFakeProvider({
      bySchema: {
        card_draft: {
          headline: 'Mobil ve web geliştirici',
          story:
            'Sekiz aydır bir kafe için sipariş uygulaması geliştiriyor; canlıda, iki kişilik ekipte.',
          claims: [
            {
              text: 'React Native/Expo ile 8 aydır sürdürülen kafe sipariş uygulaması; canlıda; iki katkıcıdan biri',
              sourceRefs: ['ayse/kafe-siparis'],
              periodStart: '2026-01-15',
              periodEnd: null,
            },
            {
              text: 'Uydurma iddia',
              sourceRefs: ['ayse/olmayan'],
              periodStart: null,
              periodEnd: null,
            },
          ],
        },
      },
    });
    const { app } = testApp({
      llm,
      github: sahteGithub,
      githubProfile: { id: 501, login: 'ayse', name: 'Ayşe Yılmaz', email: 'ayse501@example.com' },
    });

    // Kurulum dönüşü: state install çerezinden, installation_id ile.
    const donus = await app.request(
      '/api/auth/github/callback?code=abc&state=st1&installation_id=777&setup_action=install',
      {
        headers: { cookie: 'evidex_install_state=st1' },
        redirect: 'manual',
      },
    );
    expect(donus.status).toBe(302);
    expect(donus.headers.get('location')).toContain('/kanit?installed=1');
    const cookie = cookieOf(donus, 'evidex_session');

    // Kart onayı henüz mümkün değil: iddia yok.
    expect((await app.request('/api/me/card/approve', json({}, cookie))).status).toBe(422);

    const sync = await app.request('/api/me/evidence/github/sync', json({}, cookie));
    expect(sync.status).toBe(200);
    const kart = (await sync.json()).data;
    expect(kart.talent.githubConnected).toBe(true);
    expect(kart.sources).toHaveLength(2);
    expect(kart.claims).toHaveLength(1); // uydurma kaynaklı iddia düştü
    expect(kart.claims[0].level).toBe('verified');
    expect(kart.claims[0].approved).toBe(false);
    expect(kart.claims[0].sourceIds).toHaveLength(1);

    // Kişi iddiayı düzeltir ve onaylar.
    const iddia = kart.claims[0];
    const duzelt = await app.request(
      `/api/me/card/claims/${iddia.id}`,
      json(
        { text: 'Expo ile 8 aydır sürdürülen kafe sipariş uygulaması; canlıda', approved: true },
        cookie,
        'PATCH',
      ),
    );
    expect(duzelt.status).toBe(200);
    expect((await duzelt.json()).data.draftText).toBe(iddia.text); // ölçüm: taslak vs onay farkı korunur

    const onay = await app.request('/api/me/card/approve', json({}, cookie));
    expect(onay.status).toBe(200);
    expect((await onay.json()).data.talent.cardStatus).toBe('approved');

    // Yeniden senkron onaylı iddiaya dokunmaz.
    const tekrar = (
      await (await app.request('/api/me/evidence/github/sync', json({}, cookie))).json()
    ).data;
    expect(tekrar.claims.filter((c: { approved: boolean }) => c.approved)).toHaveLength(1);
    expect(tekrar.sources).toHaveLength(2); // aynı kaynak iki kez bağlanmadı
  });

  it('başkasının kurulum numarası kabul edilmez (IDOR)', async () => {
    const { app } = testApp({
      github: sahteGithub,
      githubProfile: { id: 502, login: 'veli', name: 'Veli', email: 'veli@example.com' },
    });
    const donus = await app.request(
      '/api/auth/github/callback?code=abc&state=st2&installation_id=999&setup_action=install',
      { headers: { cookie: 'evidex_install_state=st2' }, redirect: 'manual' },
    );
    expect(donus.status).toBe(403);
    expect(cookieOf(donus, 'evidex_session')).toBe('');
  });

  it('kurum hesabı genç uçlarına giremez', async () => {
    const { app, gonderilen } = testApp();
    await app.request('/api/auth/magic-link', json({ email: 'k9@firma.com' }));
    const path = gonderilen.at(-1)!.text.match(/\/api\/auth\/magic\/\S+/)![0];
    const cookie = cookieOf(await app.request(path, { redirect: 'manual' }), 'evidex_session');
    expect((await app.request('/api/me/card', { headers: { cookie } })).status).toBe(403);
  });
});
