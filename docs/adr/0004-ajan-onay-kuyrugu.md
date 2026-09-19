# ADR-0004 · Ajan yapar, insan onaylar: onay kuyruğu ve denetim izi

**Durum:** Kabul · 20 Eyl 2026

## Bağlam
Döngünün her adımında bir ajan iş yapıyor (kısa liste, tanıştırma e-postası, takip sorusu,
davet, meydan okuma değerlendirmesi). Ürün ilkesi: AI insan yerine karar vermez. GİRVAK
operatörünün gerçek işi onaylamak olmalı, her şeyi elle yapmak değil.

## Karar
- Ajanın **dışa dönük** her eylemi (birine mesaj, tanıştırma, davet, kart yayınlama önerisi)
  önce `approval_queue` tablosuna `proposed` olarak yazılır; operatör `approved` /
  `edited` / `rejected` yapar; yalnız o zaman yürütülür.
- **İçe dönük** eylemler (sinyal çıkarma, taslak yazma, sıralama) onay beklemez ama
  `agent_runs`'a kaydedilir.
- Kişi ve kurumun kendi kartı üzerindeki onayı ayrı bir kapıdır; operatör onayı onun yerine
  geçmez.
- Her onay/red kararı kim/ne zaman/ne değiştirdi ile denetim izine yazılır; ölçüm paneli
  "ajan önerilerinin onay oranı"nı buradan hesaplar.

## Gerekçe
Tek kuyruk = GİRVAK'ın günlük işi tek ekranda; risk sınırı net (ajan kendi başına kimseye
yazmaz); ve "AI'ın katkısı" ölçülebilir olur (öneri → onay/düzeltme/red).

## Sonuçlar
Yeni ajan eklemek = eylemi `proposed` yazmak; yürütme katmanı ortak. Sahnede demo: ajan
öneriyi kuyruğa düşürür, operatör tek tıkla onaylar, e-posta gider.
