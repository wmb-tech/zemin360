import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Pencil, Send, Users } from 'lucide-react';
import { CollaborationType, WorkMode, type NeedCardEdits } from '@evidex/shared';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter, Live } from '../components/motion';
import {
  Button,
  Empty,
  ErrorNote,
  Eyebrow,
  Field as FormField,
  Input,
  Panel,
  Skeleton,
  Textarea,
} from '../components/ui';

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
  shortlistPublishedAt?: string | null;
  candidates?: number | null;
  introduced?: number;
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

/* ---------------- Liste + yeni ihtiyaç ---------------- */
export function NeedsListPage() {
  useTitle('İhtiyaçlar');
  const nav = useNavigate();
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api<Need[]>('/api/needs')
      .then(setNeeds)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Yüklenemedi'));
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const n = await api<Need>('/api/needs', {
        method: 'POST',
        body: JSON.stringify({ rawText: text }),
      });
      nav(`/ihtiyaclar/${n.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Enter i={0} as="section">
        <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
          Yeni ihtiyaç
        </h1>
        <p className="text-ink-soft mt-2 max-w-[60ch]">
          İlan yazma. Derdini anlat; birkaç soru sorup net bir ihtiyaç kartına çevirelim. Adaylar
          gerekçesiyle gelir, tanıştırmayı GİRVAK yapar.
        </p>
        <form onSubmit={(e) => void create(e)} className="mt-6">
          <FormField label="Ne lazım?" hint="Kendi cümlelerinle; ajan gerisini sorar.">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              minLength={10}
              rows={6}
              placeholder="Örn. E-ticaret sitemiz var, mobil tarafa birine ihtiyacımız var…"
            />
          </FormField>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="mt-4">
            <Button
              type="submit"
              variant="primary"
              pending={busy}
              pendingText="Başlıyor…"
              disabled={text.trim().length < 10}
            >
              Başla
            </Button>
          </div>
        </form>
      </Enter>
      <Enter i={1} as="section">
        <h2 className="text-ink-soft text-xs font-bold tracking-wide uppercase">İhtiyaçlarım</h2>
        {needs === null ? (
          <div className="mt-3">
            <Skeleton rows={3} />
          </div>
        ) : needs.length === 0 ? (
          <div className="mt-3">
            <Empty title="Henüz ihtiyaç yok">
              İlkini soldan başlat; kart onaylanınca eşleştirme kendiliğinden koşar.
            </Empty>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-line)]">
            {needs.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <Link
                  to={`/ihtiyaclar/${n.id}`}
                  className="text-ink min-w-0 flex-1 font-semibold hover:underline"
                >
                  {n.card?.title ?? n.rawText.slice(0, 60)}
                </Link>
                <div className="text-ink-soft tnum flex flex-wrap items-center gap-2 text-sm">
                  {n.cardStatus === 'approved' ? (
                    <>
                      <span className="bg-verified-soft text-verified rounded-md px-2 py-0.5 text-xs font-bold">
                        Onaylı
                      </span>
                      {n.candidates === null || n.candidates === undefined ? (
                        <span>GİRVAK eşleştiriyor</span>
                      ) : (
                        <Link
                          to={`/ihtiyaclar/${n.id}/adaylar`}
                          className="text-accent inline-flex items-center gap-1 font-semibold hover:underline"
                        >
                          <Users size={14} aria-hidden /> {n.candidates} aday · {n.introduced ?? 0}{' '}
                          tanıştırma
                        </Link>
                      )}
                    </>
                  ) : (
                    <span className="bg-declared-soft text-declared rounded-md px-2 py-0.5 text-xs font-bold">
                      Taslak · {n.missingFields.length} alan eksik
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Enter>
    </div>
  );
}

/* ---------------- Detay: sohbet + canlı kart ---------------- */
export function NeedDetailPage() {
  useTitle('İhtiyaç');
  const { id } = useParams();
  const [need, setNeed] = useState<Need | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState<'answer' | 'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set()); // son cevapla değişen alanlar
  const [edits, setEdits] = useState<NeedCardEdits | null>(null); // onay öncesi düzeltme modu
  const [pane, setPane] = useState<'sohbet' | 'kart'>('sohbet'); // telefon
  const [live, setLive] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api<Need>(`/api/needs/${id}`)
      .then(setNeed)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Yüklenemedi'));
  }, [id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [need?.turns.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!need) return;
    setBusy('answer');
    setError(null);
    const onceki = need.card ?? {};
    try {
      const yeni = await api<Need>(`/api/needs/${need.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      });
      // Değişen alanlar: yalnız sunucu cevabı geldikten sonra vurgulanır (erken doldurma yok).
      const diff = new Set<string>();
      for (const k of Object.keys(yeni.card ?? {}) as (keyof NonNullable<Need['card']>)[]) {
        if (JSON.stringify((yeni.card ?? {})[k]) !== JSON.stringify(onceki[k])) diff.add(k);
      }
      setChanged(diff);
      window.setTimeout(() => setChanged(new Set()), 600);
      setNeed(yeni);
      setAnswer('');
      setLive(yeni.pendingQuestion ? 'Cevap alındı; yeni soru var.' : 'Kart onay için hazır.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cevap gönderilemedi; metnin duruyor.');
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!need) return;
    setBusy('approve');
    setError(null);
    try {
      setNeed(
        await api<Need>(`/api/needs/${need.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ edits: edits ?? {} }),
        }),
      );
      setEdits(null);
      setLive('Kart onaylandı. Eşleştirme başladı; kısa listeyi GİRVAK açacak.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onaylanamadı');
    } finally {
      setBusy(null);
    }
  }

  if (error && !need) return <ErrorNote>{error}</ErrorNote>;
  if (!need) return <Skeleton rows={5} />;
  const card = { ...(need.card ?? {}), ...(edits ?? {}) } as NonNullable<Need['card']>;
  const approved = need.cardStatus === 'approved';
  const hazir = !approved && need.missingFields.length === 0 && !need.pendingQuestion;

  return (
    <div>
      <Live message={live} />
      <Enter i={0} as="header" className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/ihtiyaclar"
            className="text-ink-soft inline-flex items-center gap-1 text-sm hover:underline"
          >
            <ArrowLeft size={14} aria-hidden /> İhtiyaçlar
          </Link>
          <h1 className="text-ink mt-1 truncate text-2xl font-extrabold tracking-[-0.02em]">
            {card.title ?? 'Yeni ihtiyaç'}
          </h1>
        </div>
        {approved && (
          <Link
            to={`/ihtiyaclar/${need.id}/adaylar`}
            className="pressable bg-accent text-surface hover:bg-accent-strong inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold"
          >
            <Users size={16} aria-hidden /> Adayları gör
          </Link>
        )}
      </Enter>

      {/* Telefon: sohbet / kart anahtarı; girilen cevap korunur */}
      <div className="border-line mt-4 flex gap-1 border-b lg:hidden" role="tablist">
        {(['sohbet', 'kart'] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={pane === p}
            onClick={() => setPane(p)}
            className={`-mb-px min-h-11 border-b-2 px-3 text-sm font-semibold ${pane === p ? 'border-accent text-accent-strong' : 'text-ink-soft border-transparent'}`}
          >
            {p === 'sohbet' ? 'Sohbet' : 'Kartı gör'}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[55fr_45fr]">
        <Enter i={1} as="section" className={pane === 'sohbet' ? '' : 'hidden lg:block'}>
          <div className="space-y-3">
            <Bubble who="Siz">{need.rawText}</Bubble>
            {need.turns.map((t, i) => (
              <div key={i} className="space-y-3">
                <Bubble who="Evidex">{t.question}</Bubble>
                <Bubble who="Siz">{t.answer}</Bubble>
              </div>
            ))}
            {need.pendingQuestion && !approved && (
              <Bubble who="Evidex" hint={need.pendingQuestion.why} current>
                {need.pendingQuestion.text}
              </Bubble>
            )}
            {approved && (
              <p className="text-ink-soft text-sm">
                Kart onaylı. Sohbet kapandı; adaylar GİRVAK kısa listeyi açınca görünür.
              </p>
            )}
            <div ref={bottom} />
          </div>
          {!approved && need.pendingQuestion && (
            <form
              onSubmit={(e) => void send(e)}
              className="bg-paper sticky bottom-20 mt-4 flex gap-2 pt-2 md:bottom-0"
            >
              <Input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                placeholder="Cevabın…"
                aria-label="Cevap"
                autoFocus
              />
              <Button
                type="submit"
                variant="primary"
                pending={busy === 'answer'}
                pendingText="Gönderiliyor…"
              >
                <Send size={16} aria-hidden /> Gönder
              </Button>
            </form>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
        </Enter>

        <Enter i={2} as="section" className={pane === 'kart' ? '' : 'hidden lg:block'}>
          <Panel className="p-6">
            <div className="flex items-center justify-between">
              <Eyebrow>İhtiyaç kartı</Eyebrow>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold ${approved ? 'bg-verified-soft text-verified' : 'bg-declared-soft text-declared'}`}
              >
                {approved ? 'Onaylı' : 'Taslak'}
              </span>
            </div>
            {edits ? (
              <EditForm card={card} edits={edits} setEdits={setEdits} />
            ) : (
              <>
                <h2
                  className={`text-ink mt-3 text-xl font-bold tracking-[-0.02em] ${changed.has('title') ? 'settle' : ''}`}
                >
                  {card.title ?? <Bos>Başlık</Bos>}
                </h2>
                <p className={`text-ink mt-2 ${changed.has('summary') ? 'settle' : ''}`}>
                  {card.summary ?? <Bos>Özet</Bos>}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
                  <Alan label="İş birliği türü" hi={changed.has('collaborationType')}>
                    {card.collaborationType ? TYPE_LABEL[card.collaborationType] : null}
                  </Alan>
                  <Alan label="Çalışma biçimi" hi={changed.has('workMode')}>
                    {card.workMode ? MODE_LABEL[card.workMode] : null}
                  </Alan>
                  <Alan label="Süre" hi={changed.has('durationWeeks')}>
                    {card.durationWeeks ? `${card.durationWeeks} hafta` : null}
                  </Alan>
                  <Alan label="Karşılık" hi={changed.has('compensation')}>
                    {card.compensation}
                  </Alan>
                  <Alan label="Beklenen çıktı" wide hi={changed.has('expectedOutput')}>
                    {card.expectedOutput}
                  </Alan>
                  <Alan label="Gerekli beceriler" wide hi={changed.has('requiredSkills')}>
                    {card.requiredSkills?.length ? <Tags items={card.requiredSkills} /> : null}
                  </Alan>
                  <Alan label="Olursa iyi" wide hi={changed.has('niceToHaveSkills')}>
                    {card.niceToHaveSkills?.length ? (
                      <Tags items={card.niceToHaveSkills} muted />
                    ) : null}
                  </Alan>
                  <Alan label="Kiminle çalışacak" hi={changed.has('worksWith')}>
                    {card.worksWith}
                  </Alan>
                </dl>
              </>
            )}
            {approved && <ChallengeResults needId={need.id} />}
            {!approved && (
              <div className="border-line mt-6 border-t pt-4">
                {need.missingFields.length > 0 ? (
                  <p className="text-ink-soft text-sm">
                    Onay için eksik:{' '}
                    <span className="text-ink font-semibold">
                      {need.missingFields.map((f) => FIELD_LABEL[f] ?? f).join(', ')}
                    </span>
                    . Soruları cevapladıkça dolar.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      pending={busy === 'approve'}
                      pendingText="Onaylanıyor…"
                      onClick={() => void approve()}
                      disabled={!hazir && !edits}
                    >
                      {edits ? 'Düzelt ve onayla' : 'Kartı onayla'}
                    </Button>
                    {edits ? (
                      <Button variant="tertiary" onClick={() => setEdits(null)}>
                        Düzeltmeyi bırak
                      </Button>
                    ) : (
                      <Button variant="tertiary" onClick={() => setEdits({})}>
                        <Pencil size={14} aria-hidden /> Onaylamadan önce düzelt
                      </Button>
                    )}
                    <span className="text-ink-soft text-xs">
                      Onaydan sonra eşleştirme kendiliğinden koşar; kısa listeyi GİRVAK açar.
                    </span>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </Enter>
      </div>
    </div>
  );
}

/** Onay öncesi düzeltme: alanlar görünür etiketli, ajan taslağı başlangıç değeri. */
function EditForm({
  card,
  edits,
  setEdits,
}: {
  card: NonNullable<Need['card']>;
  edits: NeedCardEdits;
  setEdits: (e: NeedCardEdits) => void;
}) {
  const set = (k: keyof NeedCardEdits, v: unknown) =>
    setEdits({ ...edits, [k]: v } as NeedCardEdits);
  const liste = (v: string) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return (
    <div className="mt-3 grid gap-4">
      <FormField label="Başlık">
        <Input value={card.title ?? ''} onChange={(e) => set('title', e.target.value)} />
      </FormField>
      <FormField label="Özet">
        <Textarea
          rows={3}
          value={card.summary ?? ''}
          onChange={(e) => set('summary', e.target.value)}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="İş birliği türü">
          <select
            value={card.collaborationType ?? ''}
            onChange={(e) => set('collaborationType', e.target.value)}
            className="border-line bg-surface w-full rounded-[var(--radius-control)] border px-3 py-2.5 text-base"
          >
            {CollaborationType.options.map((o) => (
              <option key={o} value={o}>
                {TYPE_LABEL[o]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Çalışma biçimi">
          <select
            value={card.workMode ?? ''}
            onChange={(e) => set('workMode', e.target.value)}
            className="border-line bg-surface w-full rounded-[var(--radius-control)] border px-3 py-2.5 text-base"
          >
            {WorkMode.options.map((o) => (
              <option key={o} value={o}>
                {MODE_LABEL[o]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Süre (hafta)">
          <Input
            type="number"
            min={1}
            value={card.durationWeeks ?? ''}
            onChange={(e) => set('durationWeeks', e.target.value ? Number(e.target.value) : null)}
          />
        </FormField>
        <FormField label="Karşılık">
          <Input
            value={card.compensation ?? ''}
            onChange={(e) => set('compensation', e.target.value || null)}
          />
        </FormField>
      </div>
      <FormField label="Beklenen çıktı">
        <Input
          value={card.expectedOutput ?? ''}
          onChange={(e) => set('expectedOutput', e.target.value)}
        />
      </FormField>
      <FormField label="Gerekli beceriler" hint="Virgülle ayır">
        <Input
          value={(card.requiredSkills ?? []).join(', ')}
          onChange={(e) => set('requiredSkills', liste(e.target.value))}
        />
      </FormField>
      <FormField label="Olursa iyi" hint="Virgülle ayır">
        <Input
          value={(card.niceToHaveSkills ?? []).join(', ')}
          onChange={(e) => set('niceToHaveSkills', liste(e.target.value))}
        />
      </FormField>
      <FormField label="Kiminle çalışacak">
        <Input
          value={card.worksWith ?? ''}
          onChange={(e) => set('worksWith', e.target.value || null)}
        />
      </FormField>
    </div>
  );
}

function Bubble({
  who,
  hint,
  current,
  children,
}: {
  who: 'Siz' | 'Evidex';
  hint?: string;
  current?: boolean;
  children: ReactNode;
}) {
  const mine = who === 'Siz';
  return (
    <div className={mine ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={`max-w-[88%] rounded-[var(--radius-panel)] px-4 py-3 ${mine ? 'bg-accent-soft' : current ? 'bg-surface border-line border' : 'bg-surface border-line border opacity-80'}`}
      >
        <div className="text-ink-soft mb-0.5 text-[11px] font-bold tracking-wide uppercase">
          {who}
        </div>
        <div className={`text-ink ${current ? 'text-base font-semibold' : 'text-sm'}`}>
          {children}
        </div>
        {hint && <div className="text-ink-soft mt-1 text-xs">{hint}</div>}
      </div>
    </div>
  );
}
function Alan({
  label,
  wide,
  hi,
  children,
}: {
  label: string;
  wide?: boolean;
  hi?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${wide ? 'col-span-2' : ''} ${hi ? 'settle rounded-md' : ''}`}>
      <dt className="text-ink-soft text-xs font-semibold">{label}</dt>
      <dd className="text-ink mt-0.5 text-sm">{children ?? <Bos>—</Bos>}</dd>
    </div>
  );
}
function Bos({ children }: { children: ReactNode }) {
  return <span className="text-declared">{children}</span>;
}
function Tags({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${muted ? 'bg-paper-2 text-ink-soft' : 'bg-accent-soft text-accent-strong'}`}
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
    void api<ChallengeResult[]>(`/api/needs/${needId}/challenges`)
      .then(setList)
      .catch(() => setList([]));
  }, [needId]);
  if (!list || list.length === 0) return null;
  return (
    <div className="border-line mt-6 border-t pt-4">
      <Eyebrow>Meydan okuma</Eyebrow>
      {list.map((r) => (
        <div key={r.challenge.id} className="mt-2 text-sm">
          <div className="text-ink font-semibold">{r.challenge.title}</div>
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
                  <span className="text-ink-soft tnum text-xs">#{s.rank}</span>
                  <span className="text-ink font-semibold">{s.name}</span>
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
