import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '../provider';
import {
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
