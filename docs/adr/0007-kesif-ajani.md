# ADR-0007 · Keşif ajanı: herkese açık sinyalle ağ dışı aday, davet yalnız onayla

**Durum:** Kabul · 20 Eyl 2026

## Bağlam
İhtiyaç alanı 01 "genç yeteneklerin keşfi": GİRVAK'ın ağı kendi çevresiyle sınırlı. Ağ içi
eşleştirme (03) boş dönerse ürün "aday yok" demekle kalmamalı. Ama dışarıdaki insanlar
ağın üyesi değil; kişisel verileri ve rızaları yok.

## Karar
- **Kaynak:** yalnız GitHub'ın herkese açık profil/repo verisi (arama API'si). Onaylı ihtiyaç
  kartının becerileri dile (TypeScript, Python…) ve bio anahtar kelimesine çevrilir; konum
  Türkiye odaklı. Sorgu kademeli: dil + anahtar kelime, sonra yalnız dil (aksi hâlde sonuç boğulur).
- **Ajan (`scout`)** adayları ihtiyaca göre eler ve gerekçelendirir; yalnız verilen login'lerden
  seçebilir (uydurulan atılır). Ajana e-posta gönderilmez.
- **Saklama yok:** aday profilleri veritabanına yazılmaz. Yalnız seçilenlerin login/url/gerekçe
  onay kuyruğu payload'ında durur; `scout_invites` tablosu davet edilen login + zamanı tutar.
- **Davet yalnız onayla** (ADR-0004) ve yalnız kişi profilinde **herkese açık e-posta**
  yayınladıysa gider; yoksa operatöre "elle ulaş" listesi (profil linki). E-postada neden
  yazıldığı (ihtiyaç başlığı, profilde görülen somut şey) ve platformun ne olduğu söylenir.
- **Tekrar yok:** aynı login'e 90 gün içinde ikinci davet önerilmez; ağa girmiş olanlar
  (githubLogin) baştan elenir.
- Kulüp kanalı (liste yapıştırma) aynı `invite` yürütmesini kullanır; ağdakiler elenir.

## Gerekçe
Keşif ölçülebilir (tarama → seçim → davet → katılım) ve ajanın işi "bulmak" değil
"gerekçelendirmek". Herkese açık veri + tek seferlik, açıklamalı davet + operatör onayı,
KVKK açısından savunulabilir asgari; toplu tarama/sıralama saklanmadığı için profil havuzu
oluşmaz.

## Sonuçlar
GITHUB_SERVER_TOKEN pratikte zorunlu (arama sınırı). Rakip kaynaklar (LinkedIn vb.) API
ve hukuk gereği kapsam dışı; kulüp kanalı ve paylaşılabilir kart bunu tamamlar.
