# Evidex — tasarım briefi

## Ürün tek paragrafta
Evidex, GİRVAK (Girişimcilik Vakfı) gençlik ağı için bir platform: gençler kendilerini
anlatmak yerine **kanıt bağlar** (GitHub repoları, canlı ürünler, belgeler); bir ajan bu kanıttan
bir **yetkinlik kartı** taslağı yazar, genç onaylar. Kurumlar ilan yazmak yerine **derdini
anlatır**; ajan birkaç soru sorup net bir **ihtiyaç kartı** çıkarır. Eşleşme skor değil
**gerekçe**dir ("şu kanıt var, uyuyor; şu eksik"). GİRVAK operatörü ajanın her dışa dönük adımını
tek bir **onay kuyruğundan** onaylar; tanıştırma sonrası iş birliği izlenir, biten iş birliği
gencin kartına **referans** olarak döner. Slogan: **"Beyan değil kanıt. Skor değil gerekçe."**

Bağlam: Zemin360 Hackathon (GİRVAK · İstanbul Kalkınma Ajansı · İstanbul Bilgi Üniversitesi).
Kazanan ekip platformu 4 ay boyunca GİRVAK için canlı ürüne taşıyor; yani bu bir demo değil,
vakfın günlük aracı olacak. Jüri kriterlerinden biri UI/UX (%20). Canlı: evidex.wmbyazilim.com.

## Üç kullanıcı, üç ekran takımı
| Rol | Kim | Ne yapıyor | Cihaz/bağlam |
|---|---|---|---|
| **Genç** (18–30) | öğrenci / yeni mezun, GitHub'ı var, kendini anlatmayı sevmiyor | kanıt bağlar, taslak iddiaları onaylar/siler, kartını paylaşır, meydan okumaya katılır, eşleşmelerini görür | laptop + telefon (Expo uygulaması var), akşam |
| **Kurum** | KOBİ sahibi, startup kurucusu, STK yöneticisi; teknik olmayabilir | derdini yazar, ajanın sorularına cevap verir, kartı onaylar, gerekçeli adayı okur, "tanıştırılmak istiyorum" der | masaüstü, mesai, 1 dakikada karar |
| **GİRVAK operatörü** (2–3 kişi) | vakıf çalışanı | kuyruğu onaylar/düzenler/reddeder, ağı ve iş birliklerini izler, kurum onaylar, keşif ve meydan okuma başlatır, ölçüme bakar | masaüstü, uzun oturum, yoğun bilgi |

## Ürünün kalbi: kanıt seviyeleri
Her iddia bir seviyedir ve bir bakışta ayrılmalı, ama "rozet/skor oyunu" hissi vermemeli:
- **Doğrulanmış** — sahipliği makineyle kanıtlandı (GitHub App, alan adı etiketi)
- **Belgeli** — belgeyle destekli (PDF)
- **Referanslı** — platformda izlenmiş iş birliği sonunda GİRVAK onaylı kurumun değerlendirmesi
- **Beyan** — kişinin sözü, henüz kanıtsız
Her iddia: 2–4 cümle metin · seviye · dönem (Ağu 2026 → Eyl 2026) · kaynak(lar) (repo adı, site, belge).
Eşleşme gücü: güçlü / olası / zayıf — sayı yok. Kurum, tanıştırmaya kadar gencin yalnız ilk adını görür.

## Ekranlar (ekran görüntüleri bu klasörde, şu anki hâl)
1. `01-acilis` — açılış sayfası (oturumsuz; jüri ve GİRVAK'ın ilk gördüğü)
2. `02-genc-durum` — gencin ana sayfası: kart durumu, sıradaki adım, eşleşmeler
3. `03-genc-kart` — kanıt kaynakları (GitHub kurulumları, canlı ürün, belge) + kart: başlık, hikâye, iddialar (toplu seçim), paylaşılabilir link
4. `04-kurum-ihtiyac` — kurumun ajanla sohbeti (sol) ve canlı dolan ihtiyaç kartı (sağ)
5. `05-kurum-adaylar` — gerekçeli aday listesi: uyuyor / eksik, tanıştırma isteği
6. `06-operator-kuyruk` — onay kuyruğu (kısa liste, tanıştırma, takip, davet)
7. `07-operator-ag` — ağ: gençler (kanıt dağılımı, sessiz kart), kurumlar (onay), keşif ve toplu davet
8. `08-operator-isbirlikleri` — iş birlikleri: takip cevapları, çelişki/sessiz işaretleri
9. `09-operator-olcum` — ölçüm paneli: AI'ın katkısı sayıyla (paydalı)
Ayrıca: giriş sayfası (GitHub / e-posta sihirli link), herkese açık kart `/k/:slug`, takip cevabı
sayfası `/takip/:token` (e-postadan gelen tek soru), meydan okumalar (genç + operatör), Expo
mobil (genç: kart + meydan okumalar).

## Nasıl hissettirmeli
Onlarca kurumun ve yüzlerce gencin kullandığı **bitmiş bir kurum ürünü**; sakin, kararlı,
güvenilir — ama genç bir ağ için. Bilgi yoğun ekranlarda (operatör) okunurluk ve tarama hızı;
genç ekranlarında sıcaklık ve netlik ("kartın ağda, sırada şu var"); kurum ekranında "1 dakikada
karar" — gerekçe metni sayının önünde.

**Yapma:** emoji; gradyan yazı; koyu tema + neon; kart içinde kart; her şeyi ortalama; aynı
boyutlu ikon+başlık+metin kart ızgarası; büyük sayı + küçük etiket "metrik kahramanı"; cam efekti;
tek tarafı kalın renkli kenarlık; dekoratif mini grafik; modal (mümkünse); İngilizce kalıptan
çeviri cümle. Yazı tipi Inter/Roboto/Arial olmasın.

## Teknik çerçeve
- Web: React 19 + Tailwind v4; tokenler `@theme` bloğunda (`apps/web/src/index.css`): renk (oklch),
  yazı tipi, boşluk. Şu an tek yazı tipi Manrope, ışık tema.
- Mobil: Expo/React Native; aynı tokenler `apps/mobile/src/lib/theme.ts`.
- Erişilebilirlik: klavye, AA kontrast, `prefers-reduced-motion`.
- Hedef genişlikler: 390 (telefon), 768, 1280+ (masaüstü). Operatör ekranları 1280+ öncelikli.
- Marka: yalnız kelime işareti "Evidex"; logo yok (istenirse tasarlanabilir).

## Teslim beklentisi
1. Token seti: renk paleti (nötrler markaya tonlu, 4 kanıt seviyesi rengi, 3 eşleşme gücü),
   tip ölçeği (5 boy), boşluk ritmi, köşe/çizgi dili, gölge (varsa), hareket süreleri/eğrileri.
2. Bileşenler: kabuk (menü + alt bilgi, telefon), düğme hiyerarşisi, form alanları, iddia
   kartı/satırı, seviye ve güç rozetleri, kaynak çipi, boş/yükleniyor/hata durumları, tablo/liste
   (operatör), sohbet balonu + canlı kart (kurum), kuyruk kaydı.
3. Yukarıdaki 9 ekranın yeniden tasarımı (masaüstü) + genç ekranlarının telefon hâli.
4. Hareket: bir sayfa yükleme orkestrasyonu (kademeli giriş) + durum geçişleri; dağınık
   mikro-animasyon değil.
Format: Figma ya da doğrudan Tailwind/React (tokenler CSS'e girecek).
