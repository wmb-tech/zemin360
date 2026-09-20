import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter, Live } from '../components/motion';
import { Button, Empty, ErrorNote, Skeleton } from '../components/ui';
import type { OperatorNeed } from '../components/need-picker';

/** Operatörün ihtiyaç listesi: kurum, durum, eşleşme sayıları; eşleştirmeyi yeniden koş, keşif/meydan okuma kısayolu. */
export function OperatorNeedsPage() {
  useTitle('İhtiyaçlar');
  const [list, setList] = useState<OperatorNeed[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setList(await api<OperatorNeed[]>('/api/operator/needs'));
  }
  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Yüklenemedi'));
  }, []);
  async function match(id: string) {
    setBusy(id);
    setError(null);
    try {
      const r = await api<{ matches: unknown[]; queued: boolean }>(
        `/api/operator/needs/${id}/match`,
        { method: 'POST' },
      );
      setLive(
        `${r.matches.length} eşleşme üretildi${r.queued ? '; kısa liste onay kuyruğuna düştü' : ''}.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eşleştirme koşmadı');
    } finally {
      setBusy(null);
    }
  }
  if (error && !list) return <ErrorNote>{error}</ErrorNote>;
  if (!list) return <Skeleton rows={5} />;
  return (
    <div>
      <Live message={live} />
      <Enter i={0} as="header">
        <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
          İhtiyaçlar
        </h1>
        <p className="text-ink-soft mt-1 max-w-[65ch]">
          Kurumların açtığı ihtiyaçlar. Kart onaylanınca eşleştirme kendiliğinden koşar; burada
          yeniden koşturabilir, keşif ya da meydan okuma başlatabilirsin. Kısa liste onay kuyruğuna
          düşer.
        </p>
      </Enter>
      {live && <p className="text-verified mt-3 text-sm font-semibold">{live}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Enter i={1} as="section" className="mt-6">
        {list.length === 0 ? (
          <Empty title="Henüz ihtiyaç yok">Kurum ilk ihtiyacını açınca burada görünür.</Empty>
        ) : (
          <div className="bg-surface border-line overflow-x-auto rounded-[var(--radius-panel)] border">
            <table className="w-full text-sm">
              <thead className="bg-paper-2 text-ink-soft sticky top-0 text-left text-xs font-bold tracking-wide uppercase">
                <tr>
                  <th className="px-4 py-3">İhtiyaç</th>
                  <th className="px-4 py-3">Kurum</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="tnum px-4 py-3">Eşleşme</th>
                  <th className="px-4 py-3">Kısa liste</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {list.map((n) => (
                  <tr key={n.id} className="hover:bg-paper-2/60 h-13">
                    <td className="text-ink px-4 py-3 font-semibold">
                      {n.title ?? 'Başlıksız (taslak)'}
                    </td>
                    <td className="text-ink-soft px-4 py-3">{n.organizationName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${n.cardStatus === 'approved' ? 'bg-verified-soft text-verified' : 'bg-declared-soft text-declared'}`}
                      >
                        {n.cardStatus === 'approved' ? 'Onaylı' : 'Taslak'}
                      </span>
                    </td>
                    <td className="text-ink-soft tnum px-4 py-3">
                      {n.cardStatus === 'approved'
                        ? `${n.matches.strong} güçlü · ${n.matches.possible} olası · ${n.matches.weak} zayıf · ${n.matches.introduced} tanıştırma`
                        : '—'}
                    </td>
                    <td className="text-ink-soft px-4 py-3">
                      {n.cardStatus !== 'approved'
                        ? '—'
                        : n.shortlistPublishedAt
                          ? 'Açık'
                          : 'Kapalı'}
                    </td>
                    <td className="px-4 py-3">
                      {n.cardStatus === 'approved' && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            pending={busy === n.id}
                            pendingText="Eşleştiriliyor…"
                            onClick={() => void match(n.id)}
                          >
                            Eşleştir
                          </Button>
                          <Link
                            to="/ag"
                            className="border-line hover:bg-paper-2 inline-flex min-h-9 items-center rounded-[var(--radius-control)] border px-3 text-sm font-semibold"
                          >
                            Keşif
                          </Link>
                          <Link
                            to="/meydan"
                            className="border-line hover:bg-paper-2 inline-flex min-h-9 items-center rounded-[var(--radius-control)] border px-3 text-sm font-semibold"
                          >
                            Meydan okuma
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Enter>
    </div>
  );
}
