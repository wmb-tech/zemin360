import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Button, ErrorNote, Eyebrow, Panel, Skeleton } from '../components/ui';

interface Delivery {
  id: string;
  subject: string;
  recipients: string[];
  status: string;
  createdAt: string;
  sentAt: string | null;
}
const STATUS: Record<string, string> = {
  pending: 'Gönderim bekliyor',
  sending: 'Gönderiliyor',
  sent: 'Gönderildi',
  uncertain: 'Gönderim kontrol edilmeli',
};

export function DeliveriesPage() {
  useTitle('Tanıştırma gönderimleri');
  const [items, setItems] = useState<Delivery[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    void api<Delivery[]>('/api/operator/deliveries')
      .then(setItems)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Gönderimler yüklenemedi'),
      );
  }, []);
  async function retry(id: string) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await api(`/api/operator/deliveries/${id}/retry`, { method: 'POST' });
      setItems(await api<Delivery[]>('/api/operator/deliveries'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gönderim tamamlanamadı');
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="max-w-[880px]">
      <Eyebrow>GİRVAK operasyonları</Eyebrow>
      <h1 className="text-ink text-[28px] font-extrabold tracking-[-0.035em] md:text-[34px]">
        Tanıştırma gönderimleri
      </h1>
      <p className="text-ink-soft mt-2">
        Onaylanan tanıştırmaların e-posta durumunu izle. Belirsiz bir gönderim kendiliğinden
        tekrarlanmaz.
      </p>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!items && !error && <Skeleton rows={4} />}
      <div className="mt-6 space-y-4">
        {items?.map((item) => (
          <Panel key={item.id} className="p-5">
            <p className="text-ink-soft text-sm">{STATUS[item.status] ?? item.status}</p>
            <h2 className="text-ink mt-1 font-bold">{item.subject}</h2>
            <p className="text-ink-soft mt-2 break-words text-sm">{item.recipients.join(' · ')}</p>
            {item.sentAt && (
              <p className="text-ink-soft mt-2 text-xs">
                {new Date(item.sentAt).toLocaleString('tr-TR')}
              </p>
            )}
            {item.status === 'uncertain' && (
              <>
                <p className="text-ink-soft mt-3 text-sm">
                  E-posta alıcıya ulaşmış olabilir. Önce alıcıyla kontrol et; yeniden gönderirsen
                  aynı mesaj tekrar ulaşabilir.
                </p>
                <Button
                  className="mt-3"
                  disabled={Boolean(busy)}
                  pending={busy === item.id}
                  onClick={() => void retry(item.id)}
                >
                  Kontrol ettim, yeniden gönder
                </Button>
              </>
            )}
          </Panel>
        ))}
      </div>
      {items?.length === 0 && (
        <p className="text-ink-soft mt-6">Henüz onaylanan tanıştırma gönderimi yok.</p>
      )}
    </div>
  );
}
