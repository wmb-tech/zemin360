import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '../provider';
import { runMatcher, type CandidateCard } from './matcher';

const need = {
  title: 'Mobil uygulama',
  summary: 'React Native ile mağaza uygulaması',
  collaborationType: 'project' as const,
  expectedOutput: 'Yayınlanmış uygulama',
  durationWeeks: 12,
  workMode: 'remote' as const,
  compensation: null,
  requiredSkills: ['React Native'],
  niceToHaveSkills: [],
  worksWith: null,
  constraints: [],
};
const A = '11111111-1111-4111-8111-111111111111';
const K1 = '22222222-2222-4222-8222-222222222222';
const SAHTE_ADAY = '99999999-9999-4999-8999-999999999999';
const SAHTE_IDDIA = '88888888-8888-4888-8888-888888888888';
const adaylar: CandidateCard[] = [
  {
    talentId: A,
    name: 'Ayşe',
    headline: null,
    story: null,
    claims: [
      {
        id: K1,
        text: 'React Native ile 8 aylık proje',
        level: 'verified',
        periodStart: '2026-01-01',
        periodEnd: null,
      },
    ],
  },
];

describe('matcher', () => {
  it("modelin uydurduğu aday ve iddia id'leri atılır", async () => {
    const llm = createFakeProvider({
      value: {
        results: [
          {
            talentId: A,
            strength: 'strong',
            fits: [{ text: 'RN deneyimi', claimIds: [K1, SAHTE_IDDIA] }],
            gaps: [],
            summaryForOrganization: 'Uyuyor.',
          },
          {
            talentId: SAHTE_ADAY,
            strength: 'strong',
            fits: [],
            gaps: [],
            summaryForOrganization: 'Uydurma.',
          },
        ],
      },
    });
    const { results } = await runMatcher(llm, need, adaylar);
    expect(results).toHaveLength(1);
    expect(results[0]!.fits[0]!.claimIds).toEqual([K1]);
  });

  it('aday yoksa modele hiç gitmez', async () => {
    let cagri = 0;
    const llm = createFakeProvider();
    llm.structured = async () => {
      cagri++;
      throw new Error('çağrılmamalı');
    };
    const { results } = await runMatcher(llm, need, []);
    expect(results).toEqual([]);
    expect(cagri).toBe(0);
  });
});
