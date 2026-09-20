import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';

interface OpenChallenge {
  id: string;
  title: string;
  brief: string;
  rubric: { name: string; weight: number; description: string }[];
  durationHours: number;
  closesAt: string | null;
  mySubmission: { repoUrl: string; note: string | null; submittedAt: string } | null;
}

/**
 * Gencin "Davetler" ekranı: açık meydan okumalar ve teslim. Kanıtı olmayan genç buradan
 * kanıt kazanır; yapay zekâ araçları serbest, ölçülen şey teslimat.
 */
export function TalentChallengesPage() {
  useTitle('Meydan okumalar');
  const [list, setList] = useState<OpenChallenge[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setList(await api<OpenChallenge[]>('/api/me/challenges'));
  }
  useEffect(() => {
    void load();
  }, []);

  async function submit(e: FormEvent, id: string) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/me/challenges/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ repoUrl, note: note || null }),
      });
      setRepoUrl('');
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Meydan okumalar</h1>
      <p className="text-ink-soft mt-2 max-w-prose text-sm">
        Gerçek kurum ihtiyaçlarından türetilmiş 24–48 saatlik görevler. Teslim ettiğin her iş,
        değerlendirmesiyle birlikte kartına doğrulanmış kanıt olarak girer. Yapay zekâ araçları
        serbest; ölçülen şey çalışan teslimat.
      </p>
      <ul className="mt-6 space-y-4">
        {list?.length === 0 && (
          <li className="border-line text-ink-soft rounded-xl border border-dashed p-6 text-sm">
            Şu an açık meydan okuma yok.
          </li>
        )}
        {list?.map((c) => (
          <li key={c.id} className="border-line rounded-2xl border p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{c.title}</h2>
                <div className="text-ink-soft mt-0.5 text-xs">
                  {c.durationHours} saat
                  {c.closesAt && ` · son teslim ${new Date(c.closesAt).toLocaleString('tr-TR')}`}
                </div>
              </div>
              {c.mySubmission ? (
                <span className="text-verified text-xs font-semibold">Teslim edildi</span>
              ) : (
                <button
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                  className="bg-ink text-paper rounded-lg px-3 py-1.5 text-sm font-semibold"
                >
                  {open === c.id ? 'Kapat' : 'Katıl'}
                </button>
              )}
            </div>
            {(open === c.id || c.mySubmission) && (
              <div className="mt-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.brief}</p>
                <div className="text-ink-soft mt-3 text-xs font-semibold tracking-wide uppercase">
                  Nasıl değerlendirilecek
                </div>
                <ul className="mt-1 text-sm">
                  {c.rubric.map((r) => (
                    <li key={r.name}>
                      <span className="font-semibold">{r.name}</span>{' '}
                      <span className="text-ink-soft">— {r.description}</span>
                    </li>
                  ))}
                </ul>
                {c.mySubmission ? (
                  <p className="text-ink-soft mt-3 text-xs">
                    Teslimin: <span className="font-mono">{c.mySubmission.repoUrl}</span> ·{' '}
                    {new Date(c.mySubmission.submittedAt).toLocaleString('tr-TR')}
                  </p>
                ) : (
                  <form onSubmit={(e) => void submit(e, c.id)} className="mt-4 space-y-2">
                    <input
                      type="url"
                      required
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/kullanici/repo"
                      className="border-line focus:border-accent w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    />
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Kısa not (nasıl çalıştırılır, ne eksik) — isteğe bağlı"
                      className="border-line focus:border-accent w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    />
                    <button
                      disabled={busy}
                      className="bg-accent text-paper rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Teslim et
                    </button>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                  </form>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
