# ADR-0001 · Yığın: Bun + Hono + Drizzle/Postgres + React (Vite) + Expo, tek monorepo

**Durum:** Kabul · 20 Eyl 2026

## Bağlam
Platform 19 günde canlıya çıkacak, sonra GİRVAK'a devredilecek ve 4 ay birlikte
büyütülecek. Jüri "mimari kararlar, açık kaynak standartları, okunabilirlik, dokümantasyon"
puanlıyor (%20). Ekip aynı yığınla üretimde çalışan ürünler çıkarmış (POS, stok, CLM);
öğrenme maliyeti sıfır olmalı.

## Karar
- **Çalışma zamanı:** Bun (tek runtime, paket yöneticisi ve test koşucusu).
- **API:** Hono — küçük, tipli, middleware'i sade; handler `ok(c, data)` döner, hata `AppError`.
- **Veri:** PostgreSQL + Drizzle ORM. İlişkisel çekirdek (kişi/kurum/ihtiyaç/eşleşme/iş
  birliği) + kanıt sinyalleri için `jsonb`. Migration'lar repoda, `drizzle-kit`.
- **Web:** React 19 + Vite + Tailwind v4; tek tasarım token seti (`packages/ui`).
- **Mobil:** Expo (React Native) — aynı API, aynı paylaşılan tipler (`packages/shared`).
- **Monorepo:** Bun workspaces: `apps/api`, `apps/web`, `apps/mobile`, `packages/shared`,
  `packages/ui`, `packages/db`.
- **Doğrulama şeması:** Zod; API sözleşmesi `packages/shared`'da tek yerde, web ve mobil
  aynı tipleri kullanır.

## Gerekçe
Tek dil (TypeScript), tek runtime, tek repo: GİRVAK'ın devralacağı ekip tek bir şeyi
öğrenir. Hono + Drizzle küçük ve okunabilir; "sihir" yok, jüri kodu okuyabilir. Expo mobil
tarafı üç haftada TestFlight'a çıkarabilen tek gerçekçi yol.

## Reddedilenler
- **Next.js tek uygulama:** API + web + mobil için paylaşılan tip modelini zorlaştırır;
  self-host devri karmaşıklaşır.
- **Supabase/Firebase:** Devredilebilirlik ve açık kaynak şartıyla çelişir (dış hizmet
  bağımlılığı).
- **Python backend (FastAPI):** AI için cazip ama iki dil, iki runtime; ekip hızı düşer.

## Sonuçlar
Yeni bağımlılık ADR ister. `docker compose up` ile Postgres + API + web tek komutta kalkar
(devir artefaktı); canlı ortam CI'dan dağıtılır.
