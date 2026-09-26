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
  /** Hızlı kademe ve yedek model (kalite modeli kotaya takılırsa buna düşülür). */
  fastModel?: string;
  vertex?: { project: string; location?: string };
  apiKey?: string;
}

/**
 * Geçici sağlayıcı hataları (429 kota/yoğunluk, 503) için TEK katmanlı kısa yeniden deneme:
 * 2 sn, sonra 6 sn. Üst katmanlar ayrıca denemez (iç içe yeniden deneme = donma; AutoViz dersi).
 * Kalıcı hata (400, şema) denenmez.
 */
async function denemeli<T>(fn: () => Promise<T>): Promise<T> {
  const bekle = [2000, 6000];
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const metin = err instanceof Error ? err.message : String(err);
      const gecici = /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE/.test(metin);
      if (!gecici || i >= bekle.length) throw err;
      await new Promise((r) => setTimeout(r, bekle[i]));
    }
  }
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
  const fastModel = opts.fastModel ?? 'gemini-2.5-flash';
  /**
   * Çağrı + yedek: kalite modeli geçici hatayı (429/503) denemelerden sonra da veriyorsa istek
   * bir kez hızlı modelle yapılır — ayrı kota havuzu; canlı demoda "Beklenmeyen hata" yerine
   * biraz daha sade ama çalışan bir cevap. Hangi modelin cevapladığı kullanım kaydına yazılır.
   */
  async function gen(req: Parameters<typeof client.models.generateContent>[0]) {
    try {
      return { res: await denemeli(() => client.models.generateContent(req)), used: req.model };
    } catch (err) {
      const metin = err instanceof Error ? err.message : String(err);
      const gecici = /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE/.test(metin);
      if (!gecici || req.model === fastModel) throw err;
      console.warn(`[llm] ${req.model} geçici hata; ${fastModel} ile yedek çağrı`);
      return {
        res: await client.models.generateContent({ ...req, model: fastModel }),
        used: fastModel,
      };
    }
  }
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
    kullanilan: string = model,
  ): LlmUsage => ({
    inputTokens: u?.promptTokenCount ?? 0,
    outputTokens: u?.candidatesTokenCount ?? 0,
    model: kullanilan,
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
      const { res, used } = await gen({
        model,
        contents,
        config: {
          ...(system ? { systemInstruction: system } : {}),
          maxOutputTokens: o?.maxTokens ?? 1024,
        },
      });
      return { text: res.text ?? '', usage: usageOf(res.usageMetadata, started, used) };
    },
    async structured(messages, schema, o) {
      const started = Date.now();
      const { system, contents } = split(messages);
      // ⚠ Gemini 2.5'te düşünme tokenleri maxOutputTokens'tan düşer; bütçeyi ayrıca ayırmazsak
      // JSON yarıda kesilir ("Unterminated string"). Çağıranın maxTokens'ı cevap içindir.
      // Hızlı kademe: Flash, düşünme bütçesi küçük — ihtiyaç sohbetinde tur ~15 sn → birkaç sn.
      const secilen = o?.tier === 'fast' ? fastModel : model;
      const butce = o?.tier === 'fast' ? 256 : THINKING_BUDGET;
      const { res, used } = await gen({
        model: secilen,
        contents,
        config: {
          ...(system ? { systemInstruction: system } : {}),
          maxOutputTokens: (o?.maxTokens ?? 2048) + butce,
          thinkingConfig: { thinkingBudget: butce },
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(schema),
        },
      });
      if (res.candidates?.[0]?.finishReason === 'MAX_TOKENS')
        throw new Error(`Model çıktısı token sınırında kesildi (${o?.schemaName ?? 'şema'})`);
      const text = res.text;
      if (!text) throw new Error('Model şemalı çıktı üretmedi');
      const ilk = schema.safeParse(JSON.parse(text));
      if (ilk.success) return { value: ilk.data, usage: usageOf(res.usageMetadata, started, used) };
      // Gemini JSON şemasındaki min/max kısıtlarını her zaman tutmuyor (ör. 7 yerine 9 iddia,
      // 400 yerine 520 karakter). Bir kez, ihlalleri söyleyerek yeniden iste; yine tutmazsa hata.
      const ihlaller = ilk.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join('.') || '(kök)'}: ${i.message}`)
        .join('; ');
      const { res: tekrar, used: used2 } = await gen({
        model: used,
        contents: [
          ...contents,
          { role: 'model', parts: [{ text }] },
          {
            role: 'user',
            parts: [
              {
                text: `Çıktı şemaya uymadı: ${ihlaller}. Aynı içeriği bu kısıtlara UYARAK yeniden üret (fazla maddeleri birleştir, uzun metinleri kısalt).`,
              },
            ],
          },
        ],
        config: {
          ...(system ? { systemInstruction: system } : {}),
          maxOutputTokens: (o?.maxTokens ?? 2048) + butce,
          thinkingConfig: { thinkingBudget: butce },
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(schema),
        },
      });
      const metin2 = tekrar.text;
      if (!metin2) throw new Error('Model şemalı çıktı üretmedi (ikinci deneme)');
      return {
        value: schema.parse(JSON.parse(metin2)),
        usage: usageOf(tekrar.usageMetadata, started, used2),
      };
    },
  };
}
