import { useEffect, useState } from 'react';
import { Handshake } from 'lucide-react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Button, Empty, ErrorNote, Eyebrow, Panel, Skeleton } from '../components/ui';

interface Introduction {
  matchId: string;
  needTitle: string;
  summary: string;
  party: string;
  workMode: string | null;
  compensation: string | null;
  durationWeeks: number | null;
  ownConsent: string | null;
  otherConsent: string | null;
  introduced: boolean;
  deliveryStatus: string | null;
  closed: boolean;
}

export function IntroductionsPage() {
  useTitle('Tanıştırmalar');
  const [items, setItems] = useState<Introduction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void api<Introduction[]>('/api/introductions')
      .then(setItems)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'İstekler yüklenemedi'),
      );
  }, []);
  async function respond(id: string, accepted: boolean) {
    if (busy) return;
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/introductions/${id}`, { method: 'POST', body: JSON.stringify({ accepted }) });
      setItems(await api<Introduction[]>('/api/introductions'));
      setMessage(
        accepted
          ? 'Kabulün kaydedildi. İki taraf da kabul ettiğinde GİRVAK tanıştırmayı onaylayabilir.'
          : 'İstek kapandı. İletişim bilgilerin paylaşılmadı.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Karar kaydedilemedi');
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="max-w-[880px]">
      <Eyebrow>Karşılıklı kabul</Eyebrow>
      <h1 className="text-ink text-[28px] font-extrabold tracking-[-0.035em] md:text-[34px]">
        Tanıştırmalar
      </h1>
      <p className="text-ink-soft mt-2">
        İki tarafın kabulü ve GİRVAK onayı olmadan tam ad ve iletişim bilgileri paylaşılmaz.
        Kabulünü tanıştırma yapılana kadar geri çekebilirsin.
      </p>
      {message && (
        <p
          role="status"
          className="bg-accent-soft text-accent-strong mt-5 rounded-[var(--radius-control)] p-4 text-sm"
        >
          {message}
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {!items && !error && <Skeleton rows={4} />}
      {items?.length === 0 && (
        <div className="mt-6">
          <Empty icon={Handshake} title="Henüz tanıştırma isteği yok">
            Bir eşleşme için tanıştırma istendiğinde burada karar verebilirsin.
          </Empty>
        </div>
      )}
      <div className="mt-6 space-y-4">
        {items?.map((item) => {
          const closed =
            item.closed || item.ownConsent === 'declined' || item.otherConsent === 'declined';
          const accepted = item.ownConsent === 'accepted';
          const status = item.introduced
            ? item.deliveryStatus === 'sent' || item.deliveryStatus === null
              ? 'Tanıştırma tamamlandı'
              : 'Tanıştırma onaylandı · e-posta gönderimi hazırlanıyor'
            : closed
              ? 'İstek kapandı'
              : accepted && item.otherConsent === 'accepted'
                ? 'İki taraf kabul etti · GİRVAK onayı bekleniyor'
                : accepted
                  ? 'Diğer tarafın kabulü bekleniyor'
                  : 'Kararın bekleniyor';
          return (
            <Panel key={item.matchId} className="p-5 md:p-6">
              <p className="text-ink-soft text-sm">{item.party}</p>
              <h2 className="text-ink mt-1 text-xl font-bold">{item.needTitle}</h2>
              <p className="text-ink-soft mt-3">{item.summary}</p>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-ink-soft">Çalışma biçimi</dt>
                  <dd className="text-ink mt-1 font-semibold">
                    {(
                      { remote: 'Uzaktan', onsite: 'Yerinde', hybrid: 'Hibrit' } as Record<
                        string,
                        string
                      >
                    )[item.workMode ?? ''] ?? 'Netleştirilecek'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Süre</dt>
                  <dd className="text-ink mt-1 font-semibold">
                    {item.durationWeeks ? `${item.durationWeeks} hafta` : 'Netleştirilecek'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Ücret / karşılık</dt>
                  <dd className="text-ink mt-1 font-semibold">
                    {item.compensation ?? 'Netleştirilecek'}
                  </dd>
                </div>
              </dl>
              <div className="border-line mt-5 border-t pt-4">
                <p className="text-ink text-sm font-semibold">{status}</p>
                {!closed && !item.introduced && (
                  <>
                    <p className="text-ink-soft mt-1 text-sm">
                      Kabul edersen, GİRVAK onayından sonra tam adın ve e-posta adresin karşı
                      tarafla paylaşılır.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {!accepted && (
                        <Button
                          variant="primary"
                          disabled={Boolean(busy)}
                          pending={busy === item.matchId}
                          onClick={() => void respond(item.matchId, true)}
                        >
                          Tanıştırmayı kabul ediyorum
                        </Button>
                      )}
                      <Button
                        disabled={Boolean(busy)}
                        onClick={() => void respond(item.matchId, false)}
                      >
                        {accepted ? 'Kabulümü geri çek' : 'Bu kez istemiyorum'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
