# ADR-0002 · LLM: sağlayıcı soyutlaması, varsayılan Claude

**Durum:** Kabul · 20 Eyl 2026 · **Güncelleme 20 Eyl:** varsayılan sağlayıcı Google Gemini (Vertex AI); Claude ikinci uygulama olarak duruyor

## Bağlam
Platform açık kaynak ve GİRVAK'a devredilecek; ajanlar (kart taslağı, ihtiyaç yapılandırma,
gerekçeli eşleşme, takip mesajları, meydan okuma değerlendirme, keşif) LLM kullanır. Kapalı
bir modele sert bağımlılık, devralan tarafın seçim özgürlüğünü ve maliyet kontrolünü alır.
Jüri "AI'ın yerinde, anlamlı ve ölçülebilir kullanımı"nı puanlıyor.

## Karar
- Tüm LLM çağrıları tek bir `packages/ai` arayüzünden geçer: `complete()`, `structured()`
  (Zod şemalı çıktı), `embed()`. Sağlayıcı env ile seçilir.
- Sağlayıcılar: **Google Gemini** (Vertex AI: proje + ADC/servis hesabı; ya da AI Studio
  anahtarı) ve **Claude (Anthropic)**. Varsayılan Gemini 2.5 Pro / Vertex — hackathon
  döneminde kullanım ekibin Google Cloud kredisinden yenir; kalite ihtiyaç yapılandırmada
  ölçüldü (21 Eyl). ⚠ Vertex ile AI Studio ayrı faturalama kovaları: kredi yalnız Vertex'te
  geçer. OpenAI-uyumlu uç (yerel/açık modeller) yol haritasında — devir için.
- Her ajanın istemi (prompt) repoda, sürümlü, testli: `packages/ai/agents/<ad>/`.
- Her ajan çıktısı **şemalı** (Zod). Serbest metin yalnız gerekçe alanlarında.
- Ölçüm: her ajan çağrısı `agent_runs` tablosuna girdi/çıktı özeti, süre, maliyet, ve sonraki
  insan eylemiyle (onay / düzeltme / red) kaydedilir. Ölçüm paneli buradan beslenir.

## Gerekçe
Soyutlama devredilebilirlik şartını karşılar; şemalı çıktı ajanı UI'a bağlanabilir ve test
edilebilir kılar; `agent_runs` "AI süs değil" iddiasının kanıtıdır. Claude varsayılan: Türkçe
kalite, yapılandırılmış çıktı ve araç kullanımı; ekipte üretim deneyimi.

## Reddedilenler
- **Tek sağlayıcıya doğrudan SDK çağrıları:** devredilemez, ölçülemez.
- **Yalnız açık model:** Türkçe yapılandırma kalitesi 3 haftalık takvimde risk; ikinci
  uygulama olarak yol haritasında.

## Sonuçlar
API anahtarları yalnız sunucuda; istemci LLM'e doğrudan konuşmaz. Ajan istemi değişikliği
= test + kayıt.
