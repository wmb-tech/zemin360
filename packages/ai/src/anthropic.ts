import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { LlmMessage, LlmProvider, LlmUsage } from './provider';

/**
 * Claude sağlayıcısı (ADR-0002). Şemalı çıktı için araç çağrısı kullanılır: model, Zod'dan
 * türetilen JSON şemasına uyan tek bir araç girdisi üretmeye zorlanır; serbest metin
 * ayrıştırma yok. ⚠ Anahtar yalnız sunucuda; bu paket istemciye derlenmez.
 */
export function createAnthropicProvider(opts: { apiKey: string; model?: string }): LlmProvider {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? 'claude-sonnet-5';

  function split(messages: LlmMessage[]) {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    return { system, rest };
  }

  const usageOf = (
    u: { input_tokens: number; output_tokens: number },
    started: number,
  ): LlmUsage => ({
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    model,
    provider: 'anthropic',
    durationMs: Date.now() - started,
  });

  return {
    name: 'anthropic',
    async complete(messages, o) {
      const started = Date.now();
      const { system, rest } = split(messages);
      const res = await client.messages.create({
        model,
        max_tokens: o?.maxTokens ?? 1024,
        system,
        messages: rest,
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return { text, usage: usageOf(res.usage, started) };
    },
    async structured(messages, schema, o) {
      const started = Date.now();
      const { system, rest } = split(messages);
      const name = o?.schemaName ?? 'output';
      const res = await client.messages.create({
        model,
        max_tokens: o?.maxTokens ?? 2048,
        system,
        messages: rest,
        tools: [
          {
            name,
            description: 'Sonucu bu şemaya uyan tek bir nesne olarak ver.',
            input_schema: z.toJSONSchema(schema) as Anthropic.Tool['input_schema'],
          },
        ],
        tool_choice: { type: 'tool', name },
      });
      const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (!call) throw new Error('Model şemalı çıktı üretmedi');
      return { value: schema.parse(call.input), usage: usageOf(res.usage, started) };
    },
  };
}
