import type { z } from 'zod';

/**
 * ### LLM sağlayıcı arayüzü (ADR-0002)
 * Tüm ajanlar yalnız bu arayüzle konuşur; sağlayıcı env ile seçilir. Şemalı çıktı
 * (`structured`) ajan sonucunu UI'a bağlanabilir ve test edilebilir kılar.
 */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
  durationMs: number;
}

export interface StructuredResult<T> {
  value: T;
  usage: LlmUsage;
}

export interface LlmProvider {
  readonly name: string;
  complete(
    messages: LlmMessage[],
    opts?: { maxTokens?: number },
  ): Promise<{ text: string; usage: LlmUsage }>;
  structured<T>(
    messages: LlmMessage[],
    schema: z.ZodType<T>,
    opts?: { maxTokens?: number; schemaName?: string },
  ): Promise<StructuredResult<T>>;
}

/** Testlerde ve sağlayıcı anahtarı yokken kullanılan sahte sağlayıcı: asla ağa çıkmaz. */
export function createFakeProvider(
  answers: { text?: string; value?: unknown; bySchema?: Record<string, unknown> } = {},
): LlmProvider {
  const usage = (): LlmUsage => ({
    inputTokens: 0,
    outputTokens: 0,
    model: 'fake',
    provider: 'fake',
    durationMs: 0,
  });
  return {
    name: 'fake',
    async complete() {
      return { text: answers.text ?? '', usage: usage() };
    },
    async structured(_messages, schema, opts) {
      // Şema adına göre cevap: aynı sahte sağlayıcı birden fazla ajanı besleyebilsin.
      const ham =
        opts?.schemaName && answers.bySchema && opts.schemaName in answers.bySchema
          ? answers.bySchema[opts.schemaName]
          : answers.value;
      return { value: schema.parse(ham), usage: usage() };
    },
  };
}
