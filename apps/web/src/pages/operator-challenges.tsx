import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { NeedPicker } from '../components/need-picker';

interface Challenge {
  id: string;
  needId: string | null;
  title: string;
  brief: string;
  rubric: { name: string; weight: number; description: string }[];
  durationHours: number;
  status: 'draft' | 'open' | 'closed' | 'evaluated';
  opensAt: string | null;
  closesAt: string | null;
}
interface Submission {
  submissionId: string;
  rank: number | null;
  name: string;
  headline: string | null;
  repoUrl: string;
  evaluation: {
    band: 'strong' | 'solid' | 'partial' | 'incomplete';
    score: number;
    summary: string;
    strengths: string[];
    gaps: string[];
    scores: { name: string; score: number; comment: string }[];
  } | null;
}

const STATUS: Record<Challenge['status'], string> = {
  draft: 'Taslak',
  open: 'Açık',
  closed: 'Kapalı',
  evaluated: 'Değerlendirildi',
};
const BAND: Record<NonNullable<Submission['evaluation']>['band'], { label: string; cls: string }> =
  {
    strong: { label: 'Güçlü', cls: 'bg-[var(--color-verified)] text-white' },
    solid: { label: 'Sağlam', cls: 'bg-[var(--color-documented)] text-white' },
    partial: { label: 'Kısmi', cls: 'bg-[var(--color-referenced)] text-white' },
    incomplete: { label: 'Eksik', cls: 'bg-[var(--color-declared)] text-white' },
  };

/**
 * Operatörün meydan okuma ekranı (keşfet 01): ihtiyaçtan görev tasarla → aç → kapat →
 * değerlendir → sıralama. Açmak/kapatmak/değerlendirmek insan eylemi; ajan taslak ve puan üretir.
 */
export function OperatorChallengesPage() {
  useTitle('Meydan okumalar');
  const [list, setList] = useState<Challenge[] | null>(null);
  const [needId, setNeedId] = useState('');
  const [selected, setSelected] = useState<{
    challenge: Challenge;
    submissions: Submission[];
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setList(await api<Challenge[]>('/api/operator/challenges'));
  }
  useEffect(() => {
    void load();
  }, []);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
      if (selected) setSelected(await api(`/api/operator/challenges/${selected.challenge.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(null);
    }
  }

  async function design(e: FormEvent) {
    e.preventDefault();
    await run('design', () =>
      api(`/api/operator/challenges/from-need/${needId.trim()}`, { method: 'POST' }),
    );
    setNeedId('');
  }

  async function openDetail(id: string) {
    setSelected(await api(`/api/operator/challenges/${id}`));
  }

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1.3fr]">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Meydan okumalar</h1>
        <p className="text-ink-soft mt-2 text-sm">
          Kanıtı olmayan genç, gerçek bir ihtiyaçtan türetilmiş 24–48 saatlik görevle kanıt kazanır.
        </p>
        <form onSubmit={(e) => void design(e)} className="mt-4 flex gap-2">
          <div className="flex-1">
            <NeedPicker value={needId} onChange={(id) => setNeedId(id)} />
          </div>
          <button
            disabled={busy === 'design' || !needId.trim()}
            className="bg-accent text-paper rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy === 'design' ? 'Tasarlanıyor…' : 'İhtiyaçtan tasarla'}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <ul className="mt-5 divide-y divide-[var(--color-line)]">
          {list?.length === 0 && (
            <li className="text-ink-soft py-4 text-sm">Henüz meydan okuma yok.</li>
          )}
          {list?.map((c) => (
            <li key={c.id} className="py-3">
              <button
                onClick={() => void openDetail(c.id)}
                className="text-left font-semibold hover:underline"
              >
                {c.title}
              </button>
              <div className="text-ink-soft mt-0.5 text-xs">
                {STATUS[c.status]} · {c.durationHours} saat
                {c.closesAt &&
                  c.status === 'open' &&
                  ` · kapanış ${new Date(c.closesAt).toLocaleString('tr-TR')}`}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-line h-fit rounded-2xl border p-6">
        {!selected && <p className="text-ink-soft text-sm">Bir meydan okuma seç.</p>}
        {selected && (
          <>
            <div className="text-ink-soft flex items-center justify-between text-xs font-semibold tracking-wide uppercase">
              <span>{STATUS[selected.challenge.status]}</span>
              <span>{selected.challenge.durationHours} saat</span>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight">{selected.challenge.title}</h2>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
              {selected.challenge.brief}
            </p>
            <div className="text-ink-soft mt-4 text-xs font-semibold tracking-wide uppercase">
              Rubrik
            </div>
            <ul className="mt-1 space-y-1 text-sm">
              {selected.challenge.rubric.map((r) => (
                <li key={r.name}>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-ink-soft">
                    {' '}
                    · ağırlık {r.weight} · {r.description}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-2">
              {selected.challenge.status === 'draft' && (
                <button
                  disabled={busy === 'open'}
                  onClick={() =>
                    void run('open', () =>
                      api(`/api/operator/challenges/${selected.challenge.id}/open`, {
                        method: 'POST',
                      }),
                    )
                  }
                  className="bg-accent text-paper rounded-lg px-3 py-1.5 text-sm font-semibold"
                >
                  Aç
                </button>
              )}
              {selected.challenge.status === 'open' && (
                <button
                  disabled={busy === 'close'}
                  onClick={() =>
                    void run('close', () =>
                      api(`/api/operator/challenges/${selected.challenge.id}/close`, {
                        method: 'POST',
                      }),
                    )
                  }
                  className="bg-ink text-paper rounded-lg px-3 py-1.5 text-sm font-semibold"
                >
                  Kapat
                </button>
              )}
              {selected.challenge.status === 'closed' && (
                <button
                  disabled={busy === 'eval'}
                  onClick={() =>
                    void run('eval', () =>
                      api(`/api/operator/challenges/${selected.challenge.id}/evaluate`, {
                        method: 'POST',
                      }),
                    )
                  }
                  className="bg-accent text-paper rounded-lg px-3 py-1.5 text-sm font-semibold"
                >
                  {busy === 'eval' ? 'Değerlendiriliyor…' : 'Değerlendir'}
                </button>
              )}
            </div>

            <div className="text-ink-soft mt-6 text-xs font-semibold tracking-wide uppercase">
              Teslimler · {selected.submissions.length}
            </div>
            <ul className="mt-2 space-y-3">
              {selected.submissions.map((s) => (
                <li key={s.submissionId} className="border-line rounded-xl border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    {s.rank && <span className="text-ink-soft font-mono text-xs">#{s.rank}</span>}
                    <span className="font-semibold">{s.name}</span>
                    {s.evaluation && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${BAND[s.evaluation.band].cls}`}
                      >
                        {BAND[s.evaluation.band].label}
                      </span>
                    )}
                    <a
                      href={s.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent ml-auto text-xs hover:underline"
                    >
                      repo ↗
                    </a>
                  </div>
                  {s.evaluation && (
                    <div className="mt-2">
                      <p>{s.evaluation.summary}</p>
                      <ul className="text-ink-soft mt-1 text-xs">
                        {s.evaluation.scores.map((sc) => (
                          <li key={sc.name}>
                            {sc.name}: {sc.score}/5 — {sc.comment}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
