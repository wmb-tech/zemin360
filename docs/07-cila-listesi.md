# Cila listesi — 20 Eylül denetim turu

İlk gerçek kullanıcı (Hasan, kendi GitHub'ıyla) turundan ve üç rolün tüm sayfalarının
tarayıcıda gezilmesinden çıkan liste. Çökme/konsol hatası yok; sorunlar **boşluk** sınıfından:
kullanıcı bir adımı bitirince "şimdi ne olacak" göremiyor. Sıra = etki. `[x]` = yapıldı.

## Genç
- [x] **Ana sayfa yok.** Kart onaylanınca kişi aynı ekranda kalıyor. → `/` = Durum: kart durumu
  (taslak/onaylı/sessiz), kaynak ve onaylı iddia sayısı, "sıradaki adım" kartı, eşleşmeler
  (kısa liste yayınlanmış ihtiyaçlar: kurum adı tanıştırmaya kadar gizli — KARAR-09'un simetriği),
  iş birlikleri ve durumları, açık meydan okuma sayısı.
- [x] Menü: "Kartım" ve "Kanıt" aynı sayfa. → Ana sayfa · Kartım · Meydan okumalar.
- [x] Logo tıklanınca ana sayfa; giriş yapmışken açılış sayfasına ("Nasıl çalışır") ulaşılabilsin.
- [x] Kart onayı sonrası yönlendirme + "ağdasın" mesajı.
- [ ] Kaynak listesi yalnız bu tur okunan repoları gösteriyor; karttaki tüm repo kaynakları
  gösterilmeli (40 sınırı turdan tura farklı repo getirebiliyor).
- [ ] Şehir alanı (eşleşme filtresi için) ve kart üstünde kısa profil düzenleme.
- [x] Paylaşılabilir linkte "kopyala".

## Kurum
- [x] **Kurum adı/şehir/web sitesi düzenlenemiyor**; sihirli linkle gelen kurum "Kurum (adı
  bekleniyor)" kalıyor ve bu ad gence giden e-postalara giriyor. → `/kurum` ayar sayfası + ilk
  girişte zorunlu ad.
- [x] İhtiyaç listesinde durum rozeti, aday sayısı, "adaylar" linki; onaylı ihtiyaçta kısa liste
  durumu ("GİRVAK inceliyor" / "N aday").
- [ ] İhtiyaç detayında onay adımında alanları düzeltme (KARAR: kurum onaylarken düzeltir).

## Operatör
- [x] İhtiyaçlar sayfası (API var: `/api/operator/needs`): kurum, durum, eşleşme sayıları,
  "eşleştirmeyi yeniden koş", meydan okuma/keşif kısayolları.
- [ ] Kuyrukta "Düzenle" (edit) — API var, ekranda yok.

## Genel
- [x] Sayfalar yüklenirken `null` dönüyor (boş ekran anı) → iskelet.
- [x] Sayfa başlıkları (`document.title`).
- [x] Favicon.
- [x] Alt bilgi: Nasıl çalışır · Kaynak kod · KVKK (metin GİRVAK hukuktan; şimdilik taslak).
- [x] Mobil genişlikte menü ve kart yerleşimi → alt menü (≤4 + "Diğer"), 390/768/1440 kanıtı `docs/redesign/evidence/`.
- [x] Tasarım turu → `docs/redesign/` paketi uygulandı (A–F); dal `feature/evidex-product-redesign`, merge kararı Hasan'da.
