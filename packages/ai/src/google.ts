import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { LlmMessage, LlmProvider, LlmUsage } from './provider';

/**
 * Google Gemini sağlayıcısı (ADR-0002, ikinci uygulama). İki kimlik yolu:
 * - **Vertex AI** (`vertexai: true`, proje + konum): kimlik ADC/servis hesabı; kullanım Cloud
 *   Billing'e yazılır → proje kredileri buradan yenir.
 * - **AI Studio anahtarı**: kullanım AI Studio prepay kovasından yenir, kredi YEMEZ.
 * ⚠ Ortamdaki GEMINI_API_KEY (zshrc tuzağı) Vertex modunda yok sayılır; yine de env'den
 * bilinçli okunur, sessizce devralınmaz.
 */
export interface GoogleProviderOptions {
  model?: string;
  vertex?: { project: string; location?: string };
  apiKey?: string;
}

export function createGoogleProvider(opts: GoogleProviderOptions): LlmProvider {
  if (!opts.vertex && !opts.apiKey)
    throw new Error('Google sağlayıcısı: vertex projesi ya da apiKey gerekli');
  const client = opts.vertex
    ? new GoogleGenAI({
        vertexai: true,
        project: opts.vertex.project,
        location: opts.vertex.location ?? 'global',
      })
    : new GoogleGenAI({ apiKey: opts.apiKey! });
  const model = opts.model ?? 'gemini-2.5-pro';
  const providerName = opts.vertex ? 'google-vertex' : 'google-aistudio';

  function split(messages: LlmMessage[]) {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }],
      }));
    return { system, contents };
  }

  const usageOf = (
    u: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined,
    started: number,
  ): LlmUsage => ({
    inputTokens: u?.promptTokenCount ?? 0,
    outputTokens: u?.candidatesTokenCount ?? 0,
    model,
    provider: providerName,
    durationMs: Date.now() - started,
  });

  /** Şemalı çıktı için düşünme bütçesi (token). Pro'da kapatılamaz; küçük tutulur. */
  const THINKING_BUDGET = 1024;

  return {
    name: providerName,
    async complete(messages, o) {
      const started = Date.now();
      const { system, contents } = split(messages);
      const res = await client.models.generateContent({
        model,
        contents,
        config: {
          ...(system ? { systemInstruction: system } : {}),
          maxOutputTokens: o?.maxTokens ?? 1024,
        },
      });
      return { text: res.text ?? '', usage: usageOf(res.usageMetadata, started) };
    },
    async structured(messages, schema, o) {
      const started = Date.now();
      const { system, contents } = split(messages);
      // ⚠ Gemini 2.5'te düşünme tokenleri maxOutputTokens'tan düşer; bütçeyi ayrıca ayırmazsak
      // JSON yarıda kesilir ("Unterminated string"). Çağıranın maxTokens'ı cevap içindir.
      const res = await client.models.generateContent({
        model,
        contents,
        config: {
          ...(system ? { systemInstruction: system } : {}),
          maxOutputTokens: (o?.maxTokens ?? 2048) + THINKING_BUDGET,
          thinkingConfig: { thinkingBudget: THINKING_BUDGET },
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(schema),
        },
      });
      if (res.candidates?.[0]?.finishReason === 'MAX_TOKENS')
        throw new Error(`Model çıktısı token sınırında kesildi (${o?.schemaName ?? 'şema'})`);
      const text = res.text;
      if (!text) throw new Error('Model şemalı çıktı üretmedi');
      return { value: schema.parse(JSON.parse(text)), usage: usageOf(res.usageMetadata, started) };
    },
  };
}
