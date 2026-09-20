# Demo senaryosu — 5 dakika, 3 dakika soru

Jüri kriterleri: problem–çözüm uyumu · teknik yetkinlik ve kod kalitesi · AI entegrasyonu
(ölçülebilir) · UI/UX · çalışan demo. Senaryo her kriteri en az bir kez **ekranda** gösterir.
Anlatım değil, tıklama. Tek cümlelik giriş, sonra ürün konuşur.

## Hazırlık (sunumdan 30 dk önce)
- Canlı adreste `db:seed` sonrası şu durum: Ayşe (onaylı kart, 4 kaynak), Mehmet (onaylı kart),
  Demo Mağaza A.Ş. (onaylı kurum, üyesi kurum@evidex.dev), operatör operator@evidex.dev.
- Üç tarayıcı sekmesi açık ve giriş yapılmış: **kurum**, **operatör**, **genç** (Ayşe).
  Dördüncü sekme: API konsolu (e-postalar burada görünür; SMTP yoksa).
- Telefon: Expo build'i Ayşe hesabıyla açık, kart ekranında.
- Ölçüm paneli sıfır değil: en az bir gerçek ihtiyaç/eşleşme/takip önceden koşmuş olsun (aşağıdaki
  akış bir kez prova edilir, ikinci koşu demodur).
- LLM: Gemini 2.5 Pro (Vertex); bir çağrı 10–25 sn. Bekleme anlarında konuşulacak cümleler
  aşağıda **[bekleme]** ile işaretli.
- Yedek: LLM düşerse `LLM_PROVIDER=fake` ile aynı akış saniyeler içinde koşar (jüriye söylenir:
  "sahte sağlayıcı, aynı şema").

## Akış (dakika dakika)

**0:00 — Tek cümle.** "GİRVAK'ın altı ihtiyaç alanı bizde tek döngü: genç kanıt bağlar, kurum
derdini söyler, ajan eşleştirir ve takip eder, GİRVAK onaylar." Açılış sayfasında döngü kartları
görünür (kriter: problem–çözüm uyumu).

**0:20 — Genç (telefon + web).** Ayşe'nin kartı: her iddiada seviye rozeti, kaynak sayısı,
tarih aralığı. "Kod saklanmaz; GitHub App sinyal okur." Telefonda aynı kart; bir iddiayı
onayla → web'de anında görünür. Paylaşılabilir linki aç, `/k/…` sayfasını göster: e-posta yok,
GitHub adı yok, yalnız onaylı iddialar. (kriter: UI/UX, doğrulama 02)

**1:10 — Kurum.** "Kafemiz için masadan sipariş alan basit bir web ekranı lazım, iki ay içinde"
yaz. Ajan bir soru sorar; cevapla; kart sağda canlı dolar. **[bekleme]** "Ajan en çok yedi
soru sorar; kart üçüncü kişinin uygulayabileceği kadar net olunca durur." Kartı onayla.
(kriter: AI entegrasyonu, tanımla 05)

**2:00 — Operatör: kuyruk.** Eşleştirme koştu; "kısa listeyi kuruma aç" önerisi kuyrukta:
1 güçlü, 1 olası. Onayla. Kurum sekmesine geç: adaylar ilk adla, "uyuyor çünkü şu kanıt /
eksik olan şu". Skor yok. "Tanıştırılmak istiyorum" tıkla. **[bekleme]** "Ajan tanıştırma
e-postasını yazıyor; operatör düzeltip onaylar, yoksa gitmez." (kriter: eşleştir 03, ADR-0004)

**2:50 — Operatör: onay.** Kuyrukta tanıştırma taslağı, "Kurum istedi · ajan taslağı" etiketi.
Onayla → API konsolunda iki e-posta. Kurum sekmesi: aday artık tam adla.

**3:15 — İzle.** Operatör "İş birlikleri" ekranı: kayıt açıldı. "Şimdi tara" → tanıştırma
3 günden yeniyse öneri düşmez; **prova verisinde** 4 gün önceki tanıştırma vardır → takip
sorusu kuyrukta, iki tarafa ayrı metin. Onayla → e-postada tek kullanımlık link. Linki aç:
kurum "Tamamlandı" + iki cümle not → gönder. **[bekleme]** Operatör ekranında ajan özeti ve
bayraklar; Ayşe'nin kartında **referanslı** taslak iddia. "Referans yalnız GİRVAK onaylı
kurumdan, platformda izlenen iş birliğinden." (kriter: izle 06, KARAR-10)

**4:15 — Keşfet + ölçüm.** Ağ ekranı: keşif ajanı → "Ara ve öner" (prova edilmiş sonucu göster,
canlı çağrı 25 sn): 12 profil, 5 seçim, gerekçeler; davet kuyrukta, onay olmadan gitmez.
Ölçüm paneli: kart doğruluğu, ihtiyaç netliği, önerilerin akıbeti — hepsi paydalı. "AI süs
değil: her çağrı kayıtlı, her öneri onay/düzeltme/red ile ölçülür." (kriter: AI, keşfet 01,
canlı tut 04)

**4:50 — Kapanış.** GitHub reposu: 36 test, CI yeşil, 7 ADR, devir + 4 aylık yol haritası +
eğitim planı (`docs/04`). "4 ayda GİRVAK'ın masasında çalışır; ilk ay pilot."

## Soru bankası (3 dk)
| Soru | Cevap (≤ 20 sn) |
|---|---|
| AI yanlış karar verirse? | Karar vermez; önerir. Kuyrukta düzeltme/red oranı panelde. Şemalı çıktı, uydurulan id'ler kodda atılır. |
| GitHub'ı olmayan genç? | Canlı link + belge + meydan okuma; Ay 2'de Behance. Meydan okuma kanıtsız gence kanıt kazandırır. |
| KVKK? | Kod/belge saklanmaz, yalnız sinyal; keşifte profil saklanmaz; davet yalnız açık e-postaya, onayla. Ay 1'de silme ucu. |
| Neden Gemini? | Sağlayıcı soyutlaması (ADR-0002); Vertex kredisi vardı. Anthropic aynı arayüzle çalışıyor, testler sahte sağlayıcıyla. |
| İki kişi birbirini şişiremez mi? | Referans yalnız operatörün onayladığı kurumdan ve platformda izlenmiş iş birliğinden (KARAR-10). Dış beyan en alt seviye. |
| Ölçek? | Tek VM yeter; ajan çağrısı ihtiyaç başına birkaç bin token. Çoklu süreçte tek eksik: zamanlayıcı kilidi (ADR-0006'da yazılı). |
| Neden ilan yok? | İlan kurumun çözümü tahmin etmesidir; ihtiyaç kartı problemi yazar, ajan yapılandırır — 05'in tarifi bu. |

## Üç prova
1. **Prova 1 (tam akış, sahte LLM):** senaryo baştan sona, süre ölçülür; takılan tıklama not edilir.
2. **Prova 2 (gerçek LLM, canlı adres):** bekleme sürelerinde söylenecek cümleler oturur; kayıt.
3. **Prova 3 (soru-cevap):** biri jüri olur, soru bankasından ve dışından sorar; cevaplar 20 sn.
