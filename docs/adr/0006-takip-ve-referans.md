# ADR-0006 · Takip: tek kullanımlık linkle iki taraflı soru; referans yalnız onaylı kurumdan

**Durum:** Kabul · 20 Eyl 2026

## Bağlam
İhtiyaç alanı 06 "şeffaf iş birliği takibi": tanıştırma sonrası ne olduğunu GİRVAK bugün
bilmiyor. Ürün kimliği: ajan sorar, taraflar cevaplar, operatör yalnız sorunlu olana bakar.
Ayrıca KARAR-10: referanslı kanıt yalnız platformda izlenen iş birliğinden ve GİRVAK onaylı
kurum hesabından gelir — iki kişinin birbirini onaylayıp şişirmesi kapalı.

## Karar
- **Tarama** saatte bir (tek süreç `setInterval`, idempotent) ya da operatör düğmesiyle: son
  hareketten 3 gün geçmiş açık iş birliği için `follow_up` ajanı iki tarafa ayrı, bağlama göre
  yazılmış tek soru üretir → `approval_queue` (`send_follow_up`). Bekleyen öneri varsa yenisi
  yazılmaz.
- **Gönderim** operatör onayıyla: her tarafa e-posta, içinde tek kullanımlık link
  (`/takip/<token>`). Token'ın yalnız hash'i saklanır (sihirli linkle aynı ilke). Sayfa
  oturum istemez; bağlam olarak yalnız kurum adı, ihtiyaç başlığı ve gencin ilk adı verir.
- **Cevap** = durum seçimi + isteğe bağlı serbest metin. Durumu **taraf** belirler; ajan
  (`checkin_interpreter`) yalnız metni özetler, bayraklar (ödeme, kapsam, iletişim, görüşülemedi…)
  ve "operatör baksın mı" der. Metin boşsa ajan çağrılmaz.
- **Referans:** kurum tarafı `completed` derse ve kurum `approvedByOperatorAt` doluysa gencin
  kartına `referenced` seviyesinde **taslak** iddia düşer (`network_reference` kaynağı, ref =
  iş birliği id). Genç onaylamadan karta çıkmaz. Kapı kodda; ajan cümle yazsa bile onaysız
  kurumda atılır.
- **Sessizlik:** soru gitti, 5 gün cevap yok → `silentSince`; sessiz kayda yeni soru üretilmez,
  operatör listede görür.
- **Çelişki:** aynı turda iki taraf farklı durum dediyse satır "çelişki" etiketi alır; karar
  operatörün. Son cevap veren tarafın durumu kayda yazılır (basit, denetlenebilir).

## Gerekçe
Link+token, giriş engelini kaldırır (kurum yetkilisi uygulamaya girmez, e-postadan tıklar).
Durumu ajanın değil tarafın seçmesi "AI kararı" tartışmasını kapatır; ajanın işi okuma yükünü
azaltmak. Referans kapısı KARAR-10'u koda çevirir.

## Sonuçlar
Ölçüm: takip cevap oranı ve sessiz oranı `collaboration_checkins`'ten türetilebilir.
Çoklu süreçte tarama yarışır; tek süreç varsayımı (KARAR-14) bozulursa kilit/leader gerekir.
