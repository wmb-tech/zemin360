# Devir, dört aylık yol haritası ve eğitim planı

Jüri "en iyi demo"yu değil "bize platformu yapacak ekibi" seçiyor. Bu belge üç soruya cevap
verir: **bugün ne teslim ediliyor**, **dört ayda ne olacak**, **GİRVAK bunu nasıl kullanmayı
öğrenecek**. Tarihler hackathon sonrası sözleşme başlangıcına göre (varsayım: 20 Ekim 2026)
göreli yazıldı; sözleşme imzalanınca takvime çevrilir.

---

## 1. Devir: 11 Ekim'de teslim edilen

### Çalışan ürün
- Döngünün altı adımı web'de uçtan uca çalışıyor; dokuz ajan, tek onay kuyruğu, ölçüm paneli.
- Roller: genç (kart, kanıt, meydan okumalar, paylaşılabilir kart), kurum (ihtiyaç sohbeti,
  aday listesi, tanıştırma isteği, meydan okuma sonuçları), GİRVAK operatörü (kuyruk, ağ,
  keşif, iş birlikleri, meydan okumalar, ölçüm).
- Oturumsuz yüzeyler: `/k/:slug` paylaşılabilir kart, `/takip/:token` takip cevabı.
- Mobil: genç tarafı (Expo) — bkz. `apps/mobile`.

### Kod ve süreç
- Tek monorepo, tek dil (TypeScript), tek komutla ayağa kalkar (`README.md`).
- `bun run check` = lint + biçim + tip + test; pre-commit ve CI aynı kapı. Testler gerçek
  Postgres üstünde uçtan uca koşar (sahte LLM/GitHub/e-posta ile).
- Her mimari karar `docs/adr/` altında gerekçesiyle; ürün kuralları `docs/01`, karar defteri
  `docs/02`, geliştirme kuralları `docs/03`, iş listesi `docs/backlog.md`.
- Ajan çağrıları `agent_runs` tablosunda (sağlayıcı, model, süre); ölçüm paneli buradan.

### Canlıya almak için gerekenler (GİRVAK tarafı)
| Ne | Neden | Kim |
|---|---|---|
| Alan adı + sunucu (tek VM yeter; Docker) | canlı adres | GİRVAK / WMB |
| SMTP hesabı (`SMTP_URL`) | sihirli link, tanıştırma, takip, davet e-postaları | GİRVAK |
| GitHub App (WMB'nin kurduğu "Evidex by WMB" GİRVAK org'una taşınır) | genç girişi + repo kanıtı | WMB → GİRVAK |
| Google Cloud projesi ya da Anthropic anahtarı | ajanlar | GİRVAK (fatura) |
| GitHub sunucu token'ı | keşif ajanı ve teslim okuma | GİRVAK |
| KVKK aydınlatma metni ve rıza kutusu | genç ve kurum verisi | GİRVAK hukuk + WMB (ekran) |

### Bilinen sınırlar (dürüst liste)
- Belge (PDF) sahipliği makineyle doğrulanamaz; belge yalnız "belgeli" seviyesi verir, dosya saklanmadığı için sonradan denetim operatörün elindeki asıl belgeyle yapılır.
- Koyu tema yok. Erişilebilirlik denetimi (WCAG) yapılmadı.
- Zamanlayıcı tek süreç; çoklu süreçte kilit gerekir (ADR-0006).
- Keşif yalnız GitHub; tasarımcı/içerik üreticisi için Behance/Dribbble yolu haritada.
- E-posta dışında bildirim kanalı yok (WhatsApp/SMS yolda değil, karar GİRVAK'ın).

---

## 2. Dört aylık yol haritası

İlke: her ay sonunda GİRVAK'ın **gerçek kullanıcıyla** kullandığı bir sürüm. Özellik değil,
kullanım ölçülür.

### Ay 1 — Canlı ve pilot (hafta 1–4)
- Canlı ortam, HTTPS, yedekleme (günlük `pg_dump`, 30 gün), izleme (hata + ajan gecikmesi).
- KVKK: aydınlatma, rıza, veri silme talebi ucu ("kartımı sil" → kaynaklar ve iddialar dahil).
- Pilot: GİRVAK'ın seçtiği **10 genç + 3 kurum**. Operatör eğitimi (bkz. §3). İlk gerçek
  ihtiyaç kartları, ilk tanıştırmalar.
- Ölçüm: kart doğruluğu ve ihtiyaç netliği ilk gerçek sayıları; ajan önerilerinde düzeltme
  oranı yüksekse prompt/şema revizyonu.
- Çıktı: canlı adres, pilot raporu #1.

### Ay 2 — Kanıt genişlemesi ve mobil (hafta 5–8)
- Belge doğrulama: yayıncı kurum e-postasıyla teyit (TEKNOFEST, üniversite) → belgeli+.
- Behance/Dribbble/Figma canlı link sinyali (tasarım profilleri için).
- Mobil (genç tarafı) mağazalarda: kart, kanıt bağlama, meydan okumalar, takip cevabı, bildirim.
- Kurum tarafında "ihtiyaç şablonları" (GİRVAK'ın sık gördüğü 5 ihtiyaç türü).
- Çıktı: pilot 30 genç + 8 kurum; pilot raporu #2.

### Ay 3 — Ağın canlılığı (hafta 9–12)
- Meydan okuma takvimi (ayda bir GİRVAK meydan okuması; kurum sponsorlu).
- Keşif kanalları: üniversite kulüpleri listesi, etkinlik katılımcıları; keşif ajanına
  Behance kaynağı.
- Referans döngüsü: biten iş birliklerinin kartlara akması; "sessiz kart" için otomatik
  meydan okuma daveti.
- Operatör raporu: aylık PDF/e-posta (ölçüm panelinin özeti, yönetim kuruluna).
- Çıktı: ilk referanslı kartlar; pilot raporu #3.

### Ay 4 — Sertleştirme ve devir (hafta 13–16)
- Yük ve güvenlik gözden geçirmesi (oturum, token, SSRF, hız sınırı), erişilebilirlik turu.
- Çok kiracılılık için hazırlık (kiracı sütunu; başka vakıflar için yol açık, aktif değil).
- Dokümantasyon: operatör el kitabı, kurum kılavuzu, genç için "kartını nasıl güçlendirirsin".
- Teslim: kaynak kod GİRVAK org'unda, altyapı hesapları GİRVAK'ta, WMB destek anlaşması
  (isteğe bağlı).
- Çıktı: kabul testi, devir tutanağı.

### Kapsam dışı (bilinçli)
- Ödeme/faturalama, sözleşme yönetimi (iş birliği kaydı durum tutar, sözleşme değil).
- LinkedIn/İK sistemleri entegrasyonu (API ve hukuk gereği).
- Gençlerin birbirini puanlaması (KARAR-10'a aykırı).

---

## 3. Eğitim planı

Üç kitle, üç format. Hepsi kayıt altına alınır (video + kısa yazılı kılavuz), platform içinde
"?" linkleriyle erişilir.

| Kitle | Format | Süre | İçerik |
|---|---|---|---|
| GİRVAK operatörleri (2–3 kişi) | Yüz yüze atölye + 2 hafta eşlikli kullanım | 3 saat + 2 hafta | Onay kuyruğu okuma (ne zaman düzelt, ne zaman reddet), kurum onayı (KARAR-10), keşif ve davet, iş birliği ekranı (çelişki/sessiz), ölçüm panelinin yorumu, ajan hatası şüphesinde ne yapılır |
| Kurumlar | 30 dk çevrim içi + 1 sayfalık kılavuz | 30 dk | İhtiyaç sohbeti (derdini yaz, soruya cevap ver), kartı düzeltme, aday gerekçesini okuma, tanıştırma isteği, takip sorusuna cevap, referans vermenin anlamı |
| Gençler | Platform içi rehber + 10 dk video + kulüp buluşması | 10 dk | GitHub App ve repo seçimi (kod saklanmaz), iddiaları onaylama/düzeltme, paylaşılabilir kart, meydan okumaya katılma, takip sorusu |

Eğitim başarı ölçütü: operatör ilk iki haftada ajan önerilerinin ≥%70'ini düzeltmeden
onaylayabiliyor; kurum ilk ihtiyacını yardım almadan onaylıyor; genç ilk kartını 20 dakikada
onaylıyor. Ölçülemeyen eğitim yapılmış sayılmaz.

---

## 4. Riskler ve karşılıkları

| Risk | Karşılık |
|---|---|
| Ajan çıktısı hatalı/yanlı | Her çıktı şemalı ve insan onaylı; düzeltme oranı panelde; eşik aşılırsa prompt revizyonu |
| GitHub'ı olmayan gençler (tasarım, içerik) | Canlı link + belge + meydan okuma yolu; Ay 2'de Behance |
| Kurum takip sorusuna cevap vermiyor | Sessizlik görünür; operatör arar; 3 sessizlik = kurum notu |
| LLM maliyeti | Çağrı başına ~1–3k token; 100 genç + 30 kurum/ay ≈ ₺500–1.500/ay; sağlayıcı değiştirilebilir |
| Veri/KVKK | Kod ve belge saklanmaz, yalnız sinyal; silme ucu Ay 1; keşifte profil saklanmaz |
