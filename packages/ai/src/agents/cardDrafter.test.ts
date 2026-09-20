import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '../provider';
import { runCardDrafter } from './cardDrafter';

describe('card_drafter', () => {
  it('kaynağı olmayan iddia düşer, uydurma kaynak referansı atılır', async () => {
    const llm = createFakeProvider({
      value: {
        headline: 'Mobil geliştirici',
        story: 'Sekiz aydır bir kafe için sipariş uygulaması geliştiriyor; canlıda.',
        claims: [
          {
            text: 'React Native ile 8 aylık kafe uygulaması',
            sourceRefs: ['ayse/kafe', 'ayse/uydurma'],
            periodStart: '2026-01-15',
            periodEnd: null,
          },
          {
            text: 'Kubernetes ile üretim kümesi yönetimi',
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
});
