# Açık Kararlar

Karar verilmeden varsayım yapılmaz; varsayım yapılırsa burada yazılır ve "varsayım" olarak
işaretlenir. Kapanan karar silinmez, tarih ve gerekçeyle "KAPANDI" olur.

| No | Sınıf | Karar | Kim | Bloke ettiği iş | Durum |
|---|---|---|---|---|---|
| KARAR-01 | Ürün | **Ürün adı.** "Zemin360 Platformu" GİRVAK'ın markası; ürünün kendi adı olacak mı? | Hasan | README, UI başlığı, sunum | AÇIK |
| KARAR-02 | Ürün | **MVP'de kanıt kaynakları.** Yalnız GitHub mı; canlı URL (site/uygulama) ve PDF portfolyo da mı? Yazılımcı-dışı yetenek (tasarımcı, pazarlamacı) MVP'de var mı? | Hasan | Kanıt çözümleme modülü, tohum verisi | AÇIK — öneri: MVP = GitHub + canlı URL; PDF yol haritası |
| KARAR-03 | Ürün/Saha | **Pilot verisi.** GİRVAK'ın elinde kişi/kurum listesi var mı, paylaşır mı? Yoksa gönüllü 5–10 gerçek kişi + sentetik kurum mu? | Hasan → office hour (21 Eyl) | Tohum verisi, demo senaryosu, KVKK metni | AÇIK — yarın sorulacak |
| KARAR-04 | Teknik | **LLM sağlayıcısı.** Claude API / OpenAI / açık model. Açık kaynak platformda kapalı model bağımlılığı jüriye nasıl anlatılır? | Alper + Hasan | AI katmanı, maliyet, ADR-0002 | AÇIK — öneri: sağlayıcı soyutlaması + varsayılan Claude, ADR'de gerekçe |
| KARAR-05 | Operasyon | **Ekip.** Üçüncü üye Ömer mi Alper mi; 9–11 Ekim'e kim gelecek; başvuru/form tutarlılığı | Hasan | Rol dağılımı, GİRVAK'a bildirim | AÇIK |
| KARAR-06 | Teknik | **Yığın.** Bun+Hono+Postgres+React (ekibin bildiği) mi, başka mı? Jüri "mimari kararlar" puanlıyor → ADR-0001 | Alper + Hasan | Her şey | AÇIK — öneri: bilinen yığın, ADR'de "neden" |
| KARAR-07 | Ürün | **Kimlik doğrulama.** MVP'de GitHub OAuth tek giriş mi (kanıt bağlama zaten GitHub), kurum/operatör için e-posta + sihirli link mi? | Hasan | Auth modülü | AÇIK — öneri: yetenek GitHub OAuth; kurum/operatör e-posta link |
| KARAR-08 | Parametre | **Eşleşme çıktısında sayı var mı?** Yalnız gerekçe mi, gerekçe + 0–100 uyum yüzdesi mi? | Hasan | Eşleşme UI | AÇIK — öneri: gerekçe + üç seviye (güçlü/olası/zayıf), yüzde yok |
| KARAR-09 | Ürün | **Yetkisiz kullanım sınırları** §7'deki gibi mi? Kurum aday kartının tamamını mı görür, GİRVAK onayına kadar özet mi? | Hasan | Yetki modeli | AÇIK — öneri: GİRVAK tanıştırana kadar kurum yalnız gerekçe + özet görür |

## Varsayımlar (karar gelene kadar)

- V-01: Demo dili Türkçe; kod ve API İngilizce.
- V-02: Tek kiracı (yalnız GİRVAK); çok kiracılı mimari yol haritasında.
- V-03: Kart onayı olmadan hiçbir şey ağa girmez (değişmez ilke, karar değil).
