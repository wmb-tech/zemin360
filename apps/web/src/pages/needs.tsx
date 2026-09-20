import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { CollaborationType, WorkMode } from '@evidex/shared';
import { api } from '../lib/api';

/** API'nin döndürdüğü ihtiyaç kaydı (taslak kart alanları boş olabilir). */
interface Need {
  id: string;
  rawText: string;
  cardStatus: 'draft' | 'approved';
  card: Partial<{
    title: string;
    summary: string;
    collaborationType: CollaborationType | null;
    expectedOutput: string;
    durationWeeks: number | null;
    workMode: WorkMode | null;
    compensation: string | null;
    requiredSkills: string[];
    niceToHaveSkills: string[];
    worksWith: string | null;
    constraints: string[];
  }> | null;
  turns: { question: string; answer: string }[];
  pendingQuestion: { text: string; why: string } | null;
  missingFields: string[];
  createdAt: string;
}

const TYPE_LABEL: Record<CollaborationType, string> = {
  internship: 'Staj',
  project: 'Proje',
  part_time: 'Yarı zamanlı',
  full_time: 'Tam zamanlı',
  pilot_customer: 'Pilot müşteri',
  co_founder: 'Kurucu ortak',
  mentor: 'Mentor',
};
const MODE_LABEL: Record<WorkMode, string> = {
  remote: 'Uzaktan',
  onsite: 'Yerinde',
  hybrid: 'Karma',
};
const FIELD_LABEL: Record<string, string> = {
  title: 'Başlık',
  summary: 'Özet',
  collaborationType: 'İş birliği türü',
  expectedOutput: 'Beklenen çıktı',
  workMode: 'Çalışma biçimi',
  requiredSkills: 'Gerekli beceriler',
};

export function NeedsListPage() {
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [rawText, setRawText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void api<Need[]>('/api/needs').then(setNeeds);
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const need = await api<Need>('/api/needs', {
        method: 'POST',
        body: JSON.stringify({ rawText }),
      });
      navigate(`/ihtiyaclar/${need.id}`);
    } catch (err) {
      // Hata dalı görünür: kullanıcı "tıkladım bir şey olmadı" yaşamaz.
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Yeni ihtiyaç</h1>
        <p className="text-ink-soft mt-2">
          İlan yazma. Derdini anlat; birkaç soru sorup net bir ihtiyaç kartına çevirelim.
        </p>
        <form onSubmit={(e) => void create(e)} className="mt-4">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={6}
            minLength={10}
            required
            placeholder="Örn. E-ticaret sitemiz var, mobil tarafa birine ihtiyacımız var…"
            className="border-line focus:border-accent w-full rounded-xl border p-3 text-sm outline-none"
          />
          <button
            disabled={busy || rawText.trim().length < 10}
            className="bg-accent text-paper mt-3 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Okunuyor…' : 'Başla'}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </form>
      </section>

      <section>
        <h2 className="text-ink-soft text-sm font-semibold tracking-wide uppercase">
          İhtiyaçlarım
        </h2>
        <ul className="mt-3 divide-y divide-[var(--color-line)]">
          {needs?.length === 0 && (
            <li className="text-ink-soft py-4 text-sm">Henüz ihtiyaç yok.</li>
          )}
          {needs?.map((n) => (
            <li key={n.id} className="py-3">
              <Link to={`/ihtiyaclar/${n.id}`} className="font-semibold hover:underline">
                {n.card?.title ?? n.rawText.slice(0, 60)}
              </Link>
              <div className="text-ink-soft mt-0.5 text-xs">
                {n.cardStatus === 'approved'
                  ? 'Onaylı'
                  : `Taslak · ${n.missingFields.length} alan eksik`}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function NeedDetailPage() {
  const { id } = useParams();
  const [need, setNeed] = useState<Need | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Need>(`/api/needs/${id}`).then(setNeed);
  }, [id]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!need) return;
    setBusy(true);
    setError(null);
    try {
      setNeed(
        await api<Need>(`/api/needs/${need.id}/answer`, {
          method: 'POST',
          body: JSON.stringify({ answer }),
        }),
      );
      setAnswer('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!need) return;
    setBusy(true);
    setError(null);
    try {
      setNeed(
        await api<Need>(`/api/needs/${need.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }

  if (!need) return null;
  const card = need.card ?? {};
  const approved = need.cardStatus === 'approved';

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1fr]">
      {/* Sol: sohbet */}
      <section>
        <Link to="/ihtiyaclar" className="text-ink-soft text-sm hover:underline">
          ← İhtiyaçlar
        </Link>
        <div className="mt-4 space-y-3">
          <Bubble who="Siz">{need.rawText}</Bubble>
          {need.turns.map((t, i) => (
            <div key={i} className="space-y-3">
              <Bubble who="Evidex">{t.question}</Bubble>
              <Bubble who="Siz">{t.answer}</Bubble>
            </div>
          ))}
          {need.pendingQuestion && !approved && (
            <Bubble who="Evidex" hint={need.pendingQuestion.why}>
              {need.pendingQuestion.text}
            </Bubble>
          )}
        </div>
        {!approved && need.pendingQuestion && (
          <form onSubmit={(e) => void send(e)} className="mt-4 flex gap-2">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              required
              placeholder="Cevabın…"
              className="border-line focus:border-accent flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
            />
            <button
              disabled={busy}
              className="bg-ink text-paper rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? '…' : 'Gönder'}
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {/* Sağ: canlı dolan kart */}
      <section className="border-line h-fit rounded-2xl border p-6">
        <div className="text-ink-soft flex items-center justify-between text-xs font-semibold tracking-wide uppercase">
          <span>İhtiyaç kartı</span>
          <span className={approved ? 'text-verified' : ''}>{approved ? 'Onaylı' : 'Taslak'}</span>
        </div>
        <h1 className="mt-2 text-xl font-bold tracking-tight">
          {card.title ?? <Empty>Başlık</Empty>}
        </h1>
        <p className="mt-2 text-sm">{card.summary ?? <Empty>Özet</Empty>}</p>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label="İş birliği türü">
            {card.collaborationType ? TYPE_LABEL[card.collaborationType] : null}
          </Field>
          <Field label="Çalışma biçimi">{card.workMode ? MODE_LABEL[card.workMode] : null}</Field>
          <Field label="Süre">{card.durationWeeks ? `${card.durationWeeks} hafta` : null}</Field>
          <Field label="Karşılık">{card.compensation}</Field>
          <Field label="Beklenen çıktı" wide>
            {card.expectedOutput}
          </Field>
          <Field label="Gerekli beceriler" wide>
            {card.requiredSkills?.length ? <Tags items={card.requiredSkills} /> : null}
          </Field>
          <Field label="Olursa iyi" wide>
            {card.niceToHaveSkills?.length ? <Tags items={card.niceToHaveSkills} muted /> : null}
          </Field>
          <Field label="Kiminle çalışacak">{card.worksWith}</Field>
        </dl>
        {approved && <ChallengeResults needId={need.id} />}
        {approved && (
          <div className="border-line mt-6 border-t pt-4">
            <Link
              to={`/ihtiyaclar/${need.id}/adaylar`}
              className="text-accent text-sm font-semibold hover:underline"
            >
              Adayları gör →
            </Link>
          </div>
        )}
        {!approved && (
          <div className="border-line mt-6 border-t pt-4">
            {need.missingFields.length > 0 ? (
              <p className="text-ink-soft text-xs">
                Onay için eksik: {need.missingFields.map((f) => FIELD_LABEL[f] ?? f).join(', ')}
              </p>
            ) : (
              <button
                onClick={() => void approve()}
                disabled={busy}
                className="bg-accent text-paper rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Kartı onayla
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Bubble({
  who,
  hint,
  children,
}: {
  who: 'Siz' | 'Evidex';
  hint?: string;
  children: React.ReactNode;
}) {
  const mine = who === 'Siz';
  return (
    <div className={mine ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-accent-soft' : 'bg-paper-2'}`}
      >
        <div className="text-ink-soft mb-0.5 text-[10px] font-semibold tracking-wide uppercase">
          {who}
        </div>
        {children}
        {hint && <div className="text-ink-soft mt-1 text-xs italic">{hint}</div>}
      </div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-ink-soft text-xs">{label}</dt>
      <dd className="mt-0.5">{children ?? <Empty>—</Empty>}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-declared">{children}</span>;
}

function Tags({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className={`rounded-md px-2 py-0.5 text-xs ${muted ? 'bg-paper-2 text-ink-soft' : 'bg-accent-soft'}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

interface ChallengeResult {
  challenge: { id: string; title: string; status: 'draft' | 'open' | 'closed' | 'evaluated' };
  submissions: {
    submissionId: string;
    rank: number | null;
    name: string;
    evaluation: { band: 'strong' | 'solid' | 'partial' | 'incomplete'; summary: string } | null;
  }[];
}
const BAND_TR = {
  strong: 'Güçlü',
  solid: 'Sağlam',
  partial: 'Kısmi',
  incomplete: 'Eksik',
} as const;

/** Kurum, ihtiyacından türetilen meydan okumanın ilk üçünü görür (ilk adla). */
function ChallengeResults({ needId }: { needId: string }) {
  const [list, setList] = useState<ChallengeResult[] | null>(null);
  useEffect(() => {
    void api<ChallengeResult[]>(`/api/needs/${needId}/challenges`).then(setList);
  }, [needId]);
  if (!list || list.length === 0) return null;
  return (
    <div className="border-line mt-6 border-t pt-4">
      <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">
        Meydan okuma
      </div>
      {list.map((r) => (
        <div key={r.challenge.id} className="mt-2 text-sm">
          <div className="font-semibold">{r.challenge.title}</div>
          {r.challenge.status !== 'evaluated' && (
            <div className="text-ink-soft text-xs">
              {r.challenge.status === 'open'
                ? 'Açık — gençler teslim ediyor'
                : r.challenge.status === 'closed'
                  ? 'Kapandı — değerlendirme bekliyor'
                  : 'Taslak'}
            </div>
          )}
          {r.submissions.length > 0 && (
            <ol className="mt-1 space-y-1">
              {r.submissions.map((s) => (
                <li key={s.submissionId} className="flex items-center gap-2">
                  <span className="text-ink-soft font-mono text-xs">#{s.rank}</span>
                  <span className="font-semibold">{s.name}</span>
                  {s.evaluation && (
                    <span className="text-ink-soft text-xs">
                      {BAND_TR[s.evaluation.band]} · {s.evaluation.summary}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}
