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
      return createFakeProvider();
  }
}
