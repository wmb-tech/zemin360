// Tohum verisi: gerçek gönüllüler gelene kadar demo için. Gerçek veriyle karışmasın diye
// her kayıt @evidex.dev alan adı taşır ve ayrı bir komutla silinebilir.
import { cardClaims, createDb, organizationMembers, organizations, talents, users } from './index';

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
    claims: [
      {
        text: 'React Native ile 8 aydır sürdürülen kafe sipariş uygulaması, canlıda',
        level: 'verified',
        periodStart: '2026-01-15',
      },
      {
        text: 'Node/Express ile REST API; kimlik doğrulama ve sipariş akışı',
        level: 'verified',
        periodStart: '2026-01-15',
      },
      {
        text: 'TEKNOFEST 2025 finalisti (belge)',
        level: 'documented',
        periodStart: '2025-09-01',
        periodEnd: '2025-09-05',
      },
    ],
  },
  {
    email: 'mehmet@evidex.dev',
    name: 'Mehmet Kaya',
    login: 'mkaya',
    headline: 'Veri ve otomasyon',
    story: 'Python ile küçük işletmeler için raporlama scriptleri yazdı.',
    claims: [
      {
        text: 'Python ile 3 aylık raporlama otomasyonu (iki repo)',
        level: 'verified',
        periodStart: '2026-05-01',
      },
      { text: 'React ile bir portfolyo sitesi', level: 'declared', periodStart: null },
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
  await db.insert(cardClaims).values(
    g.claims.map((c) => ({
      talentId: t!.id,
      text: c.text,
      level: c.level as 'verified' | 'documented' | 'referenced' | 'declared',
      approved: true,
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
