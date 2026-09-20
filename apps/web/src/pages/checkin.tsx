import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Check } from 'lucide-react';
import type { CollaborationStatus } from '@evidex/shared';
import { api, ApiRequestError } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter } from '../components/motion';
import { Button, ErrorNote, Eyebrow, Skeleton, Textarea } from '../components/ui';

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

type Durum =
  | { tur: 'yukleniyor' }
  | { tur: 'gecersiz' }
  | { tur: 'cevaplanmis'; ctx: CheckinContext }
  | { tur: 'form'; ctx: CheckinContext }
  | { tur: 'tesekkur'; ctx: CheckinContext };

/**
 * Takip cevabı (izle 06). E-postadaki linkten gelir; oturum yok. Tek soru: durum + isteğe bağlı
 * not. Durumlar ayrık: yükleniyor / geçersiz link / zaten cevaplanmış / form / teşekkür.
 * Kurum "tamamlandı" derse notu gencin kartına referans olarak düşer (KARAR-10) — ekranda
 * açıkça söylenir; kurum ne yazdığını bilerek yazsın.
 */
export function CheckinPage() {
  useTitle('Takip');
  const { token = '' } = useParams();
  const [durum, setDurum] = useState<Durum>({ tur: 'yukleniyor' });
  const [status, setStatus] = useState<CollaborationStatus | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<CheckinContext>(`/api/checkin/${token}`)
      .then((ctx) => {
        setStatus(ctx.currentStatus);
        setDurum(ctx.answered ? { tur: 'cevaplanmis', ctx } : { tur: 'form', ctx });
      })
      .catch(() => setDurum({ tur: 'gecersiz' }));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (durum.tur !== 'form' || !status) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/checkin/${token}`, {
        method: 'POST',
        body: JSON.stringify({ status, feedback }),
      });
      setDurum({ tur: 'tesekkur', ctx: durum.ctx });
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'already_answered')
        setDurum({ tur: 'cevaplanmis', ctx: durum.ctx });
      else setError(err instanceof Error ? err.message : 'Cevap kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center px-4 py-10">
      <Enter i={0} as="header" className="flex items-center justify-between">
        <Link to="/" className="text-ink text-base font-extrabold tracking-tight">
          Evidex
        </Link>
        <Eyebrow>Takip sorusu</Eyebrow>
      </Enter>

      {durum.tur === 'yukleniyor' && (
        <div className="mt-8">
          <Skeleton rows={4} />
        </div>
      )}

      {durum.tur === 'gecersiz' && (
        <Enter i={1} as="section" className="mt-8">
          <h1 className="text-ink text-2xl font-bold tracking-[-0.02em]">
            Bu bağlantı geçerli değil
          </h1>
          <p className="text-ink-soft mt-2 leading-relaxed">
            Takip bağlantıları tek kullanımlık ve kişiye özel. E-postadaki bağlantının tamamını
            kopyaladığından emin ol; sorun sürerse cevabını GİRVAK'a e-postayla ilet.
          </p>
        </Enter>
      )}

      {durum.tur === 'cevaplanmis' && (
        <Enter i={1} as="section" className="mt-8">
          <h1 className="text-ink text-2xl font-bold tracking-[-0.02em]">Bu soru cevaplanmış</h1>
          <p className="text-ink-soft mt-2 leading-relaxed">
            "{durum.ctx.needTitle}" iş birliği için cevabın zaten kayıtlı. Bir sonraki soru ayrı
            bağlantıyla gelir; aradaki bir gelişmeyi GİRVAK'a doğrudan yazabilirsin.
          </p>
        </Enter>
      )}

      {durum.tur === 'tesekkur' && (
        <Enter i={1} as="section" className="mt-8" y={4}>
          <div className="bg-verified-soft text-verified inline-flex h-10 w-10 items-center justify-center rounded-full">
            <Check size={20} aria-hidden />
          </div>
          <h1 className="text-ink mt-4 text-2xl font-bold tracking-[-0.02em]">Teşekkürler</h1>
          <p className="text-ink-soft mt-2 leading-relaxed" role="status">
            Cevabın kaydedildi; GİRVAK operatörü görür. Bu bağlantı artık kapalı, bir sonraki soru
            ayrı bağlantıyla gelir.
          </p>
        </Enter>
      )}

      {durum.tur === 'form' && (
        <Form
          ctx={durum.ctx}
          status={status}
          setStatus={setStatus}
          feedback={feedback}
          setFeedback={setFeedback}
          busy={busy}
          error={error}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function Form({
  ctx,
  status,
  setStatus,
  feedback,
  setFeedback,
  busy,
  error,
  onSubmit,
}: {
  ctx: CheckinContext;
  status: CollaborationStatus | null;
  setStatus: (s: CollaborationStatus) => void;
  feedback: string;
  setFeedback: (s: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => Promise<void>;
}) {
  const kurum = ctx.side === 'organization';
  const karsi = kurum ? ctx.talentFirstName : ctx.organizationName;
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-8">
      <Enter i={1} as="div">
        <h1 className="text-ink text-[26px] leading-tight font-bold tracking-[-0.025em]">
          {karsi} ile nasıl gidiyor?
        </h1>
        <p className="text-ink-soft mt-2">{ctx.needTitle}</p>
      </Enter>

      <Enter i={2} as="div">
        <fieldset className="mt-6">
          <legend className="sr-only">Durum</legend>
          <div className="grid grid-cols-2 gap-2">
            {SECENEKLER.map((s) => {
              const secili = status === s.value;
              return (
                <label
                  key={s.value}
                  className={`pressable flex min-h-12 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border px-3 text-sm ${
                    secili
                      ? 'border-accent bg-accent-soft text-accent-strong font-bold'
                      : 'border-line bg-surface text-ink hover:bg-paper-2'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s.value}
                    checked={secili}
                    onChange={() => setStatus(s.value)}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      secili ? 'border-accent bg-accent text-paper' : 'border-line'
                    }`}
                    aria-hidden
                  >
                    {secili && <Check size={11} strokeWidth={3} />}
                  </span>
                  {kurum ? s.organization : s.talent}
                </label>
              );
            })}
          </div>
        </fieldset>
      </Enter>

      <Enter i={3} as="div" className="mt-4">
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          maxLength={2000}
          aria-label="Not"
          placeholder={
            kurum
              ? 'İsteğe bağlı not: ne yapıldı, nasıl gitti, bir sorun var mı?'
              : 'İsteğe bağlı not: nasıl gidiyor, takıldığın bir şey var mı?'
          }
          className="w-full"
        />
        {kurum && status === 'completed' && (
          <p className="bg-referenced-soft text-referenced mt-2 rounded-[var(--radius-control)] px-3 py-2 text-xs leading-relaxed">
            "Tamamlandı" + notunuz, {ctx.talentFirstName}'in kartına <b>referans</b> olarak girer
            (kurumunuz GİRVAK onaylıysa). Yazdığınız değerlendirme kartı görenlere açık olacak.
          </p>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button
          type="submit"
          variant="primary"
          pending={busy}
          pendingText="Kaydediliyor…"
          disabled={!status}
          className="mt-4 w-full"
        >
          Gönder
        </Button>
        <p className="text-ink-soft mt-3 text-xs leading-relaxed">
          Olmadıysa da sorun değil; bilmemiz yeter. Notunu yalnız GİRVAK operatörü görür
          {kurum ? ' (referans hariç)' : ''}.
        </p>
      </Enter>
    </form>
  );
}
