import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '../provider';
import { buildCardMessages, looksEnglish, runCardDrafter } from './cardDrafter';

describe('card_drafter', () => {
  it('kaynağı olmayan iddia düşer, uydurma kaynak referansı atılır', async () => {
    const llm = createFakeProvider({
      value: {
        headline: 'Mobil geliştirici',
        story:
          'Sekiz aydır bir kafe için sipariş uygulaması geliştiriyor; canlıda, iki kişilik ekipte ana geliştirici, test ve CI kurulu.',
        claims: [
          {
            text: 'React Native ile 8 aydır sürdürülen kafe sipariş uygulaması; canlıda; iki kişilik ekipte ana geliştirici.',
            sourceRefs: ['ayse/kafe', 'ayse/uydurma'],
            periodStart: '2026-01-15',
            periodEnd: null,
          },
          {
            text: 'Kubernetes ile üretim kümesi yönetimi; bu iddianın kaynağı yok, düşmesi gerekir.',
            sourceRefs: ['ayse/olmayan'],
            periodStart: null,
            periodEnd: null,
          },
        ],
      },
    });
    const { draft } = await runCardDrafter(llm, 'ayse', [
      { ref: 'ayse/kafe', signals: { languages: ['TypeScript'] } },
    ]);
    expect(draft.claims).toHaveLength(1);
    expect(draft.claims[0]!.sourceRefs).toEqual(['ayse/kafe']);
  });

  it('istem: ürün bağlamı README/açıklamadan gelir, repo adından tahmin yasağı yazılı, yığın listesi yasak', () => {
    const mesajlar = buildCardMessages('hazan111', [
      {
        ref: 'hazan111/gise-backend',
        signals: {
          languages: ['TypeScript'],
          readmeExcerpt: 'Gisè Studio — mimarlık stüdyosu için e-ticaret ve içerik paneli.',
          manifestDescription: 'Gisè Studio API',
        },
      },
    ]);
    const sistem = mesajlar.find((m) => m.role === 'system')!.content;
    const kullanici = mesajlar.find((m) => m.role === 'user')!.content;
    expect(sistem).toContain('REPO ADINDAN TAHMİN ETME');
    expect(sistem).toContain('YIĞIN LİSTESİ YAZMA');
    expect(sistem).toContain('İDDİA = İŞ, REPO DEĞİL');
    expect(kullanici).toContain('mimarlık stüdyosu için e-ticaret');
    expect(kullanici).toContain('"manifestDescription": "Gisè Studio API"');
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
