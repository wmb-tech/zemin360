import { eq, inArray, like, or } from 'drizzle-orm';
import {
  approvalQueue,
  cardClaims,
  collaborations,
  evidenceSignals,
  evidenceSources,
  matches,
  needs,
  organizationMembers,
  organizations,
  talents,
  users,
  type Db,
} from '@evidex/db';

/**
 * ### Demo ağı (jüri sunumu ve eğitim için)
 * Canlıda sunucuya erişmeden, operatörün tek tuşla yükleyip tek tuşla kaldırabildiği kurgusal
 * bir ağ: 8 genç (farklı kanıt seviyeleri ve alanları), 2 kurum, onaylı birer ihtiyaç.
 * Tanım: e-postası `@demo.evidex.dev` olan her şey demodur; kaynak ref'leri `demo/` ile başlar ve
 * `ownership_method = 'demo'` taşır. Kaldırma yalnız bunlara dokunur (gerçek kullanıcıya asla).
 * Yükleme idempotent: tekrar basmak ikinci kopya üretmez.
 */
export const DEMO_DOMAIN = '@demo.evidex.dev';

interface DemoRepo {
  name: string;
  languages: string[];
  tools: string[];
  ownCommits: number;
  contributors: number;
  authorshipRatio: number;
  from: string;
  to: string;
  deployed?: boolean;
}
interface DemoClaim {
  text: string;
  level: 'verified' | 'documented' | 'declared';
  repos: string[];
  from: string | null;
  to: string | null;
}
interface DemoTalent {
  slug: string;
  name: string;
  city: string;
  headline: string;
  story: string;
  repos: DemoRepo[];
  documents?: { name: string; signals: Record<string, unknown> }[];
  claims: DemoClaim[];
}

const r = (
  name: string,
  languages: string[],
  tools: string[],
  ownCommits: number,
  contributors: number,
  authorshipRatio: number,
  from: string,
  to: string,
  deployed = false,
): DemoRepo => ({
  name,
  languages,
  tools,
  ownCommits,
  contributors,
  authorshipRatio,
  from,
  to,
  deployed,
});

export const DEMO_TALENTS: DemoTalent[] = [
  {
    slug: 'elif',
    name: 'Elif Karaca',
    city: 'İstanbul',
    headline: 'Mobil uygulama geliştirici',
    story:
      'Bir kafe zinciri için sipariş uygulamasını on ay boyunca tek başına geliştirip canlıda tuttu. Mobil tarafta Expo ile iki uygulama yayınladı; üniversite kulübünün etkinlik uygulamasına da katkı verdi.',
    repos: [
      r(
        'kafe-siparis-mobil',
        ['TypeScript'],
        ['Expo', 'TypeScript'],
        412,
        1,
        1,
        '2025-11-01',
        '2026-09-10',
        true,
      ),
      r(
        'kafe-siparis-api',
        ['TypeScript'],
        ['Node.js', 'Docker', 'GitHub Actions'],
        188,
        1,
        1,
        '2025-11-05',
        '2026-09-02',
        true,
      ),
      r('kulup-etkinlik', ['TypeScript'], ['Expo'], 64, 4, 0.31, '2026-02-10', '2026-05-20'),
    ],
    claims: [
      {
        text: "Bir kafe zinciri için sipariş uygulamasının mobil istemcisini ve API'sini tek başına geliştirdi; uygulama canlıda, şubeler günlük siparişleri buradan alıyor.",
        level: 'verified',
        repos: ['kafe-siparis-mobil', 'kafe-siparis-api'],
        from: '2025-11-01',
        to: '2026-09-10',
      },
      {
        text: 'Üniversite kulübünün etkinlik uygulamasında 4 kişilik ekipte katkı verdi (%31, 64 commit); bildirim ve kayıt ekranlarını yazdı.',
        level: 'verified',
        repos: ['kulup-etkinlik'],
        from: '2026-02-10',
        to: '2026-05-20',
      },
    ],
  },
  {
    slug: 'burak',
    name: 'Burak Şen',
    city: 'İzmir',
    headline: 'Veri ve raporlama otomasyonu',
    story:
      "Küçük işletmeler için stok ve satış raporlarını otomatikleştiren Python araçları yazıyor. Bir aile işletmesinin Excel'le tutulan stok takibini veritabanına taşıdı.",
    repos: [
      r(
        'stok-rapor',
        ['Python', 'SQL'],
        ['Docker', 'Python paketleme'],
        231,
        1,
        1,
        '2025-10-01',
        '2026-08-28',
      ),
      r(
        'satis-dashboard',
        ['Python'],
        ['GitHub Actions'],
        97,
        2,
        0.74,
        '2026-03-01',
        '2026-07-15',
        true,
      ),
    ],
    claims: [
      {
        text: "Bir aile işletmesinin Excel'le tutulan stok takibini PostgreSQL'e taşıyan ve haftalık raporları otomatik üreten aracı tek başına geliştirdi.",
        level: 'verified',
        repos: ['stok-rapor'],
        from: '2025-10-01',
        to: '2026-08-28',
      },
      {
        text: 'Satış verisini günlük güncellenen bir panele dönüştürdü; iki kişilik ekipte ana geliştirici (%74, 97 commit), panel yayında.',
        level: 'verified',
        repos: ['satis-dashboard'],
        from: '2026-03-01',
        to: '2026-07-15',
      },
    ],
  },
  {
    slug: 'zeynep',
    name: 'Zeynep Aksoy',
    city: 'Ankara',
    headline: 'Arayüz ve tasarım sistemi',
    story:
      "Bir STK'nın gönüllü portalının arayüzünü baştan tasarlayıp React ile hayata geçirdi. Erişilebilirlik ve mobil uyuma özen gösteren bir bileşen kütüphanesi sürdürüyor.",
    repos: [
      r(
        'gonullu-portal',
        ['TypeScript', 'CSS'],
        ['Vite/Next', 'TypeScript'],
        276,
        2,
        0.81,
        '2026-01-15',
        '2026-09-05',
        true,
      ),
      r(
        'erisilebilir-ui',
        ['TypeScript', 'CSS'],
        ['TypeScript', 'GitHub Actions'],
        143,
        1,
        1,
        '2025-12-01',
        '2026-08-20',
      ),
    ],
    claims: [
      {
        text: "Bir STK'nın gönüllü portalının arayüzünü tasarlayıp geliştirdi; iki kişilik ekipte ana geliştirici (%81, 276 commit), portal yayında.",
        level: 'verified',
        repos: ['gonullu-portal'],
        from: '2026-01-15',
        to: '2026-09-05',
      },
      {
        text: 'Erişilebilirlik testleri olan, mobil uyumlu bir bileşen kütüphanesini tek başına sürdürüyor (143 commit).',
        level: 'verified',
        repos: ['erisilebilir-ui'],
        from: '2025-12-01',
        to: '2026-08-20',
      },
    ],
  },
  {
    slug: 'can',
    name: 'Can Yurt',
    city: 'İstanbul',
    headline: 'Backend ve e-ticaret altyapısı',
    story:
      'Bir butik e-ticaret sitesinin sipariş ve ödeme altyapısını kurdu. Stok senkronizasyonu ve kargo entegrasyonu üzerine çalışıyor.',
    repos: [
      r(
        'butik-magaza-api',
        ['TypeScript', 'SQL'],
        ['Node.js', 'Docker', 'GitHub Actions'],
        358,
        2,
        0.88,
        '2025-09-15',
        '2026-09-12',
        true,
      ),
      r('kargo-entegrasyon', ['TypeScript'], ['Node.js'], 71, 1, 1, '2026-05-01', '2026-06-30'),
    ],
    claims: [
      {
        text: "Bir butik e-ticaret sitesinin sipariş, stok ve ödeme API'sini geliştirdi; iki kişilik ekipte ana geliştirici (%88, 358 commit), site canlıda satış yapıyor.",
        level: 'verified',
        repos: ['butik-magaza-api'],
        from: '2025-09-15',
        to: '2026-09-12',
      },
      {
        text: 'Kargo firmasıyla gönderi oluşturma ve takip entegrasyonunu tek başına yazdı (71 commit).',
        level: 'verified',
        repos: ['kargo-entegrasyon'],
        from: '2026-05-01',
        to: '2026-06-30',
      },
    ],
  },
  {
    slug: 'selin',
    name: 'Selin Demirtaş',
    city: 'Bursa',
    headline: 'Veri analizi ve görselleştirme',
    story:
      'Belediyenin açık verisiyle toplu taşıma yoğunluk analizi yaptı; staj döneminde bir üretim firmasının kalite verisini panoya dönüştürdü.',
    repos: [
      r('ulasim-analiz', ['Python', 'Jupyter Notebook'], [], 84, 1, 1, '2026-02-01', '2026-04-30'),
    ],
    documents: [
      {
        name: 'staj-belgesi.pdf',
        signals: {
          docType: 'staj belgesi',
          issuer: 'Bir üretim firması',
          years: ['2026'],
          excerptLines: ['Kalite verisi analizi ve raporlama panosu hazırlama'],
        },
      },
    ],
    claims: [
      {
        text: 'Belediyenin açık verisiyle toplu taşıma yoğunluk analizini tek başına yaptı ve sonuçları haritalı bir rapora dönüştürdü (84 commit).',
        level: 'verified',
        repos: ['ulasim-analiz'],
        from: '2026-02-01',
        to: '2026-04-30',
      },
      {
        text: 'Staj döneminde bir üretim firmasının kalite verisini analiz edip raporlama panosu hazırladı (staj belgesiyle).',
        level: 'documented',
        repos: ['staj-belgesi.pdf'],
        from: '2026-06-01',
        to: '2026-08-31',
      },
    ],
  },
  {
    slug: 'mert',
    name: 'Mert Çınar',
    city: 'Kocaeli',
    headline: 'Gömülü sistemler ve IoT',
    story:
      'TEKNOFEST finalisti bir ekipte sensör kartlarının yazılımını geliştirdi. Bir sera için nem ve sıcaklık izleme cihazı kurdu.',
    repos: [r('sera-izleme', ['C++', 'Python'], [], 126, 1, 1, '2025-12-10', '2026-07-01')],
    documents: [
      {
        name: 'teknofest-finalist.pdf',
        signals: {
          docType: 'yarışma belgesi',
          issuer: 'TEKNOFEST',
          years: ['2025'],
          excerptLines: ['Finalist'],
        },
      },
    ],
    claims: [
      {
        text: 'Bir sera için nem ve sıcaklık izleyen cihazın yazılımını tek başına geliştirdi; veriler telefondan izleniyor (126 commit).',
        level: 'verified',
        repos: ['sera-izleme'],
        from: '2025-12-10',
        to: '2026-07-01',
      },
      {
        text: "TEKNOFEST 2025'te finale kalan ekipte sensör kartlarının yazılımından sorumluydu.",
        level: 'documented',
        repos: ['teknofest-finalist.pdf'],
        from: '2025-04-01',
        to: '2025-09-30',
      },
    ],
  },
  {
    slug: 'deniz',
    name: 'Deniz Kılıç',
    city: 'İstanbul',
    headline: 'Full-stack web',
    story:
      'Bir öğrenci topluluğunun etkinlik kayıt sitesini ve yönetim panelini geliştirdi; gönüllülerin telefondan kullandığı basit ve hızlı arayüzlere odaklanıyor.',
    repos: [
      r(
        'etkinlik-kayit',
        ['TypeScript'],
        ['Vite/Next', 'Node.js', 'Docker'],
        204,
        1,
        1,
        '2026-01-05',
        '2026-09-14',
        true,
      ),
    ],
    claims: [
      {
        text: 'Bir öğrenci topluluğunun etkinlik kayıt sitesini ve yönetim panelini tek başına geliştirdi; 3 dönemdir kayıtlar buradan alınıyor (204 commit).',
        level: 'verified',
        repos: ['etkinlik-kayit'],
        from: '2026-01-05',
        to: '2026-09-14',
      },
    ],
  },
  {
    slug: 'emre',
    name: 'Emre Güneş',
    city: 'Eskişehir',
    headline: 'Yeni başlayan web geliştirici',
    story:
      'Kendi kendine web geliştirme öğreniyor; henüz bağlanmış bir kanıtı yok. Meydan okumalarla kartına doğrulanmış kanıt eklemeyi hedefliyor.',
    repos: [],
    claims: [
      {
        text: 'HTML, CSS ve JavaScript ile kişisel bir portfolyo sitesi yaptığını belirtiyor.',
        level: 'declared',
        repos: [],
        from: null,
        to: null,
      },
    ],
  },
];

export const DEMO_ORGS = [
  {
    slug: 'kahve',
    name: 'Anadolu Kahve Evleri',
    city: 'İzmir',
    approved: true,
    need: {
      rawText:
        "İzmir'de 6 şubeli bir kahve zinciriyiz. Şubeler siparişleri WhatsApp'la topluyor, stok hep karışıyor. Şube sipariş ve stok takip paneli lazım, telefondan da kullanılsın.",
      card: {
        title: 'Şube sipariş ve stok takip paneli',
        summary:
          '6 şubeli kahve zincirinin WhatsApp üzerinden yürüyen sipariş ve stok takibini, telefondan da kullanılabilen bir web paneline taşımak.',
        collaborationType: 'project',
        expectedOutput:
          'Şubelerin merkeze sipariş verebildiği, merkezin tüm şubelerin stoğunu tek ekranda gördüğü mobil uyumlu web paneli.',
        durationWeeks: 8,
        workMode: 'hybrid',
        compensation: 'Aylık 25.000 TL, 2 ay',
        requiredSkills: [
          'Web uygulaması (frontend + backend)',
          'Veritabanı tasarımı',
          'Mobil uyumlu arayüz',
        ],
        niceToHaveSkills: ['Stok ve sipariş iş akışı deneyimi'],
        worksWith: 'Şube müdürleri ve merkez depo sorumlusu',
        constraints: [],
      },
    },
  },
  {
    slug: 'yesil',
    name: 'Yeşil Adım Derneği',
    city: 'İstanbul',
    approved: true,
    need: {
      rawText:
        'Gönüllü etkinliklerimiz için kayıt formu ve katılımcı listesi tutan basit bir web sayfası lazım. Gönüllülerimiz telefondan bakabilmeli.',
      card: {
        title: 'Gönüllü etkinlik kayıt sayfası',
        summary:
          'Derneğin gönüllü etkinlikleri için kayıt formu ve katılımcı listesi tutan, telefondan kullanılan basit bir web sayfası.',
        collaborationType: 'project',
        expectedOutput:
          'Etkinlik oluşturma, kayıt formu ve katılımcı listesi olan mobil uyumlu web sayfası.',
        durationWeeks: 4,
        workMode: 'remote',
        compensation: null,
        requiredSkills: ['Web geliştirme', 'Form ve veritabanı', 'Mobil uyumlu arayüz'],
        niceToHaveSkills: ['Erişilebilirlik'],
        worksWith: 'Gönüllü koordinatörü',
        constraints: [],
      },
    },
  },
] as const;

/** Demo ağının durumu: kaç genç ve kurum yüklü, hangi demo hesaplar var. */
export async function demoStatus(db: Db) {
  const kullanicilar = await db
    .select({ email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(like(users.email, `%${DEMO_DOMAIN}`));
  return {
    talents: kullanicilar.filter((u) => u.role === 'talent').length,
    organizations: kullanicilar.filter((u) => u.role === 'organization').length,
    accounts: kullanicilar
      .map((u) => ({ slug: u.email.slice(0, -DEMO_DOMAIN.length), name: u.name, role: u.role }))
      .sort((a, b) =>
        a.role === b.role ? a.name.localeCompare(b.name, 'tr') : a.role === 'organization' ? -1 : 1,
      ),
  };
}

/**
 * Operatörün demo hesabına giriş bağlantısı üretmesi (sunum ve eğitim): e-postası kurgusal olan
 * hesaba posta gidemez; operatör tek kullanımlık bağlantıyı panelden alır ve gizli pencerede açar.
 * ⚠ Yalnız @demo.evidex.dev hesapları — gerçek bir kullanıcı adına bağlantı üretilemez.
 */
export async function demoLoginEmail(db: Db, slug: string): Promise<string | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  const email = `${slug}${DEMO_DOMAIN}`;
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return u ? email : null;
}

export async function seedDemoNetwork(db: Db) {
  const simdi = new Date();
  for (const t of DEMO_TALENTS) {
    const email = `${t.slug}${DEMO_DOMAIN}`;
    const [var_] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (var_) continue; // idempotent
    const [u] = await db.insert(users).values({ email, name: t.name, role: 'talent' }).returning();
    const son = [...t.repos.map((x) => x.to)].sort().at(-1);
    const [tal] = await db
      .insert(talents)
      .values({
        userId: u!.id,
        headline: t.headline,
        story: t.story,
        city: t.city,
        cardStatus: 'approved',
        cardApprovedAt: simdi,
        publicSlug: `demo-${t.slug}`,
        lastSignalAt: son ? new Date(son) : simdi,
      })
      .returning();
    const kaynak = new Map<string, string>();
    for (const repo of t.repos) {
      const [k] = await db
        .insert(evidenceSources)
        .values({
          talentId: tal!.id,
          kind: 'github_repo',
          ref: `demo/${repo.name}`,
          ownershipVerified: true,
          ownershipMethod: 'demo',
          lastScannedAt: simdi,
        })
        .returning();
      kaynak.set(repo.name, k!.id);
      await db.insert(evidenceSignals).values({
        sourceId: k!.id,
        signals: {
          languages: repo.languages,
          tools: repo.tools,
          ownCommits: repo.ownCommits,
          commitCount: repo.ownCommits,
          contributors: repo.contributors,
          authorshipRatio: repo.authorshipRatio,
          ownFirstCommitAt: `${repo.from}T09:00:00Z`,
          ownLastCommitAt: `${repo.to}T18:00:00Z`,
          deployed: repo.deployed ?? false,
          isPrivate: false,
          demo: true,
        },
      });
    }
    for (const d of t.documents ?? []) {
      const [k] = await db
        .insert(evidenceSources)
        .values({
          talentId: tal!.id,
          kind: 'document',
          ref: `demo/${d.name}`,
          ownershipVerified: false,
          ownershipMethod: 'demo',
          lastScannedAt: simdi,
        })
        .returning();
      kaynak.set(d.name, k!.id);
      await db
        .insert(evidenceSignals)
        .values({ sourceId: k!.id, signals: { ...d.signals, demo: true } });
    }
    for (const c of t.claims)
      await db.insert(cardClaims).values({
        talentId: tal!.id,
        text: c.text,
        draftText: c.text,
        level: c.level,
        approved: true,
        sourceIds: c.repos.map((x) => kaynak.get(x)!).filter(Boolean),
        periodStart: c.from,
        periodEnd: c.to,
      });
  }

  const ihtiyacId = new Map<string, string>();
  for (const o of DEMO_ORGS) {
    const email = `${o.slug}${DEMO_DOMAIN}`;
    const [var_] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (var_) continue;
    const [u] = await db
      .insert(users)
      .values({ email, name: o.name, role: 'organization' })
      .returning();
    const [org] = await db
      .insert(organizations)
      .values({ name: o.name, city: o.city, approvedByOperatorAt: o.approved ? simdi : null })
      .returning();
    await db.insert(organizationMembers).values({ organizationId: org!.id, userId: u!.id });
    const [ihtiyac] = await db
      .insert(needs)
      .values({
        organizationId: org!.id,
        rawText: o.need.rawText,
        card: { ...o.need.card } as Record<string, unknown>,
        turns: [],
        pendingQuestion: null,
        missingFields: [],
        cardStatus: 'approved',
        cardApprovedAt: simdi,
      })
      .returning();
    ihtiyacId.set(o.slug, ihtiyac!.id);
  }

  // Takip (izle 06) sunumda canlı gösterilebilsin: Deniz × Yeşil Adım 4 gün önce tanıştırılmış.
  // Operatör "Şimdi tara" deyince ajan iki tarafa takip sorusu taslağı yazar.
  const yesil = ihtiyacId.get('yesil');
  if (yesil) {
    const [deniz] = await db
      .select({ id: talents.id })
      .from(talents)
      .innerJoin(users, eq(users.id, talents.userId))
      .where(eq(users.email, `deniz${DEMO_DOMAIN}`))
      .limit(1);
    if (deniz) {
      const gunOnce = (n: number) => new Date(simdi.getTime() - n * 24 * 3600 * 1000);
      await db
        .update(needs)
        .set({ shortlistPublishedAt: gunOnce(5) })
        .where(eq(needs.id, yesil));
      const [m] = await db
        .insert(matches)
        .values({
          needId: yesil,
          talentId: deniz.id,
          strength: 'strong',
          rank: 1,
          reasoning: {
            fits: [
              {
                text: 'Bir öğrenci topluluğunun etkinlik kayıt sitesini ve yönetim panelini tek başına geliştirmiş; 3 dönemdir kullanılıyor.',
                claimIds: [],
              },
            ],
            gaps: ['Erişilebilirlik çalışması kartında görünmüyor.'],
            summaryForOrganization:
              'İhtiyacınızın neredeyse aynısını daha önce yapmış ve canlıda tutuyor: etkinlik kaydı, katılımcı listesi, telefondan kullanım.',
          },
          introducedAt: gunOnce(4),
        })
        .returning();
      await db.insert(collaborations).values({ matchId: m!.id, status: 'introduced' });
    }
  }
  return demoStatus(db);
}

/** Yalnız demoya dokunur: demo kullanıcıları (zincirleme kart/kaynak/iddia), demo kurumları,
 *  onların ihtiyaç/eşleşmeleri ve bunlara bağlı kuyruk kayıtları. */
export async function removeDemoNetwork(db: Db) {
  const demoKullanicilar = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `%${DEMO_DOMAIN}`));
  const kullaniciIds = demoKullanicilar.map((u) => u.id);
  if (kullaniciIds.length === 0) return demoStatus(db);
  const orgIds = (
    await db
      .select({ id: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(inArray(organizationMembers.userId, kullaniciIds))
  ).map((x) => x.id);
  const talentIds = (
    await db.select({ id: talents.id }).from(talents).where(inArray(talents.userId, kullaniciIds))
  ).map((x) => x.id);
  const needIds = orgIds.length
    ? (
        await db.select({ id: needs.id }).from(needs).where(inArray(needs.organizationId, orgIds))
      ).map((x) => x.id)
    : [];
  // Demo ihtiyaçlarına ya da demo gençlere ait eşleşmeler (gerçek genç × demo ihtiyaç dahil).
  const kosullar = [
    ...(needIds.length ? [inArray(matches.needId, needIds)] : []),
    ...(talentIds.length ? [inArray(matches.talentId, talentIds)] : []),
  ];
  const tumMatch = kosullar.length
    ? (
        await db
          .select({ id: matches.id })
          .from(matches)
          .where(or(...kosullar))
      ).map((x) => x.id)
    : [];
  const collabIds = tumMatch.length
    ? (
        await db
          .select({ id: collaborations.id })
          .from(collaborations)
          .where(inArray(collaborations.matchId, tumMatch))
      ).map((x) => x.id)
    : [];
  const konular = [...needIds, ...tumMatch, ...collabIds];
  if (konular.length)
    await db.delete(approvalQueue).where(inArray(approvalQueue.subjectId, konular));
  if (orgIds.length) await db.delete(organizations).where(inArray(organizations.id, orgIds));
  await db.delete(users).where(inArray(users.id, kullaniciIds));
  return demoStatus(db);
}
