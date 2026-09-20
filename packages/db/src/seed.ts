// Tohum verisi: gerçek gönüllüler gelene kadar demo için. Gerçek veriyle karışmasın diye
// her kayıt @evidex.dev alan adı taşır ve ayrı bir komutla silinebilir.
import {
  cardClaims,
  createDb,
  evidenceSignals,
  evidenceSources,
  organizationMembers,
  organizations,
  talents,
  users,
} from './index';

import { eq } from 'drizzle-orm';

const db = createDb();

const [op] = await db
  .insert(users)
  .values({ email: 'operator@evidex.dev', name: 'GİRVAK Operatör', role: 'operator' })
  .onConflictDoNothing()
  .returning();

const gencler = [
  {
    email: 'ayse@evidex.dev',
    name: 'Ayşe Yılmaz',
    login: 'ayse-dev',
    headline: 'Mobil ve web geliştirici',
    story: 'Bir kafenin sipariş sistemini sekiz ay sürdürdü; canlıda, günde ~40 sipariş.',
    sources: [
      {
        kind: 'github_repo',
        ref: 'ayse-dev/kafe-siparis',
        verified: true,
        method: 'github_app',
        signals: {
          languages: ['TypeScript'],
          tools: ['Expo', 'React Native'],
          firstActivityAt: '2026-01-15',
          lastActivityAt: '2026-09-12',
          authorshipRatio: 0.92,
          hasTests: true,
          hasReadme: true,
        },
      },
      {
        kind: 'github_repo',
        ref: 'ayse-dev/kafe-api',
        verified: true,
        method: 'github_app',
        signals: {
          languages: ['JavaScript'],
          tools: ['Express'],
          firstActivityAt: '2026-01-20',
          lastActivityAt: '2026-08-30',
          authorshipRatio: 1,
          hasTests: false,
          hasReadme: true,
        },
      },
      {
        kind: 'live_url',
        ref: 'https://kafe-siparis.example.com',
        verified: true,
        method: 'dns_meta',
        signals: { reachable: true, tools: ['Expo web'] },
      },
      {
        kind: 'document',
        ref: 'teknofest-2025-finalist.pdf',
        verified: false,
        method: 'upload',
        signals: { pages: 1, title: 'TEKNOFEST 2025 Finalist Belgesi' },
      },
    ],
    claims: [
      {
        text: 'React Native ile 8 aydır sürdürülen kafe sipariş uygulaması, canlıda',
        level: 'verified',
        periodStart: '2026-01-15',
        refs: ['ayse-dev/kafe-siparis', 'https://kafe-siparis.example.com'],
      },
      {
        text: 'Node/Express ile REST API; kimlik doğrulama ve sipariş akışı',
        level: 'verified',
        periodStart: '2026-01-15',
        refs: ['ayse-dev/kafe-api'],
      },
      {
        text: 'TEKNOFEST 2025 finalisti (belge)',
        level: 'documented',
        periodStart: '2025-09-01',
        periodEnd: '2025-09-05',
        refs: ['teknofest-2025-finalist.pdf'],
      },
    ],
  },
  {
    email: 'mehmet@evidex.dev',
    name: 'Mehmet Kaya',
    login: 'mkaya',
    headline: 'Veri ve otomasyon',
    story: 'Python ile küçük işletmeler için raporlama scriptleri yazdı.',
    sources: [
      {
        kind: 'github_repo',
        ref: 'mkaya/rapor-bot',
        verified: true,
        method: 'github_app',
        signals: {
          languages: ['Python'],
          tools: ['pandas'],
          firstActivityAt: '2026-05-01',
          lastActivityAt: '2026-07-28',
          authorshipRatio: 1,
          hasTests: false,
          hasReadme: true,
        },
      },
      {
        kind: 'github_repo',
        ref: 'mkaya/excel-birlestir',
        verified: true,
        method: 'github_app',
        signals: {
          languages: ['Python'],
          tools: ['openpyxl'],
          firstActivityAt: '2026-06-10',
          lastActivityAt: '2026-07-20',
          authorshipRatio: 1,
          hasTests: false,
          hasReadme: false,
        },
      },
    ],
    claims: [
      {
        text: 'Python ile 3 aylık raporlama otomasyonu (iki repo)',
        level: 'verified',
        periodStart: '2026-05-01',
        refs: ['mkaya/rapor-bot', 'mkaya/excel-birlestir'],
      },
      { text: 'React ile bir portfolyo sitesi', level: 'declared', periodStart: null, refs: [] },
    ],
  },
];

for (const g of gencler) {
  const [u] = await db
    .insert(users)
    .values({
      email: g.email,
      name: g.name,
      role: 'talent',
      githubId: `seed-${g.login}`,
      githubLogin: g.login,
    })
    .onConflictDoNothing()
    .returning();
  if (!u) continue;
  const [t] = await db
    .insert(talents)
    .values({
      userId: u.id,
      headline: g.headline,
      story: g.story,
      cardStatus: 'approved',
      cardApprovedAt: new Date(),
    })
    .returning();
  // Kaynaklar + sinyaller: iddialar kaynağa bağlı olsun ("0 kaynak" sahte kart olmasın).
  const refToId = new Map<string, string>();
  let sonEtkinlik: Date | null = null;
  for (const src of g.sources) {
    const [k] = await db
      .insert(evidenceSources)
      .values({
        talentId: t!.id,
        kind: src.kind as 'github_repo' | 'live_url' | 'document',
        ref: src.ref,
        ownershipVerified: src.verified,
        ownershipMethod: src.method,
        lastScannedAt: new Date(),
      })
      .returning();
    refToId.set(src.ref, k!.id);
    await db.insert(evidenceSignals).values({ sourceId: k!.id, signals: src.signals });
    const la = 'lastActivityAt' in src.signals ? new Date(src.signals.lastActivityAt) : null;
    if (la && (!sonEtkinlik || la > sonEtkinlik)) sonEtkinlik = la;
  }
  await db.update(talents).set({ lastSignalAt: sonEtkinlik }).where(eq(talents.id, t!.id));
  await db.insert(cardClaims).values(
    g.claims.map((c) => ({
      talentId: t!.id,
      text: c.text,
      draftText: c.text,
      level: c.level as 'verified' | 'documented' | 'referenced' | 'declared',
      approved: true,
      sourceIds: c.refs.map((r) => refToId.get(r)!).filter(Boolean),
      periodStart: c.periodStart,
      periodEnd: 'periodEnd' in c ? (c.periodEnd as string) : null,
    })),
  );
}

const [kurum] = await db
  .insert(organizations)
  .values({ name: 'Demo Mağaza A.Ş.', city: 'İstanbul', approvedByOperatorAt: new Date() })
  .returning();
const [kurumUser] = await db
  .insert(users)
  .values({ email: 'kurum@evidex.dev', name: 'Demo Mağaza', role: 'organization' })
  .onConflictDoNothing()
  .returning();
if (kurum && kurumUser)
  await db.insert(organizationMembers).values({ organizationId: kurum.id, userId: kurumUser.id });

console.log(`seed ok${op ? '' : ' (operatör zaten vardı)'}`);
process.exit(0);
