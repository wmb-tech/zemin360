# ADR-0003 · Kanıt modeli: kaynak → sinyal → iddia (seviye + zaman)

**Durum:** Kabul · 20 Eyl 2026

## Bağlam
Ürünün tezi "beyan değil kanıt". Kanıt türleri farklı (repo, canlı URL, belge, referans,
meydan okuma teslimi); hepsi tek karta akmalı; kod saklanmamalı (KVKK, depolama, güven).

## Karar
Üç katman:

1. **Kaynak (`evidence_sources`)** — kişinin bağladığı şey: `github_repo`, `live_url`,
   `document`, `network_reference`, `challenge_submission`. Sahiplik doğrulama yöntemi
   kaynağa göre: GitHub App kurulumu, alan adı meta etiketi, belge yükleme, kurum hesabı
   onayı, platform içi teslim.
2. **Sinyal (`evidence_signals`, jsonb)** — kaynaktan makine tarafından çıkarılan olgular:
   diller, araçlar, ilk/son etkinlik tarihi, commit sahipliği oranı, katkıcı sayısı, canlıya
   alınmışlık, test/README varlığı, belge özeti. **Ham içerik (kod, belge metni) saklanmaz;**
   yalnız sinyal ve kaynağa işaretçi.
3. **İddia (`card_claims`)** — kartta görünen cümle. Her iddianın: kaynağı (≥1 sinyal),
   **seviyesi** (`verified` / `documented` / `referenced` / `declared`), **zaman aralığı**,
   ve **onay durumu** (kişi onaylamadan görünmez).

Seviye kuralı: `verified` yalnız platformun sahipliğini doğruladığı kaynaklardan;
`referenced` yalnız GİRVAK onaylı kurum hesabından ve kayıtlı iş birliği sonunda;
`declared` kişinin kendi yazdığı, kaynağı olmayan iddia.

## Gerekçe
Kurum kartı okurken "bu cümle nereden geliyor, ne zamandan beri, kim tanıklık ediyor"
sorularına tıklayarak cevap alır. Yeni kanıt türü eklemek = yeni kaynak sağlayıcısı, model
değişmez. Kod saklamamak güven ve KVKK yükünü düşürür.

## Sonuçlar
Kanıt sağlayıcıları `packages/evidence/providers/<ad>` altında ortak arayüzle. Kart
yeniden hesaplanabilir: sinyaller güncellenince iddialar taslak olarak yenilenir, kişi tekrar
onaylar (canlı ağ adımı).


## Ek (20 Eyl): belge kaynağı
PDF yüklenir, metin çıkarılır, dosya atılır. Saklanan: sayfa, kelime sayısı, sha256, başlık, kurum satırı, yıllar,
tür (sertifika/yarışma/staj/referans/transkript) ve ≤ 8 satır / ≤ 400 karakter alıntı. Alıntı belgenin ne olduğunu
söyler, içeriğini kopyalamaz. Sahiplik makineyle doğrulanamaz → seviye **documented**.
