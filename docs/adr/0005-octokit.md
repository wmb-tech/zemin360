# ADR-0005 · GitHub erişimi için Octokit (@octokit/app, @octokit/rest)

**Durum:** Kabul · 20 Eyl 2026

## Bağlam
Kanıt bağlama GitHub App üzerinden: kişi hangi repoları göstereceğini kurulumda seçer, biz
kurulum token'ıyla yalnız o repoları okuruz (private dahil). App kimlik doğrulaması JWT
(RS256) + kurulum token'ı takası gerektirir; elle yazmak hata yatağıdır.

## Karar
`@octokit/app` (App JWT ve kurulum token'ı), `@octokit/rest` (tipli REST istemcisi). Yalnız
`packages/evidence/providers/github` içinde kullanılır; API katmanı Octokit görmez.

## Reddedilenler
- **Elle JWT + fetch:** Anahtar rotasyonu, token süresi, hız sınırı başlıkları — hepsi yeniden
  yazılırdı.
- **Kişisel erişim token'ı istemek:** Kişiye "token üret, yapıştır" dedirtmek adoption'ı
  öldürür ve kapsam sınırlanamaz.

## Sonuçlar
Private key yalnız sunucuda (env). Ham kod indirilmez; yalnız meta ve ağaç listesi okunur
(ADR-0003).
