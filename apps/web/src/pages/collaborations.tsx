import { useEffect, useState } from 'react';
import type { CheckinInsight, CollaborationStatus } from '@evidex/shared';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';

interface Round {
  side: 'talent' | 'organization';
  sentAt: string;
  answeredAt: string | null;
  status: CollaborationStatus | null;
  feedback: string | null;
  insight: CheckinInsight | null;
}
interface Collaboration {
  id: string;
  matchId: string;
  status: CollaborationStatus;
  introducedAt: string | null;
  lastCheckinAt: string | null;
  lastFollowUpAt: string | null;
  silentSince: string | null;
  needTitle: string | null;
  organizationName: string;
  organizationApproved: boolean;
  talentName: string;
  rounds: number;
  conflict: boolean;
  needsOperator: boolean;
  lastRound: Round[];
}

const STATUS: Record<CollaborationStatus, string> = {
  introduced: 'Tanıştırıldı',
  meeting: 'Görüşüldü',
  started: 'Başladı',
  ongoing: 'Sürüyor',
  completed: 'Tamamlandı',
  did_not_happen: 'Olmadı',
};
const FLAG: Record<string, string> = {
  no_contact: 'görüşülemedi',
  schedule: 'takvim',
  scope: 'kapsam',
  payment: 'ödeme',
  communication: 'iletişim',
  positive: 'olumlu',
  ended: 'bitti',
};
const tarih = (s: string | null) => (s ? new Date(s).toLocaleDateString('tr-TR') : '—');

/**
 * Operatörün "İş birlikleri" ekranı (izle 06). Her satır bir tanıştırma; ajan sorar, taraflar
 * cevaplar, operatör yalnız bayraklı/çelişkili/sessiz olana bakar. Durumu elle de değiştirebilir.
 */
export function CollaborationsPage() {
  useTitle('İş birlikleri');
  const [list, setList] = useState<Collaboration[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setList(await api<Collaboration[]>('/api/operator/collaborations'));
  }
  useEffect(() => {
    void load();
  }, []);

  async function scan() {
    setBusy('scan');
    setNote(null);
    try {
      const r = await api<{ proposed: number; silent: number }>('/api/operator/follow-ups/scan', {
        method: 'POST',
      });
      setNote(`${r.proposed} takip önerisi kuyruğa düştü · ${r.silent} sessiz işaretlendi`);
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(c: Collaboration, status: CollaborationStatus) {
    setBusy(c.id);
    try {
      await api(`/api/operator/collaborations/${c.matchId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const dikkat = list?.filter((c) => c.conflict || c.needsOperator || c.silentSince) ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">İş birlikleri</h1>
          <p className="text-ink-soft mt-2 max-w-prose text-sm">
            Tanıştırmadan 3 gün sonra ajan iki tarafa sorar; cevaplar buraya düşer. Sen yalnız
            bayraklı, çelişkili ve sessiz olanlara bakarsın. Zamanlayıcı saatte bir tarar.
          </p>
        </div>
        <button
          disabled={busy === 'scan'}
          onClick={() => void scan()}
          className="bg-accent text-paper rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy === 'scan' ? 'Taranıyor…' : 'Şimdi tara'}
        </button>
      </div>
      {note && <p className="text-ink-soft mt-3 text-sm">{note}</p>}

      {dikkat.length > 0 && (
        <p className="border-referenced text-referenced mt-4 rounded-lg border px-3 py-2 text-sm">
          {dikkat.length} iş birliği dikkat istiyor.
        </p>
      )}

      <ul className="mt-6 divide-y divide-[var(--color-line)]">
        {list?.length === 0 && (
          <li className="text-ink-soft py-6 text-sm">
            Henüz tanıştırma yok. Tanıştırma onaylanınca iş birliği kaydı burada açılır.
          </li>
        )}
        {list?.map((c) => (
          <li key={c.id} className="py-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOpen(open === c.id ? null : c.id)}
                className="text-left font-semibold hover:underline"
              >
                {c.talentName} · {c.organizationName}
              </button>
              <span className="bg-paper-2 rounded px-2 py-0.5 text-xs font-semibold">
                {STATUS[c.status]}
              </span>
              {c.conflict && <Etiket cls="text-referenced border-referenced">çelişki</Etiket>}
              {c.needsOperator && <Etiket cls="text-accent border-accent">bayrak</Etiket>}
              {c.silentSince && (
                <Etiket cls="text-declared border-declared">sessiz · {tarih(c.silentSince)}</Etiket>
              )}
              <span className="text-ink-soft ml-auto text-xs">
                {c.needTitle ?? 'İhtiyaç'} · tanıştırma {tarih(c.introducedAt)} · {c.rounds} tur
              </span>
            </div>

            {open === c.id && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {c.lastRound.length === 0 && (
                  <p className="text-ink-soft text-sm">Henüz takip sorusu gönderilmedi.</p>
                )}
                {c.lastRound.map((r) => (
                  <div key={r.side} className="border-line rounded-xl border p-3 text-sm">
                    <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">
                      {r.side === 'talent' ? 'Genç' : 'Kurum'} · gönderildi {tarih(r.sentAt)}
                    </div>
                    {r.answeredAt ? (
                      <>
                        <div className="mt-1 font-semibold">{r.status && STATUS[r.status]}</div>
                        {r.feedback && <p className="mt-1">{r.feedback}</p>}
                        {r.insight && (
                          <div className="bg-paper-2 mt-2 rounded-lg p-2 text-xs">
                            <span className="text-ink-soft">Ajan: </span>
                            {r.insight.summary}
                            {r.insight.flags.length > 0 && (
                              <span className="text-ink-soft">
                                {' '}
                                · {r.insight.flags.map((f) => FLAG[f] ?? f).join(', ')}
                              </span>
                            )}
                            {r.insight.operatorNote && (
                              <div className="text-accent mt-1 font-semibold">
                                {r.insight.operatorNote}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-ink-soft mt-1">Cevap bekleniyor</div>
                    )}
                  </div>
                ))}
                <div className="md:col-span-2">
                  <div className="text-ink-soft text-xs">Durumu elle değiştir</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(Object.keys(STATUS) as CollaborationStatus[]).map((s) => (
                      <button
                        key={s}
                        disabled={busy === c.id || s === c.status}
                        onClick={() => void setStatus(c, s)}
                        className="border-line hover:bg-paper-2 rounded-lg border px-2 py-1 text-xs disabled:opacity-40"
                      >
                        {STATUS[s]}
                      </button>
                    ))}
                  </div>
                  {!c.organizationApproved && (
                    <p className="text-ink-soft mt-2 text-xs">
                      Kurum GİRVAK onaylı değil: "tamamlandı" dese de referans üretmez (KARAR-10).
                    </p>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Etiket({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}
