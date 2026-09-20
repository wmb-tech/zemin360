import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Skeleton } from '../components/skeleton';
import type { OperatorNeed } from '../components/need-picker';

/**
 * Operatörün ihtiyaç listesi: hangi kurum ne istiyor, kart onaylı mı, kaç aday, kısa liste
 * açıldı mı. Eşleştirmeyi yeniden koşturma ve keşif/meydan okumaya kısayol.
 */
export function OperatorNeedsPage() {
  useTitle('İhtiyaçlar');
  const [list, setList] = useState<OperatorNeed[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  async function load() {
    setList(await api<OperatorNeed[]>('/api/operator/needs'));
  }
  useEffect(() => {
    void load();
  }, []);
  async function match(id: string) {
    setBusy(id);
    setNote(null);
    try {
      const r = await api<{ matches: unknown[]; queued: boolean }>(
        `/api/operator/needs/${id}/match`,
        {
          method: 'POST',
        },
      );
      setNote(
        `${r.matches.length} eşleşme üretildi${r.queued ? '; kısa liste onay kuyruğunda' : ''}.`,
      );
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(null);
    }
  }
  if (!list) return <Skeleton />;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">İhtiyaçlar</h1>
      <p className="text-ink-soft mt-2 max-w-prose text-sm">
        Kurumların açtığı ihtiyaçlar. Kart onaylanınca eşleştirme kendiliğinden koşar; burada
        yeniden koşturabilir, keşif ya da meydan okuma başlatabilirsin.
      </p>
      {note && <p className="text-ink-soft mt-3 text-sm">{note}</p>}
      <ul className="mt-6 divide-y divide-[var(--color-line)]">
        {list.length === 0 && <li className="text-ink-soft py-4 text-sm">Henüz ihtiyaç yok.</li>}
        {list.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{n.title ?? 'Başlıksız (taslak)'}</div>
              <div className="text-ink-soft text-xs">
                {n.organizationName} · {n.cardStatus === 'approved' ? 'onaylı' : 'taslak'}
                {n.cardStatus === 'approved' &&
                  ` · ${n.matches.strong} güçlü / ${n.matches.possible} olası / ${n.matches.weak} zayıf · ${n.matches.introduced} tanıştırma · ${n.shortlistPublishedAt ? 'kısa liste açık' : 'kısa liste kapalı'}`}
              </div>
            </div>
            {n.cardStatus === 'approved' && (
              <div className="flex gap-2 text-xs">
                <button
                  disabled={busy === n.id}
                  onClick={() => void match(n.id)}
                  className="border-line hover:bg-paper-2 rounded-lg border px-2 py-1 font-semibold disabled:opacity-50"
                >
                  {busy === n.id ? 'Eşleştiriliyor…' : 'Eşleştirmeyi koş'}
                </button>
                <Link
                  to="/ag"
                  className="border-line hover:bg-paper-2 rounded-lg border px-2 py-1 font-semibold"
                >
                  Keşif
                </Link>
                <Link
                  to="/meydan"
                  className="border-line hover:bg-paper-2 rounded-lg border px-2 py-1 font-semibold"
                >
                  Meydan okuma
                </Link>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
