# Ürün Kimliği

**Durum: KİLİTLİ — 20 Eylül 2026.** Bu belge kod öncesi katmandır; feature'lar buradan türer,
tersi olmaz. Değişiklik yalnız `docs/02-acik-kararlar.md` üzerinden, kayıtlı biçimde yapılır.

Bağlam: Zemin360 Hackathon (GİRVAK · İstanbul Kalkınma Ajansı · İstanbul Bilgi Üniversitesi).
Birinci ekip GİRVAK ile hizmet sözleşmesi imzalar, platformu 4 ayda pilotu ve kullanıcı
eğitimleriyle canlı ürüne taşır. Bu bir ürün fikri yarışması değil, **müşterili bir platform
yarışması**dır: müşteri GİRVAK, kullanıcılar GİRVAK'ın ağındaki gençler ve kurumlar. Her karar
şu soruyla alınır: **"GİRVAK bunu dört ay sonra gerçekten kullanır mı?"**

---

## 1. Nedir?

GİRVAK'ın genç yetenek ↔ kurum ağını **tek bir döngü** olarak işleten, açık kaynaklı platform:

```
keşfet (01) → doğrula (02) → ihtiyacı tanımla (05) → eşleştir (03) → izle (06) → canlı tut (04) → keşfet …
```

Her adımda işi bir **ajan** yapar, **GİRVAK operatörü onaylar.** Sistem beyanla değil kanıtla
çalışır; eşleşme skor değil gerekçedir; hiçbir kart onaysız ağa girmez.

Beş nesnesi vardır: **kişi kartı**, **kurum kartı**, **ihtiyaç kartı**, **eşleşme**, **iş
birliği kaydı**. Altı adım bu beş nesne üstünde işlemdir.

## 2. Vizyon ve misyon

**Vizyon:** Türkiye'de genç bir yeteneğin "ne yapabildiği", kendini ne kadar iyi anlattığına
değil, ne yaptığına bakılarak anlaşılsın.

**Misyon:** GİRVAK'ın ağında beyanı kanıta, muğlak talebi net ihtiyaca, eşleşmeyi gerekçeye
çevirmek; kurulan her bağlantının sonucunu kayda geçirip ağı canlı tutmak.

## 3. Problem tanımı

GİRVAK'ın onboarding sunumundaki altı ihtiyaç alanı (birebir):

| # | İhtiyaç alanı | GİRVAK'ın tarifi | Döngüdeki adım |
|---|---|---|---|
| 01 | Genç yeteneklerin keşfi | Sektördeki genç yeteneklerin doğru kanallarla görünür olamaması ve fırsatlara erişememesi | keşfet |
| 02 | Profil & portfolyo doğruluğu | Kişilerin beyan ettiği deneyim, beceri ve portfolyonun güvenilir biçimde doğrulanamaması | doğrula |
| 03 | Kurum–kişi eşleşmesi | Kurumların ihtiyaçları ile bireylerin ve girişimlerin yetkinliklerinin sağlıklı biçimde eşleştirilememesi | eşleştir |
| 04 | Yaşayan bir ağ | Bir kez kurulan bağlantıların sürdürülememesi; etkileşimin canlı kalmadığı statik ağlar | canlı tut |
| 05 | İhtiyaçların net tanımı | Kurumların gerçek problemlerini yapılandırılmış ve çözülebilir biçimde ifade edememesi | tanımla |
| 06 | Şeffaf iş birliği takibi | İş birliği ve pilot süreçlerinin ilerleyişinin şeffaf ve ölçülebilir biçimde izlenememesi | izle |

Altısı ayrı problem değil, tek akışın altı kayıp noktasıdır; kök neden **beyan** ve **kopuk
adımlar**dır. Platform altısını birden ele alır (jüri kriteri: "seçilen ihtiyaç alanına gerçekten
cevap veriyor mu").

## 4. Mevcut çözüm yöntemleri

| Yöntem | Ne yapıyor | Neden yetmiyor |
|---|---|---|
| LinkedIn, Kariyer.net, Youthall | Öz beyan profili + ilan + skor | Girdi beyan; 2026'da AI ile şişirilmiş profil yaygın; eşleşme kapalı kutu |
| Vakfın mevcut akışı (form + tablo + insan) — *varsayım, 21 Eyl office hour'da teyit edilecek* | Başvuru, tanıştırma e-postası, kişisel hafıza | Ölçeklenmiyor, kurumsal hafıza kişilerde, sonuç izlenmiyor |
| ATS'ler | Kurum içi aday takibi | Kurumun aracı, ekosistemin değil |
| GitHub/Behance profilleri | Kanıtın kendisi | Yapılandırılmamış, kurum okuyamıyor |

Boşluk: kanıtı okuyup karşılaştırılabilir karta çeviren, eşleşmeyi gerekçelendiren ve
tanıştırma sonrasını izleyen **tek döngü** yok.

## 5. Çözüm — döngü adım adım

### Doğrula (02)
Genç GitHub App kurar, göstereceği repoları seçer (private dahil; kod saklanmaz, okunur:
diller, araçlar, süre, commit ritmi, katkıcılar, canlıya alınmışlık, test/README, commit
sahipliği). İkinci kaynak canlı URL (alan adı doğrulama etiketi + tarama), üçüncüsü belge (PDF).
Ajan **kişi kartı taslağı** yazar; her madde kaynağına bağlı, **seviyeli** (doğrulanmış /
belgeli / referanslı / beyan) ve **zamanlı** ("14 aydır sürdürülüyor"). Hikâye bloğu kanıttan
otomatik yazılır; genç ekler, düzeltir, **onaylar**. Onaysız kart ağa girmez.

### Tanımla (05)
Kurum derdini serbest metinle yazar. Ajan 5–7 soru sorar: mevcut ürün, çıktı, süre, **iş birliği
türü** (staj / proje / yarı zamanlı / tam zamanlı / pilot müşteri / kurucu ortak / mentor),
karşılık, uzaktan-yerinde, kimin yanında. Çıkan **ihtiyaç kartı** üçüncü kişinin uygulayabileceği
kadar nettir. Kurum onaylar.

### Eşleştir (03)
İhtiyaç kartı onaylanınca ajan ağı tarar: sert filtre (tür, süre, konum, uygunluk) + her aday
için **gerekçe** ("uyuyor çünkü…", "eksik olan…", kanıta bağlantılı). Sayı yok; güçlü / olası /
zayıf. Kısa liste operatörün **onay kuyruğuna** düşer; operatör onaylar, ajanın yazdığı
tanıştırma e-postası gider. Kurum tanıştırma öncesi yalnız gerekçe + özet, sonrası tam kart görür.

### İzle (06)
Tanıştırma bir **iş birliği kaydı** açar: tanıştırıldı → görüşme → başladı → sürüyor →
bitti / olmadı. Ajan üç gün sonra iki tarafa kısa soru gönderir, cevabı işler, sessiz kalanı
operatöre işaretler. Bitişte iki taraflı değerlendirme; kurumunki gencin kartına **referanslı
kanıt** olarak döner.

### Canlı tut (04)
Ajan kanıtları periyodik yeniden okur; kartları günceller; bekleyen ihtiyaca yeni uyan çıkınca
operatöre "yeni eşleşme fırsatı" düşer; altı aydır sinyal üretmeyen kart "sessiz" görünür.

### Keşfet (01)
Dört mekanizma: **meydan okumalar** (kurum ihtiyacından türetilen 24–48 saatlik görev; ağa açık;
teslimler AI rubriğiyle değerlendirilir; kurum ilk üçü görür; **katılan herkesin** teslimi
kartına doğrulanmış kanıt olur — kanıtı olmayan genç böyle içeri girer) · **keşif ajanı**
(kulüp GitHub organizasyonları, yarışma sonuç listeleri, Kaggle/Behance taranır; davet listesi
operatör onayıyla gider) · **kulüp/üniversite kanalı** (toplu davet, kulüp onayı ilk referans) ·
**talepten çekim** (yeni ihtiyaç girildiğinde ilgili gençlere "kanıtın varsa bağla") ·
**paylaşılabilir kart** (CV yerine link).

### Ölçüm paneli
Kart doğruluğu (taslak vs onay) · ihtiyaç netliği (ilk metin vs kart) · ihtiyaçtan ilk görüşmeye
gün · ilk beşten görüşmeye dönüş · ajan önerilerinin onay/düzeltme/red oranı. AI'ın "süs değil"
kanıtı bu tablodur.

## 6. Aktörler

| Aktör | Kim | Yüzey | Ne yapar |
|---|---|---|---|
| **Genç** | 18–30, GİRVAK ağı | **Mobil** (birincil) + web | Kanıt bağlar, kartını onaylar, davet/meydan okumaya katılır, bildirim alır |
| **Kurum temsilcisi** | Şirket, STK, girişim | Web | İhtiyacını yazar, kartı onaylar, adayları görür, iş birliğini bildirir |
| **GİRVAK operatörü** | Vakıf ekibi | Web | Onay kuyruğu, tanıştırma, izleme, ölçüm, ağ yönetimi |

Yetkisiz kullanımda: kurum başka kurumun ihtiyacını görmez; genç başka gencin kartını görmez
(paylaşılabilir link hariç); operatör her şeyi görür ama kimsenin adına onaylayamaz.

## 7. Kapsam

### 9 Ekim'de canlı olan
Yukarıdaki altı adımın tamamı uçtan uca; canlı alan adı; gerçek gençler (20–30) ve gerçek kurum
ihtiyaçları (5–6); mobil uygulama (genç tarafı, TestFlight + APK); ölçüm paneli dolu; açılış
sayfası; README/ADR/test/devir belgesi. Derinlik önceliği: tanımla + eşleştir + onay kuyruğu +
meydan okuma.

### 4 aylık sözleşme döneminde
Ek kanıt sağlayıcıları (Behance/Figma/App Store), roller ve yetki modeli, KVKK metinleri ve
silme akışları, dışa aktarma, GİRVAK'ın mevcut araçlarıyla entegrasyon, çok kiracılılık (başka
kurumlara kurulum), mobilde kurum tarafı, eğitim materyali ve devir.

### Ne DEĞİLDİR
- LinkedIn değildir: akış, beğeni, takip yok.
- CV/özgeçmiş deposu değildir: CV kart üretmez, kanıt üretir.
- İş ilanı sitesi değildir: kurum ilan yazmaz, ihtiyaç kartı çıkarır.
- ATS değildir: kurumun iç işe alım süreci platformun işi değildir.
- İnsan yerine karar veren AI değildir: ajan taslak/öneri üretir, onay insanda.
- Skor makinesi değildir: çıktı gerekçedir.
- Ödeme/faturalama yoktur.
- Kişinin verisini izni dışında toplamaz: kanıt bağlama kişinin eylemidir.
- **"Kimin nerede çalıştığını" teyit etmez:** ne ürettiğini ve ağın içinde ne olduğunu kaydeder.

## 8. Gelir modeli

Yok. Platform GİRVAK'ın aracıdır; geliştirme bütçesi hackathon sözleşmesinden. Açık kaynak
(MIT), self-host edilebilir, devredilebilir. Başka kurumlara kurulum ve kanıt motorunun API
olarak sunulması sözleşme sonrası olası yollardır; bu belgenin konusu değildir.

## 9. Riskler ve varsayımlar

| Risk | Önlem |
|---|---|
| GİRVAK'ta gerçek veri yok / paylaşılamıyor | Gerçek gönüllü gençler (ekip çevresi, kulüpler) + gerçek tanıdık kurumlar; sentetik yalnız dolgu |
| KVKK: kişi verisi + üçüncü taraf kaynak | Kişi kendi bağlar; açık rıza; silme; veri minimizasyonu (kod saklanmaz) |
| Referans şişirme | Referans yalnız GİRVAK onaylı kurum hesabından ve platformda kayıtlı iş birliği sonunda; kim demiş görünür |
| AI ile şişirilmiş portfolyo | Zaman ağırlığı, tanıklık, meydan okuma teslimi; "sahte" damgası yok, zayıf kart doğal görünür |
| LLM bağımlılığı (açık kaynakta kapalı model) | Sağlayıcı soyutlaması; ADR-0002 |
| 3 haftada kapsam | Canlı ortama ilk günden sürekli dağıtım; derinlik önceliği §7 |
| Junior istihdamının daralması (Stanford 2026: 22–25 yaş, AI'a açık mesleklerde −%19) | Ürün "junior yazılımcı bulma" değil "genç yeteneğin kanıtı" ürünü; iş birliği türleri istihdamla sınırlı değil |
