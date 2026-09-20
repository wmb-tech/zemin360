# Backlog

Tek liste, tek dosya. İş bitince `[x]`. Sıra = öncelik. Döngü adımı parantezde.

## Omurga (hafta 1)
- [x] Monorepo iskeleti, lint/format/typecheck/test, CI
- [x] Şema v1 (beş nesne + kanıt + ajan/onay/denetim), ilk migration
- [ ] Canlı ortam: alan adı, HTTPS, push'ta dağıtım
- [x] Giriş: genç GitHub OAuth; kurum/operatör e-posta sihirli link (KARAR-07)
- [x] Oturum, rol koruması, `withRole` middleware
- [x] Web iskeleti: kabuk, tasarım tokenleri, üç rol için boş sayfalar
- [ ] Mobil iskeleti: Expo, giriş, boş ekranlar
- [x] Tohum verisi (sentetik, @evidex.dev)

## Doğrula (02)
- [x] GitHub App: kurulum, repo seçimi, sahiplik doğrulama
- [x] GitHub sinyal çıkarma (diller, süre, sahiplik oranı, katkıcı, README/test, canlı)
- [x] Canlı URL sağlayıcısı (meta etiketi/well-known doğrulama + tarama, SSRF korumalı)
- [ ] Belge sağlayıcısı (PDF yükleme, özet sinyal)
- [x] Kart taslağı ajanı (`card_drafter`): sinyal → iddia (seviye + zaman)
- [x] Kart onay akışı (web) · [ ] mobil; taslak vs onay farkı kaydı
- [x] Otomatik hikâye bloğu

## Tanımla (05)
- [x] İhtiyaç yapılandırma ajanı (`need_structurer`): soru-cevap → NeedCard
- [x] Kurum ihtiyaç ekranı (sohbet + kart önizleme + onay)
- [ ] Netlik ölçümü kaydı

## Eşleştir (03)
- [x] Ön eleme (anahtar kelime örtüşmesi; tür/süre/konum filtresi kişi tercihleri gelince)
- [x] Gerekçe ajanı (`matcher`): MatchReasoning
- [x] Operatör onay kuyruğu (API + ekran)
- [x] Tanıştırma e-postası (kuyruk → onay → iki tarafa) · [ ] ajan taslağı
- [x] Kurum görünümü (API + ekran): önce özet, tanıştırma sonrası tam kart (KARAR-09)

## İzle (06)
- [x] İş birliği kaydı ve durum geçişleri (operatör API + ekran) · [ ] kurum/genç bildirimi
- [x] Takip ajanı (`follow_up`): 3 gün sonra soru, cevabı işle, sessizi işaretle (ADR-0006)
- [x] Bitiş değerlendirmesi → referanslı kanıt (KARAR-10)

## Canlı tut (04)
- [x] Kanıt yeniden okuma (zamanlanmış, 7 gün), kart taslağını yenile
- [x] Yeni eşleşme fırsatı bildirimi (kısa liste yayınlanınca güçlü adaya, kurum adı yok)
- [x] Sessiz kart işareti (90 gün; operatör Ağ ekranı + gencin kartında uyarı)
- [x] Operatör Ağ ekranı + kurum onayı (KARAR-10 yetkisi)

## Keşfet (01)
- [x] Meydan okuma: ihtiyaçtan görev üretme, açma, teslim, rubrik değerlendirme, kanıta dönüşüm
- [ ] Keşif ajanı: dış kaynak tarama + davet listesi (onay kuyruğu)
- [ ] Kulüp kanalı: toplu davet
- [ ] Talepten çekim bildirimi
- [ ] Paylaşılabilir kart sayfası

## Ölçüm ve sunum
- [x] Ölçüm paneli (beş metrik, paydalı)
- [ ] Açılış sayfası
- [ ] Devir belgesi, 4 aylık yol haritası, eğitim planı
- [ ] Demo senaryosu, üç prova
