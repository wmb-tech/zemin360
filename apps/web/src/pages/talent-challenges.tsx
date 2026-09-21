import { useEffect, useState, type FormEvent } from 'react';
import { Clock, Send } from 'lucide-react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter, Live } from '../components/motion';
import { Button, Empty, ErrorNote, Input, Metin, Panel, Skeleton } from '../components/ui';

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
 * Meydan okumalar (keşfet 01): açık görevler ve teslim. Kanıtı olmayan genç buradan kanıt
 * kazanır; yapay zekâ araçları serbest, ölçülen şey teslimat. Teslim yalnız sunucu onayından
 * sonra "teslim edildi" olur; hata olursa girilen adres korunur.
 */
export function TalentChallengesPage() {
  useTitle('Meydan okumalar');
  const [list, setList] = useState<OpenChallenge[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);

  async function load() {
    setList(await api<OpenChallenge[]>('/api/me/challenges'));
  }
  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Yüklenemedi'));
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
      setLive('Teslim alındı. Değerlendirme kapanışta yapılır; sonucu kartında görürsün.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Teslim edilemedi');
    } finally {
      setBusy(false);
    }
  }

  if (!list && !error) return <Skeleton rows={4} />;
  return (
    <div className="max-w-[880px]">
      <Live message={live} />
      <Enter i={0} as="header">
        <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
          Meydan okumalar
        </h1>
        <p className="text-ink-soft mt-2 max-w-[65ch]">
          Gerçek kurum ihtiyaçlarından türetilmiş 24–48 saatlik görevler. Teslim ettiğin iş,
          değerlendirmesiyle birlikte kartına doğrulanmış kanıt olarak girer. Yapay zekâ araçları
          serbest; ölçülen şey çalışan teslimat.
        </p>
      </Enter>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Enter i={1} as="section" className="mt-6">
        {list?.length === 0 && (
          <Empty title="Şu an açık meydan okuma yok">
            GİRVAK bir ihtiyaçtan görev türetince burada görünür; e-postayla da haber veririz.
          </Empty>
        )}
        <ul className="space-y-4">
          {list?.map((c) => {
            const acik = open === c.id || Boolean(c.mySubmission);
            return (
              <li key={c.id}>
                <Panel className="p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-ink text-lg font-bold tracking-[-0.02em]">{c.title}</h2>
                      <div className="text-ink-soft tnum mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={14} aria-hidden /> {c.durationHours} saat
                        </span>
                        {c.closesAt && (
                          <span>son teslim {new Date(c.closesAt).toLocaleString('tr-TR')}</span>
                        )}
                      </div>
                    </div>
                    {c.mySubmission ? (
                      <span className="bg-verified-soft text-verified rounded-md px-2 py-1 text-xs font-bold">
                        Teslim edildi
                      </span>
                    ) : (
                      <Button
                        variant={acik ? 'secondary' : 'primary'}
                        onClick={() => setOpen(acik ? null : c.id)}
                      >
                        {acik ? 'Kapat' : 'Görevi aç'}
                      </Button>
                    )}
                  </div>
                  <div className="disclose" data-open={acik}>
                    <div>
                      <Metin
                        text={c.brief}
                        className="text-ink mt-4 max-w-[70ch] text-base leading-relaxed"
                      />
                      <h3 className="text-ink-soft mt-5 text-xs font-bold tracking-wide uppercase">
                        Nasıl değerlendirilecek
                      </h3>
                      <ul className="mt-2 space-y-1 text-sm">
                        {c.rubric.map((r) => (
                          <li key={r.name}>
                            <span className="text-ink font-semibold">{r.name}</span>
                            <span className="text-ink-soft"> — {r.description}</span>
                          </li>
                        ))}
                      </ul>
                      {c.mySubmission ? (
                        <p className="text-ink-soft mt-4 text-sm">
                          Teslimin: <span className="font-mono">{c.mySubmission.repoUrl}</span> ·{' '}
                          {new Date(c.mySubmission.submittedAt).toLocaleString('tr-TR')}. Sonuç,
                          görev kapanınca kartına düşer.
                        </p>
                      ) : (
                        <form
                          onSubmit={(e) => void submit(e, c.id)}
                          className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"
                        >
                          <div className="grid gap-3">
                            <Input
                              type="url"
                              required
                              value={repoUrl}
                              onChange={(e) => setRepoUrl(e.target.value)}
                              placeholder="https://github.com/kullanici/repo"
                              aria-label="Teslim reposu"
                            />
                            <Input
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="Kısa not — nasıl çalıştırılır, ne eksik (isteğe bağlı)"
                              aria-label="Not"
                            />
                          </div>
                          <Button
                            type="submit"
                            variant="primary"
                            pending={busy}
                            pendingText="Gönderiliyor…"
                            className="sm:self-start"
                          >
                            <Send size={16} aria-hidden /> Teslim et
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      </Enter>
    </div>
  );
}
