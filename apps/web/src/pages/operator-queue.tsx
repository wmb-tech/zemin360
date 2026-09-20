import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface QueueItem {
  id: string;
  action: 'publish_shortlist' | 'introduce' | 'send_follow_up' | 'invite';
  subjectType: string;
  subjectId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

const ACTION_LABEL: Record<QueueItem['action'], string> = {
  publish_shortlist: 'Kısa listeyi kuruma aç',
  introduce: 'Tanıştırma e-postası gönder',
  send_follow_up: 'Takip sorusu gönder',
  invite: 'Ağa davet et',
};

/**
 * Operatörün tek ekranı (ADR-0004): ajanın önerdiği her dışa dönük eylem burada bekler.
 * Onay = yürüt. Ret = hiçbir şey olmaz. Düzenle = içeriği değiştirip yürüt.
 */
export function OperatorQueuePage() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setItems(await api<QueueItem[]>('/api/operator/queue'));
  }
  useEffect(() => {
    void load();
  }, []);

  async function decide(
    id: string,
    decision: 'approve' | 'reject',
    editedPayload?: Record<string, unknown>,
  ) {
    setBusy(id);
    setError(null);
    try {
      await api(`/api/operator/queue/${id}`, {
        method: 'POST',
        body: JSON.stringify(editedPayload ? { decision: 'edit', editedPayload } : { decision }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Onay kuyruğu</h1>
      <p className="text-ink-soft mt-2 max-w-prose">
        Ajanın yapmak istediği her dışa dönük şey burada bekler. Sen onaylamadan hiçbir mesaj
        gitmez, hiçbir liste açılmaz.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <ul className="mt-6 space-y-4">
        {items?.length === 0 && (
          <li className="border-line text-ink-soft rounded-xl border border-dashed p-6 text-sm">
            Kuyruk boş. Ajan bir şey önerdiğinde burada görünür.
          </li>
        )}
        {items?.map((it) => (
          <li key={it.id} className="border-line rounded-xl border p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-accent text-xs font-semibold tracking-wide uppercase">
                  {ACTION_LABEL[it.action]}
                </div>
                <QueuePayload item={it} />
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  disabled={busy === it.id}
                  onClick={() => void decide(it.id, 'reject')}
                  className="border-line rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--color-paper-2)] disabled:opacity-50"
                >
                  Reddet
                </button>
                <button
                  disabled={busy === it.id}
                  onClick={() => void decide(it.id, 'approve')}
                  className="bg-accent text-paper rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                >
                  Onayla
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QueuePayload({ item }: { item: QueueItem }) {
  const p = item.payload;
  if (item.action === 'publish_shortlist') {
    const counts = (p.counts ?? {}) as { strong?: number; possible?: number; weak?: number };
    return (
      <div className="mt-1">
        <div className="font-semibold">{String(p.needTitle ?? 'İhtiyaç')}</div>
        <div className="text-ink-soft mt-1 text-sm">
          {counts.strong ?? 0} güçlü · {counts.possible ?? 0} olası · {counts.weak ?? 0} zayıf aday
        </div>
      </div>
    );
  }
  if (item.action === 'introduce') {
    return (
      <div className="mt-1">
        <div className="font-semibold">{String(p.subject ?? '')}</div>
        <pre className="text-ink-soft mt-2 max-w-xl text-sm whitespace-pre-wrap">
          {String(p.message ?? '')}
        </pre>
      </div>
    );
  }
  if (item.action === 'send_follow_up') {
    return (
      <div className="mt-1">
        <div className="font-semibold">{String(p.subject ?? '')}</div>
        {p.needTitle ? <div className="text-ink-soft text-xs">{String(p.needTitle)}</div> : null}
        <div className="mt-2 grid max-w-2xl gap-3 md:grid-cols-2">
          <div>
            <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">Gence</div>
            <p className="text-ink-soft mt-1 text-sm whitespace-pre-wrap">
              {String(p.messageTalent ?? '')}
            </p>
          </div>
          <div>
            <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">
              Kuruma
            </div>
            <p className="text-ink-soft mt-1 text-sm whitespace-pre-wrap">
              {String(p.messageOrganization ?? '')}
            </p>
          </div>
        </div>
        <p className="text-ink-soft mt-2 text-xs">
          [link] yerine tek kullanımlık cevap linki girer.
        </p>
      </div>
    );
  }
  if (item.action === 'invite') {
    const emails = (p.emails ?? []) as string[];
    return (
      <div className="mt-1">
        <div className="font-semibold">
          {String(p.source ?? 'Liste')} · {emails.length} kişi
          {Number(p.skipped ?? 0) > 0 && (
            <span className="text-ink-soft font-normal"> · {String(p.skipped)} zaten ağda</span>
          )}
        </div>
        <p className="text-ink-soft mt-1 max-w-xl text-sm whitespace-pre-wrap">
          {String(p.message ?? '')}
        </p>
        <p className="text-ink-soft mt-1 font-mono text-xs">
          {emails.slice(0, 8).join(', ')}
          {emails.length > 8 ? ` … +${emails.length - 8}` : ''}
        </p>
      </div>
    );
  }
  return <pre className="text-ink-soft mt-2 text-xs">{JSON.stringify(p, null, 2)}</pre>;
}
