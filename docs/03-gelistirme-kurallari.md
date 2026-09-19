# Geliştirme Kuralları

Jüri kodu okuyacak (%20: mimari, açık kaynak standartları, okunabilirlik, dokümantasyon).
Bu kurallar ilk commit'ten itibaren geçerli; "sonra düzeltiriz" yok.

## Dil
- Dışa açık isimler (fonksiyon, tip, API, DB) İngilizce. Yorumlar ve kullanıcıya görünen
  metin Türkçe. Commit mesajları Türkçe.
- Yorum **ne yaptığını değil neden öyle yapıldığını** anlatır; tuzaklar `⚠` ile işaretlenir.

## Mimari refleksler
1. Yeni modül = mevcut modülün kopyası; pattern icat edilmez.
2. Handler `ok(c, data)` döner; hata için `AppError` fırlatılır. İstemci `ok` alanını okumadan
   `data`ya dokunmaz.
3. Şema tek yerde: `packages/shared`. Web ve mobil kendi tipini uydurmaz.
4. Ajan çıktısı şemalı (Zod). LLM çağrısı yalnız `packages/ai` üzerinden.
5. Ajanın dışa dönük her eylemi onay kuyruğundan geçer (ADR-0004).
6. Ham kanıt içeriği saklanmaz (ADR-0003).
7. Yeni bağımlılık ADR ister.
8. Test önce yazılır ve kırmızı görülür; kontrol ettiği şey bozulunca hâlâ geçen test, test değildir.

## Commit
`tip(kapsam): Türkçe emir kipinde ne yapıldığı` — tip: feat · fix · test · docs · chore ·
refactor · ci. Gövde: problem → yapılan → etki sınırı → test yaklaşımı.

## Kapı
Push öncesi `bun run check` yeşil. CI aynı komutu koşar; kırmızı main'e girmez.
