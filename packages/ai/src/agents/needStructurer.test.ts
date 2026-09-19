import { describe, expect, it } from 'bun:test';
import { createFakeProvider } from '../provider';
import {
  finalizeNeedCard,
  MAX_QUESTIONS,
  missingRequired,
  runNeedStructurer,
} from './needStructurer';

const bosTaslak = {
  title: 'Mobil uygulama',
  summary: undefined,
  collaborationType: null,
  expectedOutput: undefined,
  durationWeeks: null,
  workMode: null,
  compensation: null,
  requiredSkills: [],
  niceToHaveSkills: [],
  worksWith: null,
  constraints: [],
};

describe('need_structurer', () => {
  it('zorunlu alan boşken model "bitti" dese bile bitmez, soru sorar', async () => {
    const llm = createFakeProvider({
      value: {
        draft: bosTaslak,
        missing: [],
        done: true,
        nextQuestion: { text: 'Süre?', why: 'x' },
      },
    });
    const { step } = await runNeedStructurer(llm, {
      rawText: 'mobil tarafa biri lazım',
      turns: [],
    });
    expect(step.done).toBe(false);
    expect(step.missing).toContain('collaborationType');
    expect(step.nextQuestion?.text).toBe('Süre?');
  });

  it('soru hakkı bitince elindekiyle biter, soru sormaz', async () => {
    const llm = createFakeProvider({
      value: {
        draft: bosTaslak,
        missing: [],
        done: false,
        nextQuestion: { text: 'Bir soru daha?', why: 'x' },
      },
    });
    const turns = Array.from({ length: MAX_QUESTIONS }, (_, i) => ({
      question: `s${i}`,
      answer: `c${i}`,
    }));
    const { step } = await runNeedStructurer(llm, { rawText: 'x', turns });
    expect(step.done).toBe(true);
    expect(step.nextQuestion).toBeNull();
  });

  it('tam taslak onaylanabilir NeedCard verir', () => {
    const tam = {
      ...bosTaslak,
      summary: 'Mevcut web mağazasının React Native ile mobil uygulaması, App Store yayını.',
      collaborationType: 'project' as const,
      expectedOutput: 'App Store ve Google Play’de yayınlanmış uygulama',
      workMode: 'remote' as const,
      requiredSkills: ['React Native'],
      durationWeeks: 12,
    };
    expect(missingRequired(tam)).toEqual([]);
    expect(finalizeNeedCard(tam).success).toBe(true);
    expect(finalizeNeedCard(bosTaslak).success).toBe(false);
  });
});
