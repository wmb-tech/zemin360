import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createFakeProvider } from '@evidex/ai';
import type { GithubEvidence } from '@evidex/evidence';
import { cardClaims, evidenceSources, needs, organizations, talents, users } from '@evidex/db';
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

let extractCalls = 0;
const sahteGithub: GithubEvidence = {
  async installationOwner() {
    return { id: '901', login: 'ece' };
  },
  async listRepos() {
    return [{ fullName: 'ece/portfolyo', private: false, defaultBranch: 'main' }];
  },
  async verifyOwnership() {
    return true;
  },
  async extract() {
    extractCalls++;
    return {
      languages: ['TypeScript'],
      tools: [],
      firstActivityAt: '2026-01-10T00:00:00Z',
      lastActivityAt: '2026-09-15T00:00:00Z', // yeni etkinlik → kart artık sessiz değil
      authorshipRatio: 1,
      contributors: 1,
      hasTests: false,
      hasReadme: true,
      deployed: false,
    };
  },
};

describe('ağ + canlı tut', () => {
  it('sessiz kart hesabı, kurum onayı (KARAR-10), haftalık kanıt yenileme idempotent', async () => {
    const llm = createFakeProvider({
      bySchema: {
        card_draft: {
          headline: 'Ön yüz geliştirici',
          story: 'Portfolyo sitesini dokuz aydır sürdürüyor.',
          claims: [
            {
              text: 'TypeScript ile portfolyo sitesi (Oca–Eyl 2026)',
              sourceRefs: ['ece/portfolyo'],
              periodStart: '2026-01-10',
              periodEnd: '2026-09-15',
            },
          ],
        },
      },
    });
    const { app, db, gonderilen, network } = testApp({ llm, github: sahteGithub });
    await db
      .insert(users)
      .values({ email: 'op5@girvak.org', name: 'Op', role: 'operator' })
      .onConflictDoNothing();
    const op = await oturum(app, gonderilen, 'op5@girvak.org');

    // Genç: GitHub bağlı, kaynağı 10 gün önce taranmış, son etkinlik 120 gün önce → sessiz.
    const [u] = await db
      .insert(users)
      .values({
        email: 'ece@example.com',
        name: 'Ece Aydın',
        role: 'talent',
        githubId: '901',
        githubLogin: 'ece',
      })
      .returning();
    const [t] = await db
      .insert(talents)
      .values({ userId: u!.id, githubInstallationId: '4242', lastSignalAt: gunOnce(120) })
      .returning();
    await db.insert(evidenceSources).values({
      talentId: t!.id,
      kind: 'github_repo',
      ref: 'ece/portfolyo',
      ownershipVerified: true,
      ownershipMethod: 'github_app',
      lastScannedAt: gunOnce(10),
    });
    const [org] = await db.insert(organizations).values({ name: 'Poyraz Ajans' }).returning();
    await db
      .insert(needs)
      .values({ organizationId: org!.id, rawText: 'Sosyal medya için içerik üretecek biri' });

    let ag = (
      await (await app.request('/api/operator/network', { headers: { cookie: op } })).json()
    ).data;
    const ece = ag.talents.find((x: { id: string }) => x.id === t!.id);
    expect(ece.silent).toBe(true);
    expect(ece.sources).toBe(1);
    expect(ag.silentTalents).toBeGreaterThanOrEqual(1);
    const poyraz = ag.organizations.find((o: { id: string }) => o.id === org!.id);
    expect(poyraz.approved).toBe(false);
    expect(poyraz.needs).toBe(1);
    expect(poyraz.members).toBe(0);

    // Kurum onayı: kurum kullanıcısı yapamaz, operatör yapar; denetim izine düşer.
    const kurum = await oturum(app, gonderilen, 'x@poyraz.com');
    expect(
      (
        await app.request(
          `/api/operator/network/organizations/${org!.id}/approval`,
          json({ approved: true }, kurum),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await (
          await app.request(
            `/api/operator/network/organizations/${org!.id}/approval`,
            json({ approved: true }, op),
          )
        ).json()
      ).data.approved,
    ).toBe(true);

    // Kanıt yenileme: 7 günden eski taramalı kart yeniden okunur, taslak iddia yenilenir,
    // lastSignalAt kanıttaki son etkinlik olur (taramanın anı değil) → sessizlik kalkar.
    let r = await network.refreshEvidence();
    expect(r).toEqual({ refreshed: 1, failed: 0 });
    expect(extractCalls).toBe(1);
    r = await network.refreshEvidence();
    expect(r.refreshed).toBe(0); // aynı gün ikinci koşu boş

    const [guncel] = await db.select().from(talents).where(eq(talents.id, t!.id));
    expect(guncel!.lastSignalAt!.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    const iddialar = await db.select().from(cardClaims).where(eq(cardClaims.talentId, t!.id));
    expect(iddialar).toHaveLength(1);
    expect(iddialar[0]!.level).toBe('verified');

    ag = (await (await app.request('/api/operator/network', { headers: { cookie: op } })).json())
      .data;
    expect(ag.talents.find((x: { id: string }) => x.id === t!.id).silent).toBe(false);
  });
});
