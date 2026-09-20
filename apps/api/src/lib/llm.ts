import {
  createAnthropicProvider,
  createFakeProvider,
  createGoogleProvider,
  type LlmProvider,
} from '@evidex/ai';
import type { Env } from './env';

/** Sağlayıcı env'den seçilir (ADR-0002). Anahtar yoksa sahte sağlayıcıya sessizce düşülmez. */
export function createLlmFromEnv(env: Env): LlmProvider {
  switch (env.LLM_PROVIDER) {
    case 'anthropic':
      if (!env.ANTHROPIC_API_KEY)
        throw new Error('LLM_PROVIDER=anthropic ama ANTHROPIC_API_KEY yok');
      return createAnthropicProvider({
        apiKey: env.ANTHROPIC_API_KEY,
        ...(env.LLM_MODEL ? { model: env.LLM_MODEL } : {}),
      });
    case 'google':
      // Vertex önce: kullanım proje kredisinden yenir. Anahtar yolu yalnız proje yoksa.
      if (env.GOOGLE_CLOUD_PROJECT) {
        return createGoogleProvider({
          vertex: { project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION },
          ...(env.LLM_MODEL ? { model: env.LLM_MODEL } : {}),
        });
      }
      if (!env.GEMINI_API_KEY)
        throw new Error('LLM_PROVIDER=google ama GOOGLE_CLOUD_PROJECT ya da GEMINI_API_KEY yok');
      return createGoogleProvider({
        apiKey: env.GEMINI_API_KEY,
        ...(env.LLM_MODEL ? { model: env.LLM_MODEL } : {}),
      });
    case 'openai':
      throw new Error('openai sağlayıcısı henüz uygulanmadı (ADR-0002 ikinci uygulama)');
    case 'fake':
      return createDevFakeProvider();
  }
}

/**
 * Geliştirme/demo sahte sağlayıcısı: anahtar yokken akışların uçtan uca dolaşılabilmesi için.
 * need_step kurgulu; match_batch mesajdaki aday id'lerini okuyup ilkini "strong" döner.
 * ⚠ Gerçek değerlendirme yapmaz; üretimde asla seçilmez (env kapısı).
 */
function createDevFakeProvider(): LlmProvider {
  const temel = createFakeProvider({
    bySchema: {
      need_step: {
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
    },
  });
  return {
    ...temel,
    async structured(messages, schema, opts) {
      if (opts?.schemaName !== 'match_batch') return temel.structured(messages, schema, opts);
      const metin = messages.map((m) => m.content).join('\n');
      const adaylar = [...metin.matchAll(/Aday ([0-9a-f-]{36})/g)].map((m) => m[1]!);
      const iddialar = [...metin.matchAll(/\[([0-9a-f-]{36})\]/g)].map((m) => m[1]!);
      const results = adaylar.map((talentId, i) => ({
        talentId,
        strength: i === 0 ? 'strong' : 'possible',
        fits: [
          { text: 'Kanıtta ihtiyaçla örtüşen sürdürülmüş iş var', claimIds: iddialar.slice(0, 1) },
        ],
        gaps:
          i === 0
            ? ['Mağaza yayını deneyimi görünmüyor']
            : ['Gerekli becerinin kanıtı zayıf seviyede'],
        summaryForOrganization:
          i === 0
            ? 'Sürdürülmüş, canlıda bir mobil işi var; ihtiyacın çekirdeğini karşılıyor.'
            : 'İlgili ama kanıt seviyesi düşük; görüşmeye değer.',
      }));
      return {
        value: schema.parse({ results }),
        usage: { inputTokens: 0, outputTokens: 0, model: 'fake', provider: 'fake', durationMs: 0 },
      };
    },
  };
}
