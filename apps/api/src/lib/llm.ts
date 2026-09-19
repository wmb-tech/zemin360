import { createAnthropicProvider, createFakeProvider, type LlmProvider } from '@evidex/ai';
import type { Env } from './env';

/** Sağlayıcı env'den seçilir (ADR-0002). Anahtar yoksa sahte sağlayıcıya sessizce düşülmez. */
export function createLlmFromEnv(env: Env): LlmProvider {
  switch (env.LLM_PROVIDER) {
    case 'anthropic':
      if (!env.ANTHROPIC_API_KEY)
        throw new Error('LLM_PROVIDER=anthropic ama ANTHROPIC_API_KEY yok');
      return createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
    case 'openai':
      throw new Error('openai sağlayıcısı henüz uygulanmadı (ADR-0002 ikinci uygulama)');
    case 'fake':
      // Geliştirme/demo: her ajan çağrısı aynı kurgulu adımı döner. Şemaya uymak zorunda;
      // uymazsa 500 — sessizce boş kart üretmez.
      return createFakeProvider({
        value: {
          draft: {
            title: 'E-ticaret mağazası için mobil uygulama',
            summary: 'Mevcut web mağazasının React Native ile iOS/Android uygulaması.',
            collaborationType: 'project',
            expectedOutput: 'App Store ve Google Play’de yayınlanmış uygulama',
            durationWeeks: 12,
            workMode: null,
            compensation: null,
            requiredSkills: ['React Native', 'REST API'],
            niceToHaveSkills: ['TypeScript'],
            worksWith: null,
            constraints: [],
          },
          missing: [],
          done: false,
          nextQuestion: {
            text: 'Kişi uzaktan mı çalışacak, yoksa ofiste mi?',
            why: 'Çalışma biçimi eşleşmeyi doğrudan etkiliyor',
          },
        },
      });
  }
}
