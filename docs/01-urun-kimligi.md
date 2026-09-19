# Ürün Kimliği — Zemin360 Platformu (çalışma adı)

Bu belge, kod yazılmadan önce ürünün **neden var olduğunu** kapatır. Feature'lar buradan
türer; tersi olmaz. Açık kararlar `[KARAR-NN]` ile işaretlidir ve `docs/02-acik-kararlar.md`
dosyasında toplanır.

Bağlam: Zemin360 Hackathon (GİRVAK · İstanbul Kalkınma Ajansı · İstanbul Bilgi Üniversitesi).
Birinci ekip GİRVAK ile hizmet sözleşmesi imzalar ve platformu 4 ayda canlı ürüne taşır.
Bu yüzden her karar şu soruyla alınır: **"GİRVAK bunu dört ay sonra gerçekten kullanır mı?"**

---

## 1. Nedir?

Genç yetenekler ile kurumların ihtiyaçlarını **beyana değil kanıta** dayanarak eşleştiren,
her eşleşmeyi **gerekçesiyle** sunan, GİRVAK'ın işlettiği açık kaynaklı bir platform.

Üç nesnesi vardır:

| Nesne | Kim üretir | Neyden üretilir |
|---|---|---|
| **Yetkinlik kartı** | Genç yetenek, sistemin yardımıyla | Bağladığı kanıt: kod deposu, canlı ürün, teslim edilmiş iş, portfolyo |
| **İhtiyaç kartı** | Kurum temsilcisi, sistemin yardımıyla | Serbest metinle yazdığı talep → yapılandırılmış ihtiyaç |
| **Gerekçeli eşleşme** | Sistem | İki kartın karşılaştırılması; "uyuyor, çünkü şu kanıt var" |

Dördüncü katman GİRVAK'ın kendisi: eşleşmeleri onaylar, tanıştırır, iş birliğinin ilerleyişini
izler.

## 2. Vizyon ve misyon

**Vizyon:** Türkiye'de genç bir yeteneğin "ne yapabildiği", kendini ne kadar iyi anlattığına
değil, ne yaptığına bakılarak anlaşılsın.

**Misyon:** GİRVAK'ın ağındaki her kişi ve kurum için beyanı kanıta, muğlak talebi net
ihtiyaca, eşleşmeyi gerekçeye çevirmek; kurulan her bağlantının sonucunu izlenebilir kılmak.

## 3. Problem tanımı

GİRVAK'ın altı ihtiyaç alanı bu platformun problem listesidir. Hepsinin altında aynı kök var:
**beyan.**

| # | İhtiyaç alanı (GİRVAK) | Kök neden |
|---|---|---|
| 01 | Genç yeteneklerin keşfi | Yetenek, kendini iyi anlatanın görünür olduğu kanallarda kayboluyor |
| 02 | Profil & portfolyo doğruluğu | Beyan edilen deneyim/beceri doğrulanamıyor |
| 03 | Kurum–kişi eşleşmesi | İki muğlak metin (CV ↔ ilan) skorla eşleşiyor, kimse neden'i bilmiyor |
| 04 | Yaşayan bir ağ | Bağlantı kurulduktan sonra sinyal üretmiyor; ağ statik listeye dönüyor |
| 05 | İhtiyaçların net tanımı | Kurum "bize yazılımcı lazım" diyor; gerçek problemini yapılandıramıyor |
| 06 | Şeffaf iş birliği takibi | Tanıştırma sonrası ne olduğu görünmüyor; başarı ölçülemiyor |

MVP (hackathon) 02 · 03 · 05'i **çözer**; 01 · 04 · 06'yı **mimaride yerleştirir** ve 4 aylık
yol haritasına koyar. (Bkz. §8.)

## 4. Mevcut çözüm yöntemleri

| Yöntem | Ne yapıyor | Neden yetmiyor |
|---|---|---|
| LinkedIn, Kariyer.net, Youthall | Öz beyan profili + ilan + skor | Girdi beyan; eşleşme kapalı kutu; genç yetenek için görünürlük "profil doldurma" yarışı |
| GİRVAK'ın mevcut akışı (form + tablo + insan) | Başvuru formu, Excel, tanıştırma e-postası | Ölçeklenmiyor; kurumsal hafıza kişilerde; sonuç izlenmiyor |
| ATS'ler (Greenhouse vb.) | Kurum içi aday takibi | Kurumun aracı, ekosistemin değil; kanıt değil CV işler |
| GitHub/Behance profilleri | Kanıtın kendisi | Yapılandırılmamış; kurum okuyamıyor; karşılaştırılamıyor |

Boşluk: kanıtı okuyup **karşılaştırılabilir karta** çeviren ve eşleşmeyi **gerekçelendiren**
katman yok. Platformun tezi bu katmandır.

## 5. Çözüm ve değer önerisi

**Genç yetenek için:** Kendini anlatmak zorunda kalmaz. Reposunu/ürününü/işini bağlar; sistem
kanıtı okur, yetkinlik kartını önerir; kişi düzeltir ve onaylar. Kartında yazan her şeyin bir
kaynağı vardır.

**Kurum için:** İlan yazmaz. Derdini anlatır; sistem soru sorarak yapılandırılmış ihtiyaç
kartına çevirir (ne, ne kadar süre, hangi seviye, hangi çıktı, hangi kısıt). Önerilen her
adayın neden önerildiğini görür.

**GİRVAK için:** Ağın tamamı karşılaştırılabilir kartlardan oluşur; tanıştırmalar
gerekçelidir; her tanıştırmanın sonucu kaydedilir; ölçümler tek panelde toplanır.

Değer önermesi tek cümle: **"Kimse kendini anlatmaz; kanıt konuşur, sistem gerekçelendirir,
insan karar verir."**

## 6. Hedef kitle ve aktörler

| Aktör | Kim | Platformda ne yapar |
|---|---|---|
| **Genç yetenek** | 18–30, GİRVAK ağındaki öğrenci/yeni mezun/genç girişimci | Kanıt bağlar, kartını onaylar, eşleşme davetlerine cevap verir |
| **Kurum temsilcisi** | Şirket, STK, girişim; GİRVAK'ın kurumsal ağı | İhtiyacını yazar, kartı onaylar, önerilen adayları görür |
| **GİRVAK operatörü** | Vakıf ekibi | Eşleşmeleri gözden geçirir, tanıştırır, iş birliğini izler, ölçümleri okur |

İlk pilot müşterisi GİRVAK'ın kendisidir. Kişi ve kurum tarafı GİRVAK'ın mevcut ağından gelir.
`[KARAR-03]` GİRVAK'ın elinde bugün hangi kişi/kurum verisi var, pilot kiminle yapılır.

## 7. Temel kullanım senaryoları

1. **Kanıttan kart.** Yetenek GitHub hesabını bağlar (`[KARAR-02]` diğer kaynaklar). Sistem
   depoları okur; dil, araç, proje türü, sürdürme süresi, iş birliği izleri, canlı dağıtım gibi
   sinyalleri çıkarır; taslak kart üretir. Yetenek her maddenin kaynağını görür, düzeltir,
   onaylar. Onaysız kart ağa girmez.
2. **Talepten ihtiyaç.** Kurum "e-ticaret sitemiz için mobil uygulama yapacak birini
   arıyoruz" yazar. Sistem netleştirici sorular sorar (süre, çıktı, bütçe/karşılık, seviye,
   uzaktan/yerinde) ve ihtiyaç kartı üretir. Kurum onaylar.
3. **Gerekçeli eşleşme.** Sistem ihtiyaç kartı için aday kartları sıralar; her aday için
   "uyuyor çünkü…" ve "eksik olan…" yazar; kaynak kanıta bağlantı verir. GİRVAK operatörü
   listeyi görür, tanıştırmayı başlatır.
4. **Sonuç kaydı.** Tanıştırma → görüşme → iş birliği → sonuç. Her adım kaydedilir; ölçümler
   güncellenir (§10).
5. **Yaşayan ağ (yol haritası).** Kart, kanıt değiştikçe güncellenir (yeni repo, yeni iş);
   GİRVAK "kimin kartı 6 aydır sessiz" görür.

Her senaryo için **yetkisiz kullanımda** sistem ne yapar: kurum başka kurumun ihtiyaçlarını
görmez; yetenek başka yeteneğin kartını görmez; operatör her şeyi görür ama kartı kişi adına
onaylayamaz.

## 8. Ürün kapsamı ve sınırları

### Hackathon MVP'sinde (9–11 Ekim sahnesinde çalışan)

- Yetenek: GitHub bağla → kanıt çözümleme → taslak kart → düzelt/onayla
- Kurum: serbest metin → netleştirici sorular → ihtiyaç kartı → onayla
- Eşleşme: ihtiyaç kartı için gerekçeli aday listesi
- Operatör: eşleşme listesi, tanıştırma, sonuç kaydı
- Ölçüm paneli: §10'daki dört metrik
- Kurulum: tek komut (`docker compose up`), örnek veriyle

### 4 aylık yol haritasında (sözleşme dönemi)

- Ek kanıt kaynakları (canlı ürün tarama, portfolyo dosyası, referans)
- Yaşayan ağ: kanıt güncellendikçe kart güncellenir, sessizlik uyarısı
- İş birliği takibi: kilometre taşları, iki taraflı geri bildirim
- Genç yetenek keşfi: GİRVAK ağına henüz girmemiş kişileri kanıt üzerinden davet
- Rol/yetki, KVKK metinleri, dışa aktarma, GİRVAK'ın mevcut araçlarıyla entegrasyon

### Ne DEĞİLDİR (negatif tanım — kapsama sızmayı önleyen liste)

- **LinkedIn klonu değildir.** Sosyal akış, beğeni, takip yok.
- **CV/özgeçmiş deposu değildir.** CV yüklemek kart üretmez; kanıt üretir.
- **İş ilanı sitesi değildir.** Kurum ilan yayınlamaz, ihtiyaç kartı çıkarır.
- **ATS değildir.** Kurumun iç işe alım süreci platformun işi değildir.
- **İnsan yerine karar veren AI değildir.** AI kart taslağı, ihtiyaç taslağı ve gerekçeli
  öneri üretir; onay hep insanda.
- **Skor makinesi değildir.** Eşleşme çıktısı sayı değil gerekçedir; sayı varsa gerekçenin
  yanında ve açıklanabilir.
- **Ödeme/faturalama yoktur.**
- **Kişinin verisini onun izni dışında toplamaz.** Kanıt bağlantısı kişinin eylemidir.

## 9. Gelir modeli ve paketleme

Yok. Platform GİRVAK'ın aracıdır; geliştirme bütçesi hackathon sözleşmesinden gelir. Açık
kaynak (MIT). Sürdürülebilirlik: self-host edilebilir, tek `compose` ile kurulur, GİRVAK'ın
kendi ekibi 4 ay sonunda devralabilir — eğitim planı bunun içindir.

## 10. Ölçümler (AI'ın "süs değil" kanıtı)

| Metrik | Ne ölçer | Nasıl |
|---|---|---|
| **Kart doğruluğu** | Sistemin taslağının, kişinin onayladığı kartla örtüşme oranı | Taslak vs onay farkı otomatik kaydedilir |
| **İhtiyaç netliği** | Kurumun ilk metni ile onaylanan kartın "üçüncü kişi uygulayabilir mi" farkı | Alan doluluk + operatör puanı |
| **İhtiyaçtan ilk görüşmeye süre** | Kartın onaylanmasından ilk tanıştırmaya geçen süre | Zaman damgası |
| **İlk beşten görüşmeye dönüş** | Önerilen ilk 5 adaydan kaçı görüşmeye dönüştü | Sonuç kaydı |

Jüri karşısında bu tablo doluysa AI entegrasyonu ölçülebilirdir.

## 11. Riskler ve varsayımlar

| Risk | Etki | Önlem |
|---|---|---|
| GİRVAK'ta gerçek veri yok / paylaşılamıyor | Demo sentetik kalır | Sentetik ama gerçekçi tohum verisi; gerçek gönüllü 5–10 kişi (ekip + çevre) `[KARAR-03]` |
| KVKK: kişi verisi + üçüncü taraf (GitHub) | Hukuki | Kişi kendi bağlar, açık rıza metni, silme hakkı, veri minimizasyonu |
| Kanıt kaynağı yalnız kod olursa yazılımcı-dışı yetenek dışarıda kalır | Kapsam | MVP'de GitHub; mimaride "kanıt sağlayıcı" arayüzü, yol haritasında diğerleri `[KARAR-02]` |
| LLM maliyeti/erişimi (açık kaynak platformda kapalı model) | Sürdürülebilirlik | Sağlayıcı soyutlaması; `[KARAR-04]` |
| 3 günde "çalışan demo" | Puan | 9 Ekim'e MVP'nin tamamı çalışıyor gelinir; sahnede yalnız cila |
| Ekip üyesi belirsizliği | Operasyon | `[KARAR-05]` |

---

**Geçiş ölçütü (bu belge kapanmadan kod yazılmaz):** ürün ne, kullanıcı kim, problem ne, ne
değil, ne kapsam dışı — beşi de tartışmasız cevaplanmış olmalı. Açık kararlar kapanınca belge
"kilitli" sayılır.
