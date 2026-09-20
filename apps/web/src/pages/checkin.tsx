import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import type { CollaborationStatus } from '@evidex/shared';
import { api } from '../lib/api';

interface CheckinContext {
  side: 'talent' | 'organization';
  answered: boolean;
  organizationName: string;
  talentFirstName: string;
  needTitle: string;
  currentStatus: CollaborationStatus;
}

/** Tarafın seçeceği durumlar; sıra döngünün sırası. */
const SECENEKLER: { value: CollaborationStatus; talent: string; organization: string }[] = [
  { value: 'introduced', talent: 'Henüz görüşmedik', organization: 'Henüz görüşmedik' },
  { value: 'meeting', talent: 'Görüştük', organization: 'Görüştük' },
  { value: 'started', talent: 'Başladık', organization: 'Başladı' },
  { value: 'ongoing', talent: 'Sürüyor', organization: 'Sürüyor' },
  { value: 'completed', talent: 'Bitti', organization: 'Tamamlandı' },
  { value: 'did_not_happen', talent: 'Olmadı', organization: 'Olmadı' },
];

/**
 * Takip cevabı (izle 06). E-postadaki linkten gelir; oturum yok. Tek soru: durum + isteğe bağlı
 * not. Kurum "tamamlandı" derse notu gencin kartına referans olarak düşer (KARAR-10) — bunu
 * ekranda açıkça söyleriz; kurum ne yazdığını bilerek yazsın.
 */
export function CheckinPage() {
  const { token = '' } = useParams();
  const [ctx, setCtx] = useState<CheckinContext | null>(null);
  const [status, setStatus] = useState<CollaborationStatus | null>(null);
  const [feedback, setFeedback] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<CheckinContext>(`/api/checkin/${token}`)
      .then((c) => {
        setCtx(c);
        setStatus(c.currentStatus);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Link geçersiz'));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/checkin/${token}`, {
        method: 'POST',
        body: JSON.stringify({ status, feedback }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }

  const kurum = ctx?.side === 'organization';

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">
        Evidex · takip
      </div>
      {error && !ctx && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {ctx && (done || ctx.answered) && (
        <div className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight">Teşekkürler.</h1>
          <p className="text-ink-soft mt-2 text-sm">
            Cevabın kaydedildi. Bu link tek kullanımlık; bir sonraki soru ayrı linkle gelir.
          </p>
        </div>
      )}
      {ctx && !done && !ctx.answered && (
        <form onSubmit={(e) => void submit(e)} className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight">
            {kurum
              ? `${ctx.talentFirstName} ile nasıl gidiyor?`
              : `${ctx.organizationName} ile nasıl gidiyor?`}
          </h1>
          <p className="text-ink-soft mt-2 text-sm">{ctx.needTitle}</p>

          <fieldset className="mt-6 grid grid-cols-2 gap-2">
            {SECENEKLER.map((s) => (
              <label
                key={s.value}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm ${
                  status === s.value
                    ? 'border-accent bg-accent-soft font-semibold'
                    : 'border-line hover:bg-paper-2'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={s.value}
                  checked={status === s.value}
                  onChange={() => setStatus(s.value)}
                  className="sr-only"
                />
                {kurum ? s.organization : s.talent}
              </label>
            ))}
          </fieldset>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={
              kurum
                ? 'İsteğe bağlı not: ne yapıldı, nasıl gitti, bir sorun var mı?'
                : 'İsteğe bağlı not: nasıl gidiyor, takıldığın bir şey var mı?'
            }
            className="border-line focus:border-accent mt-4 w-full rounded-xl border px-3 py-2 text-sm outline-none"
          />
          {kurum && status === 'completed' && (
            <p className="text-referenced mt-2 text-xs">
              "Tamamlandı" + notunuz, {ctx.talentFirstName}'in kartına <b>referans</b> olarak girer
              (kurum onaylıysa). Yazdığınız değerlendirme görünür olacak.
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            disabled={busy || !status}
            className="bg-accent text-paper mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Gönder
          </button>
          <p className="text-ink-soft mt-3 text-xs">
            Olmadıysa da sorun değil; bilmemiz yeter. Cevabını yalnız GİRVAK operatörü görür.
          </p>
        </form>
      )}
    </div>
  );
}
