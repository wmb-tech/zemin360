import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '../provider';
import {
  adGeciyor,
  adiCikar,
  buildCardMessages,
  groupWork,
  isKoku,
  looksEnglish,
  runCardDrafter,
  type RepoSignalInput,
} from './cardDrafter';

const repo = (ref: string, ownCommits: number, ilk = '2026-03-01', son = '2026-06-01') => ({
  ref,
  signals: {
    ownCommits,
    ownFirstCommitAt: `${ilk}T00:00:00Z`,
    ownLastCommitAt: `${son}T00:00:00Z`,
  },
});
const taslak = (n: number) => ({
  headline: 'Full-stack geliştirici',
  story:
    'Kanıta bağlı birden çok ürün geliştirdi; çoğunu tek başına, bir kısmını küçük ekiplerle yürüttü ve canlıya aldı.',
  claims: Array.from({ length: n }, (_, i) => ({
    text: `Bir ürünün ${i + 1}. işini geliştirdi; iki kişilik ekipte ana geliştirici olarak çalıştı.`,
    sourceRefs: ['uydurma/ref'],
    periodStart: null,
    periodEnd: null,
  })),
});

describe('iş grupları (seçim deterministik)', () => {
  it('ürün kökü: parçaları tek işte toplar, wmb önekinde ikinci kelimeyi alır', () => {
    expect(isKoku('hazan111/bisatsan-web')).toBe('bisatsan');
    expect(isKoku('hazan111/bisatsan-marketing-hub')).toBe('bisatsan');
    expect(isKoku('wmb-tech/wmb-adisyon-v2-mobile')).toBe('wmb adisyon');
    expect(isKoku('wmb-tech/wmb-adisyon-site')).toBe('wmb adisyon');
    expect(isKoku('hazan111/mobilya_showcase2')).toBe('mobilya');
    expect(isKoku('hazan111/autoviz-next')).toBe('autoviz');
    expect(isKoku('teknofest.pdf#abc')).toBe('kaynak:teknofest.pdf#abc');
  });

  it('emeğe göre sıralar, küçük işi atar, sınırı uygular — büyük iş hiç düşmez', () => {
    const gruplar = groupWork(
      [
        repo('h/bisatsan-web', 300, '2026-03-01', '2026-09-01'),
        repo('h/bisatsan-backend', 250, '2026-03-01', '2026-09-01'),
        repo('h/autoviz', 175),
        repo('h/retro-diner', 2, '2025-09-01', '2025-09-01'),
        repo('h/closer', 799, '2026-08-01', '2026-09-15'),
      ],
      3,
    );
    expect(gruplar.map((g) => g.key)).toEqual(['bisatsan', 'closer', 'autoviz']);
    expect(gruplar[0]!.refs).toEqual(['h/bisatsan-web', 'h/bisatsan-backend']);
    expect(gruplar.find((g) => g.key === 'retro')).toBeUndefined();
  });
});

describe('okuma doğruluğu: rol, dönem, gizlilik kodla', () => {
  it('rol katkıcı sayısı ve sahiplikten hesaplanır; dönem kendi commit tarihlerinden', () => {
    const [ekip] = groupWork(
      [
        {
          ref: 'wmb-tech/closer',
          signals: {
            ownCommits: 799,
            authorshipRatio: 0.89,
            contributors: 3,
            isPrivate: true,
            ownFirstCommitAt: '2026-08-13T10:00:00Z',
            ownLastCommitAt: '2026-09-15T10:00:00Z',
          },
        },
      ],
      10,
    );
    expect(ekip!.role).toBe('3 kişilik ekipte ana geliştirici (%89, 799 commit)');
    expect(ekip!.periodStart).toBe('2026-08-13');
    expect(ekip!.periodEnd).toBe('2026-09-15');
    expect(ekip!.privateNames).toEqual(['closer']);
    const [tek] = groupWork(
      [
        {
          ref: 'h/ersan-diamond-website',
          signals: { ownCommits: 137, authorshipRatio: 0.99, contributors: 2 },
        },
      ],
      10,
    );
    expect(tek!.role).toBe('tek başına (137 commit)');
  });

  it('gizli ad: ortak kelimeler (adisyon, stok, web) yasak değil; kelime sınırı ve Türkçe ek', () => {
    const [g] = groupWork(
      [{ ref: 'wmb-tech/wmb-adisyon-v2-backend', signals: { ownCommits: 50, isPrivate: true } }],
      10,
    );
    expect(g!.privateNames).toEqual([]);
    expect(adGeciyor("Halqa'yı tek başına geliştirdi", 'halqa')).toBe(true);
    expect(adGeciyor('"SAN" projesinin web tarafı', 'san')).toBe(true);
    expect(adGeciyor('sanal showroom görselleri', 'san')).toBe(false);
    expect(adiCikar('Araçlar için "SAN" projesinin web tarafını geliştirdi.', 'san')).toBe(
      'Araçlar için projesinin web tarafını geliştirdi.',
    );
  });

  it('özel ad geçen iddia bir kez yeniden yazdırılır; yine geçerse ad metinden çıkar', async () => {
    const adli = {
      ...taslak(1),
      claims: [
        {
          text: 'Halqa adlı geleneksel sanatlar platformunu iki kişilik ekipte geliştirdi.',
          sourceRefs: [],
          periodStart: null,
          periodEnd: null,
        },
      ],
    };
    const llm = createFakeProvider({ value: adli }); // model inatla adı yazıyor
    const { draft } = await runCardDrafter(llm, 'h', [
      { ref: 'wmb-tech/halqa', signals: { ownCommits: 246, isPrivate: true } },
    ]);
    expect(adGeciyor(draft.claims[0]!.text, 'halqa')).toBe(false);
  });

  it('şablon README bağlam sayılmaz; sayfa başlığı okunur', async () => {
    const { readmeOzeti, sayfaKimligi } = await import('../../../evidence/src/providers/github');
    expect(
      readmeOzeti(
        '# React + TypeScript + Vite\n\nThis template provides a minimal setup to get React working in Vite with HMR',
      ),
    ).toBeUndefined();
    expect(
      sayfaKimligi(
        '<title>Bisatsan — Aracını değerinde sat</title><meta name="description" content="Ücretsiz ön teklif, ekspertiz ve alım">',
      ),
    ).toBe('Bisatsan — Aracını değerinde sat — Ücretsiz ön teklif, ekspertiz ve alım');
    expect(sayfaKimligi('<title>Vite + React + TS</title>')).toBeUndefined();
    // Linkli şablon da elenir (ersan-diamond-website'te kaçmıştı).
    expect(
      readmeOzeti(
        'This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://x).',
      ),
    ).toBeUndefined();
  });
});

describe('card_drafter', () => {
  it('her işe tam bir iddia; kaynaklar sıraya göre kodla bağlanır (uydurma ref işe yaramaz)', async () => {
    const repolar: RepoSignalInput[] = [
      repo('h/bisatsan-web', 300),
      repo('h/bisatsan-backend', 250),
      repo('h/autoviz', 175),
    ];
    const llm = createFakeProvider({ value: taslak(2) });
    const { draft, groups } = await runCardDrafter(llm, 'h', repolar);
    expect(groups.map((g) => g.key)).toEqual(['bisatsan', 'autoviz']);
    expect(draft.claims).toHaveLength(2);
    expect(draft.claims[0]!.sourceRefs).toEqual(['h/bisatsan-web', 'h/bisatsan-backend']);
    expect(draft.claims[1]!.sourceRefs).toEqual(['h/autoviz']);
  });

  it('iş sayısından az iddia dönerse şema reddeder (iş düşürmek mümkün değil)', async () => {
    const llm = createFakeProvider({ value: taslak(1) });
    await expect(
      runCardDrafter(llm, 'h', [repo('h/bisatsan-web', 300), repo('h/autoviz', 175)]),
    ).rejects.toThrow();
  });

  it('istem: işler numaralı gelir; README bağlamı, tahmin yasağı ve yığın yasağı yazılı', () => {
    const mesajlar = buildCardMessages(
      'hazan111',
      [
        {
          ref: 'hazan111/gise-backend',
          signals: {
            languages: ['TypeScript'],
            readmeExcerpt: 'Gisè Studio — mimarlık stüdyosu için e-ticaret ve içerik paneli.',
            manifestDescription: 'Gisè Studio API',
          },
        },
      ],
      { groups: [{ key: 'gise', refs: ['hazan111/gise-backend'], weight: 10 }] },
    );
    const sistem = mesajlar.find((m) => m.role === 'system')!.content;
    const kullanici = mesajlar.find((m) => m.role === 'user')!.content;
    expect(sistem).toContain('REPO ADINDAN TAHMİN ETME');
    expect(sistem).toContain('YIĞIN LİSTESİ YAZMA');
    expect(sistem).toContain('İŞLER SANA GRUPLANMIŞ GELİR');
    expect(kullanici).toContain('## İŞ 1 — kaynaklar: hazan111/gise-backend');
    expect(kullanici).toContain('TAM 1 iddia yaz');
    expect(kullanici).toContain('mimarlık stüdyosu için e-ticaret');
  });

  it('bütçe: kartta onaylı madde varsa yalnız kalan yer kadar iş seçilir, onaylılar istemde', async () => {
    const repolar = [repo('h/a', 50), repo('h/b', 40), repo('h/c', 30), repo('h/d', 20)];
    const mesajlar = buildCardMessages('h', repolar, {
      budget: 2,
      existing: ['Bir sözleşme platformunu tek başına geliştirdi.'],
      groups: groupWork(repolar, 2),
    });
    const kullanici = mesajlar.find((m) => m.role === 'user')!.content;
    expect(kullanici).toContain('TAM 2 iddia yaz');
    expect(kullanici).toContain('TEKRARLAMA');
    const llm = createFakeProvider({ value: taslak(2) });
    const { groups } = await runCardDrafter(llm, 'h', repolar, { budget: 2 });
    expect(groups.map((g) => g.key)).toEqual(['a', 'b']);
  });

  it('dil sezgisi: İngilizce çıktıyı yakalar, Türkçeyi bırakır', () => {
    expect(
      looksEnglish(
        'Led the development of a platform as the main developer with TypeScript and Docker.',
      ),
    ).toBe(true);
    expect(
      looksEnglish(
        'Bir platformun geliştirilmesinde ekip içinde ana geliştirici olarak TypeScript ile çalıştı.',
      ),
    ).toBe(false);
  });
});
