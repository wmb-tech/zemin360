import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { NeedPicker } from '../components/need-picker';
import { Enter, Live } from '../components/motion';
import { Button, Empty, ErrorNote, Eyebrow, Metin, Panel, Skeleton } from '../components/ui';

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
    strong: { label: 'Güçlü', cls: 'bg-verified-soft text-verified' },
    solid: { label: 'Sağlam', cls: 'bg-documented-soft text-documented' },
    partial: { label: 'Kısmi', cls: 'bg-referenced-soft text-referenced' },
    incomplete: { label: 'Eksik', cls: 'bg-declared-soft text-declared' },
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

  if (!list) return <Skeleton rows={5} />;
  return (
    <div>
      <Live
        message={
          error
            ? null
            : busy
              ? null
              : selected
                ? `${selected.challenge.title} · ${STATUS[selected.challenge.status]}`
                : null
        }
      />
      <Enter i={0} as="header">
        <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
          Meydan okumalar
        </h1>
        <p className="text-ink-soft mt-1 max-w-[65ch]">
          Kanıtı olmayan genç, gerçek bir ihtiyaçtan türetilmiş 24–48 saatlik görevle kanıt kazanır.
          Ajan görev ve rubrik taslağı yazar, puanlar; açmak, kapatmak ve değerlendirmek senin.
        </p>
      </Enter>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(320px,40fr)_60fr]">
        <Enter i={1} as="section">
          <Panel className="p-4">
            <Eyebrow>İhtiyaçtan tasarla</Eyebrow>
            <form onSubmit={(e) => void design(e)} className="mt-2 flex gap-2">
              <div className="flex-1">
                <NeedPicker value={needId} onChange={(id) => setNeedId(id)} />
              </div>
              <Button
                type="submit"
                variant="primary"
                pending={busy === 'design'}
                pendingText="Tasarlanıyor…"
                disabled={!needId.trim()}
              >
                Tasarla
              </Button>
            </form>
            {error && <ErrorNote>{error}</ErrorNote>}
          </Panel>
          <ul className="bg-surface border-line mt-4 divide-y divide-[var(--color-line)] rounded-[var(--radius-panel)] border">
            {list.length === 0 && (
              <li className="p-4">
                <Empty title="Henüz meydan okuma yok">
                  Onaylı bir ihtiyaç seçip tasarla; taslak burada birikir.
                </Empty>
              </li>
            )}
            {list.map((c) => {
              const on = selected?.challenge.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => void openDetail(c.id)}
                    className={`pressable w-full px-4 py-3 text-left ${on ? 'bg-accent-soft' : 'hover:bg-paper-2'}`}
                  >
                    <div className="text-ink text-sm font-semibold">{c.title}</div>
                    <div className="text-ink-soft tnum mt-0.5 text-xs">
                      {STATUS[c.status]} · {c.durationHours} saat
                      {c.closesAt &&
                        c.status === 'open' &&
                        ` · kapanış ${new Date(c.closesAt).toLocaleString('tr-TR')}`}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Enter>

        <section>
          {!selected ? (
            <p className="text-ink-soft text-sm">Bir meydan okuma seç.</p>
          ) : (
            <Panel key={selected.challenge.id} className="pane-enter p-6">
              <div className="flex items-center justify-between">
                <Eyebrow>{STATUS[selected.challenge.status]}</Eyebrow>
                <span className="text-ink-soft tnum text-xs">
                  {selected.challenge.durationHours} saat
                </span>
              </div>
              <h2 className="text-ink mt-2 text-xl font-bold tracking-[-0.02em]">
                {selected.challenge.title}
              </h2>
              <Metin
                text={selected.challenge.brief}
                className="text-ink mt-3 max-w-[70ch] text-sm leading-relaxed"
              />
              <div className="mt-4">
                <Eyebrow>Rubrik</Eyebrow>
              </div>
              <ul className="mt-1 space-y-1 text-sm">
                {selected.challenge.rubric.map((r) => (
                  <li key={r.name}>
                    <span className="text-ink font-semibold">{r.name}</span>
                    <span className="text-ink-soft">
                      {' '}
                      · ağırlık {r.weight} · {r.description}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-line mt-5 flex gap-2 border-t pt-4">
                {selected.challenge.status === 'draft' && (
                  <Button
                    variant="primary"
                    pending={busy === 'open'}
                    pendingText="Açılıyor…"
                    onClick={() =>
                      void run('open', () =>
                        api(`/api/operator/challenges/${selected.challenge.id}/open`, {
                          method: 'POST',
                        }),
                      )
                    }
                  >
                    Aç
                  </Button>
                )}
                {selected.challenge.status === 'open' && (
                  <Button
                    pending={busy === 'close'}
                    pendingText="Kapatılıyor…"
                    onClick={() =>
                      void run('close', () =>
                        api(`/api/operator/challenges/${selected.challenge.id}/close`, {
                          method: 'POST',
                        }),
                      )
                    }
                  >
                    Kapat
                  </Button>
                )}
                {selected.challenge.status === 'closed' && (
                  <Button
                    variant="primary"
                    pending={busy === 'eval'}
                    pendingText="Değerlendiriliyor…"
                    onClick={() =>
                      void run('eval', () =>
                        api(`/api/operator/challenges/${selected.challenge.id}/evaluate`, {
                          method: 'POST',
                        }),
                      )
                    }
                  >
                    Değerlendir
                  </Button>
                )}
              </div>
              <div className="mt-6">
                <Eyebrow>Teslimler · {selected.submissions.length}</Eyebrow>
              </div>
              <ul className="mt-2 space-y-3">
                {selected.submissions.length === 0 && (
                  <li className="text-ink-soft text-sm">Henüz teslim yok.</li>
                )}
                {selected.submissions.map((s) => (
                  <li
                    key={s.submissionId}
                    className="border-line rounded-[var(--radius-control)] border p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {s.rank && <span className="text-ink-soft tnum text-xs">#{s.rank}</span>}
                      <span className="text-ink font-semibold">{s.name}</span>
                      {s.evaluation && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${BAND[s.evaluation.band].cls}`}
                        >
                          {BAND[s.evaluation.band].label}
                        </span>
                      )}
                      <a
                        href={s.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent ml-auto text-xs font-semibold hover:underline"
                      >
                        repo ↗
                      </a>
                    </div>
                    {s.evaluation && (
                      <div className="mt-2">
                        <p className="text-ink">{s.evaluation.summary}</p>
                        <ul className="text-ink-soft tnum mt-1 text-xs">
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
            </Panel>
          )}
        </section>
      </div>
    </div>
  );
}
