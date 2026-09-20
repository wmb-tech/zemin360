import { describe, expect, it } from 'bun:test';
import { weightedScore } from './challenge';

describe('meydan okuma puanı', () => {
  it('ağırlıklı puan 0–100; eksik ölçüt 0 sayılır', () => {
    const rubric = [
      { name: 'Çalışıyor', weight: 5 },
      { name: 'Okunabilir', weight: 2 },
    ];
    expect(
      weightedScore(rubric, [
        { name: 'Çalışıyor', score: 5 },
        { name: 'Okunabilir', score: 5 },
      ]),
    ).toBe(100);
    expect(weightedScore(rubric, [{ name: 'Çalışıyor', score: 5 }])).toBe(71);
    expect(weightedScore(rubric, [])).toBe(0);
  });
});
