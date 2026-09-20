import type { FollowUpService } from '../followups/service';
import type { NetworkService } from '../network/service';

/**
 * Zamanlanmış işler. Ayrı bir kuyruk/cron altyapısı yok: tek süreç, `setInterval`.
 * Her iş idempotent olmak zorunda (iki kez koşarsa ikinci koşu boş döner): takip taraması ve
 * kanıt yenileme eşiklerle kendini sınırlar. İlk koşu açılıştan 1 dk sonra: DB/migrasyon henüz hazır değilse patlamasın.
 * ⚠ Çoklu süreçte (pm2 cluster) her süreç tarar; şimdilik tek süreç (docs/02 KARAR-14).
 */
export function startScheduler(
  jobs: { followUp: FollowUpService; network: NetworkService },
  intervalMin: number,
) {
  if (intervalMin <= 0) return null;
  const kos = async () => {
    try {
      const r = await jobs.followUp.scan();
      if (r.proposed || r.silent)
        console.log(`[jobs] takip taraması: ${r.proposed} öneri, ${r.silent} sessiz`);
    } catch (err) {
      console.error('[jobs] takip taraması hata', err);
    }
    try {
      const r = await jobs.network.refreshEvidence();
      if (r.refreshed || r.failed)
        console.log(`[jobs] kanıt yenileme: ${r.refreshed} kart, ${r.failed} hata`);
    } catch (err) {
      console.error('[jobs] kanıt yenileme hata', err);
    }
  };
  setTimeout(() => void kos(), 60_000);
  return setInterval(() => void kos(), intervalMin * 60_000);
}
