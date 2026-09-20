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
    // 777 → Ayşe (kişisel); 888 → org (Ayşe üye); 999 → başkasının org'u
    if (installationId === '777') return { id: '501', login: 'ayse', type: 'user' as const };
    if (installationId === '888') return { id: '900', login: 'kulup-org', type: 'org' as const };
    return { id: '999', login: 'baskasi-org', type: 'org' as const };
  },
  async userInstallationIds() {
    return ['777', '888'];
  },
  async listRepos(installationId) {
    if (installationId === '888')
      return [
        { fullName: 'kulup-org/etkinlik-sitesi', private: true, defaultBranch: 'main' },
        { fullName: 'kulup-org/baskasinin-isi', private: true, defaultBranch: 'main' },
      ];
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
      : fullName === 'kulup-org/etkinlik-sitesi'
        ? {
            languages: ['TypeScript'],
            authorshipRatio: 0.4,
            ownCommits: 12,
            contributors: 3,
            fork: false,
            isPrivate: true,
          }
        : fullName === 'kulup-org/baskasinin-isi'
          ? {
              languages: ['Go'],
              authorshipRatio: 0,
              ownCommits: 0,
              contributors: 5,
              fork: false,
              isPrivate: true,
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
              text: 'Uydurma iddia: kaynağı olmayan bir repo için yazılmış, düşmesi gereken cümle.',
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
    // …ve aynı repo için ikinci bir taslak da üretmez (onaylı iddianın kaynağı ajana gitmez).
    expect(tekrar.claims).toHaveLength(1);
    expect(tekrar.sources).toHaveLength(2); // aynı kaynak iki kez bağlanmadı
  });

  it('org kurulumu: kullanıcının erişebildiği org kabul edilir, listede olmayan org 403', async () => {
    const { app } = testApp({
      llm: createFakeProvider({
        bySchema: {
          card_draft: {
            headline: 'Geliştirici',
            story:
              'Kanıttan türeyen özet: bir projeyi aylarca sürdürdü, canlıya aldı ve ekip içinde ana geliştirici olarak çalıştı.',
            claims: [
              {
                text: 'Kalan kaynaklardan yazılmış tek iddia: kafe sipariş uygulaması, Expo, canlıda.',
                sourceRefs: ['ayse/kafe-siparis'],
                periodStart: null,
                periodEnd: null,
              },
            ],
          },
        },
      }),
      github: sahteGithub,
      githubProfile: {
        id: 501,
        login: 'ayse',
        name: 'Ayşe',
        email: 'ayse-org@example.com',
        accessToken: 'tok',
      },
    });
    const org = await app.request(
      '/api/auth/github/callback?code=abc&state=o1&installation_id=888&setup_action=install',
      { headers: { cookie: 'evidex_install_state=o1' }, redirect: 'manual' },
    );
    expect(org.headers.get('location')).toContain('/kanit?installed=1');
    const cookie = cookieOf(org, 'evidex_session');
    // Ayşe'nin kişisel kurulumu (777) önceki testten duruyor; org kurulumu yanına eklenir.
    const kart = (await (await app.request('/api/me/card', { headers: { cookie } })).json()).data;
    const loginler = kart.talent.installations.map((i: { accountLogin: string }) => i.accountLogin);
    expect(loginler).toContain('kulup-org');
    expect(loginler).toContain('ayse');
    expect(kart.talent.githubConnected).toBe(true);
    // Senkron: org'daki iki repodan yalnız commit'i olan kaynağa girer; sıfır commit'li atlanır.
    const senkron = (
      await (
        await app.request('/api/me/evidence/github/sync', { method: 'POST', headers: { cookie } })
      ).json()
    ).data;
    expect(senkron.skippedOrgRepos).toBe(1);
    const orgKaynaklar = senkron.sources
      .map((x: { ref: string }) => x.ref)
      .filter((r: string) => r.startsWith('kulup-org/'));
    expect(orgKaynaklar).toEqual(['kulup-org/etkinlik-sitesi']);
    // Org kurulumunu kaldırınca yalnız o hesabın kaynakları düşer.
    const orgKurulum = kart.talent.installations.find(
      (i: { accountType: string }) => i.accountType === 'org',
    );
    const sil = await app.request(`/api/me/evidence/github/installations/${orgKurulum.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(sil.status).toBe(200);
    const sonra = (await sil.json()).data;
    expect(
      sonra.talent.installations.some((i: { accountType: string }) => i.accountType === 'org'),
    ).toBe(false);
    expect(sonra.sources.some((x: { ref: string }) => x.ref.startsWith('kulup-org/'))).toBe(false);
    // Erişilemeyen org (999) hâlâ 403.
    const yabanci = await app.request(
      '/api/auth/github/callback?code=abc&state=o3&installation_id=999&setup_action=install',
      { headers: { cookie: 'evidex_install_state=o3' }, redirect: 'manual' },
    );
    expect(yabanci.headers.get('location')).toContain('hata=installation_owner_mismatch');
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
    // Ham 403 JSON değil: giriş sayfasına okunur hata koduyla döner; oturum yine açılmaz.
    expect(donus.status).toBe(302);
    expect(donus.headers.get('location')).toContain('/giris?hata=installation_owner_mismatch');
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

describe('canlı URL kanıtı', () => {
  it('ekle → token → doğrulanmadan beyan kalır → doğrula → doğrulanmış iddia', async () => {
    const sayfalar = new Map<string, string>();
    const liveUrl = {
      async verifyOwnership(url: string, token: string) {
        const ok = (sayfalar.get(url) ?? '').includes(token);
        return { verified: ok, method: 'dns_meta' as const };
      },
      async extract() {
        return { reachable: true, title: 'Kafe Sipariş', tools: ['Vite'], deployed: true };
      },
    };
    const llm = createFakeProvider({
      bySchema: {
        card_draft: {
          headline: 'Web geliştirici',
          story:
            'Kanıttan türeyen özet: bir projeyi aylarca sürdürdü, canlıya aldı ve ekip içinde ana geliştirici olarak çalıştı.',
          claims: [
            {
              text: 'Canlıda çalışan kafe sipariş sitesi; Vite ile geliştirildi, sahipliği alan adı etiketiyle doğrulandı.',
              sourceRefs: ['https://kafe.example/'],
              periodStart: null,
              periodEnd: null,
            },
          ],
        },
      },
    });
    const { app } = testApp({
      llm,
      liveUrl,
      githubProfile: { id: 601, login: 'deniz', name: 'Deniz', email: 'deniz@example.com' },
    });
    const giris = await app.request('/api/auth/github/callback?code=abc&state=s6', {
      headers: { cookie: 'evidex_oauth_state=s6' },
      redirect: 'manual',
    });
    const cookie = cookieOf(giris, 'evidex_session');

    // Yerel adres reddedilir.
    expect(
      (await app.request('/api/me/evidence/url', json({ url: 'http://localhost:3100' }, cookie)))
        .status,
    ).toBe(422);

    const ekle = await app.request(
      '/api/me/evidence/url',
      json({ url: 'https://kafe.example/' }, cookie),
    );
    expect(ekle.status).toBe(201);
    const kaynak = (await ekle.json()).data;
    expect(kaynak.ownershipVerified).toBe(false);
    expect(kaynak.verifyToken).toMatch(/^evidex-/);

    // Token sayfada yok → 422, kaynak doğrulanmaz.
    expect(
      (await app.request(`/api/me/evidence/url/${kaynak.id}/verify`, json({}, cookie))).status,
    ).toBe(422);

    sayfalar.set(
      'https://kafe.example/',
      `<meta name="evidex-verify" content="${kaynak.verifyToken}">`,
    );
    const dogrula = await app.request(`/api/me/evidence/url/${kaynak.id}/verify`, json({}, cookie));
    expect(dogrula.status).toBe(200);
    const kart = (await dogrula.json()).data;
    expect(kart.sources[0].ownershipVerified).toBe(true);
    expect(kart.claims).toHaveLength(1);
    expect(kart.claims[0].level).toBe('verified');
  });
});

describe('belge kanıtı', () => {
  it('PDF yükle → sinyal saklanır, dosya değil → belgeli iddia; aynı belge 409; PDF olmayan 422', async () => {
    let cagri = 0;
    const document = {
      async extract(bytes: Uint8Array) {
        cagri++;
        if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-')
          throw new Error('Yalnız PDF kabul edilir');
        return {
          pages: 1,
          wordCount: 40,
          sha256: 'deadbeef'.repeat(8),
          title: 'TEKNOFEST 2025',
          issuer: 'TEKNOFEST 2025',
          years: [2025],
          docType: 'competition' as const,
          excerptLines: ['TEKNOFEST 2025', 'Finalist Belgesi'],
          language: 'tr' as const,
        };
      },
    };
    const llm = createFakeProvider({
      bySchema: {
        card_draft: {
          headline: 'Genç geliştirici',
          story:
            'Kanıttan türeyen özet: bir projeyi aylarca sürdürdü, canlıya aldı ve ekip içinde ana geliştirici olarak çalıştı.',
          claims: [
            {
              text: 'TEKNOFEST 2025 Eğitim Teknolojileri kategorisinde ekip olarak finalist; belgeyle destekli.',
              sourceRefs: ['teknofest.pdf#deadbeefdead'],
              periodStart: '2025-09-01',
              periodEnd: '2025-09-05',
            },
          ],
        },
      },
    });
    const { app } = testApp({
      llm,
      document,
      githubProfile: { id: 602, login: 'ece-belge', name: 'Ece', email: 'ece-b@example.com' },
    });
    const giris = await app.request('/api/auth/github/callback?code=abc&state=s7b', {
      headers: { cookie: 'evidex_oauth_state=s7b' },
      redirect: 'manual',
    });
    const cookie = cookieOf(giris, 'evidex_session');

    const yukle = (icerik: string, ad = 'teknofest.pdf') => {
      const fd = new FormData();
      fd.append('file', new File([icerik], ad, { type: 'application/pdf' }));
      return app.request('/api/me/evidence/document', {
        method: 'POST',
        headers: { cookie },
        body: fd,
      });
    };
    expect((await yukle('bu bir pdf değil')).status).toBe(422);
    const r = await yukle('%PDF-1.4 sahte içerik');
    expect(r.status).toBe(201);
    const kart = (await r.json()).data;
    const belge = kart.sources.find((x: { kind: string }) => x.kind === 'document');
    expect(belge.ref).toBe('teknofest.pdf#deadbeefdead');
    expect(belge.ownershipVerified).toBe(false);
    expect(kart.claims).toHaveLength(1);
    expect(kart.claims[0].level).toBe('documented');
    expect(kart.claims[0].sourceIds).toEqual([belge.id]);
    // Sinyalde belge metni yok, yalnız kısa alıntı.
    const sinyal = (
      await (
        await app.request('/api/me/evidence/signals', json({ sourceIds: [belge.id] }, cookie))
      ).json()
    ).data;
    expect(JSON.stringify(sinyal)).toContain('Finalist Belgesi');
    expect(JSON.stringify(sinyal)).not.toContain('sahte içerik');
    // Aynı belge ikinci kez: 409, ajan tekrar çağrılmaz.
    const once = cagri;
    expect((await yukle('%PDF-1.4 sahte içerik')).status).toBe(409);
    expect(cagri).toBe(once + 1);
  });
});
