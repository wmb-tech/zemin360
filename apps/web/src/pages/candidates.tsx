import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { MatchStrength } from '@evidex/shared';
import { api } from '../lib/api';

interface Candidate {
  matchId: string;
  rank: number;
  strength: MatchStrength;
  name: string;
  headline: string | null;
  introduced: boolean;
  introRequested: boolean;
  reasoning: {
    fits: { text: string; claimIds: string[] }[];
    gaps: string[];
    summaryForOrganization: string;
  };
}
interface CandidatesResponse {
  published: boolean;
  candidates: Candidate[];
}
interface NeedLite {
  id: string;
  card: { title?: string } | null;
  cardStatus: 'draft' | 'approved';
}

const STRENGTH: Record<MatchStrength, { label: string; cls: string }> = {
  strong: { label: 'Güçlü', cls: 'bg-[var(--color-verified)] text-white' },
  possible: { label: 'Olası', cls: 'bg-[var(--color-documented)] text-white' },
  weak: { label: 'Zayıf', cls: 'bg-[var(--color-declared)] text-white' },
};

/** Kurumun aday listesi (KARAR-09): operatör açana kadar boş; sonra gerekçe + özet. */
export function CandidatesPage() {
  const { id } = useParams();
  const [need, setNeed] = useState<NeedLite | null>(null);
  const [data, setData] = useState<CandidatesResponse | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    void api<NeedLite>(`/api/needs/${id}`).then(setNeed);
    void api<CandidatesResponse>(`/api/needs/${id}/candidates`).then(setData);
  }, [id]);

  async function requestIntro(matchId: string) {
    setBusy(matchId);
    setError(null);
    try {
      await api(`/api/needs/${id}/candidates/${matchId}/introduce`, { method: 'POST' });
      setData(await api<CandidatesResponse>(`/api/needs/${id}/candidates`));
    } catch (err) {
      setError(matchId);
      setErrorMsg(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(null);
    }
  }

  if (!need || !data) return null;

  return (
    <div>
      <Link to={`/ihtiyaclar/${need.id}`} className="text-ink-soft text-sm hover:underline">
        ← {need.card?.title ?? 'İhtiyaç'}
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Adaylar</h1>

      {need.cardStatus !== 'approved' && (
        <p className="text-ink-soft mt-3 text-sm">Kart onaylanınca eşleştirme başlar.</p>
      )}
      {need.cardStatus === 'approved' && !data.published && (
        <p className="text-ink-soft mt-3 max-w-prose text-sm">
          Eşleştirme yapıldı; liste GİRVAK'ın onayını bekliyor. Onaylanınca burada görünür.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {data.candidates.map((c) => (
          <li key={c.matchId} className="border-line rounded-2xl border p-5">
            <div className="flex items-center gap-3">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STRENGTH[c.strength].cls}`}
              >
                {STRENGTH[c.strength].label}
              </span>
              <span className="font-semibold">{c.name}</span>
              {c.headline && <span className="text-ink-soft text-sm">· {c.headline}</span>}
              {c.introduced && (
                <span className="text-verified ml-auto text-xs font-semibold">Tanıştırıldı</span>
              )}
            </div>
            <p className="mt-3 text-sm">{c.reasoning.summaryForOrganization}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-verified text-xs font-semibold tracking-wide uppercase">
                  Uyuyor, çünkü
                </div>
                <ul className="mt-1 space-y-1 text-sm">
                  {c.reasoning.fits.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-verified">•</span>
                      <span>
                        {f.text}
                        {f.claimIds.length > 0 && (
                          <span className="text-ink-soft ml-1 text-xs">
                            ({f.claimIds.length} kanıt)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-referenced text-xs font-semibold tracking-wide uppercase">
                  Eksik olan
                </div>
                <ul className="mt-1 space-y-1 text-sm">
                  {c.reasoning.gaps.length === 0 && <li className="text-ink-soft">—</li>}
                  {c.reasoning.gaps.map((g, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-referenced">•</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {!c.introduced && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {c.introRequested ? (
                  <span className="text-accent text-xs font-semibold">
                    Tanıştırma isteği GİRVAK'ta; onaylanınca e-posta iki tarafa gider.
                  </span>
                ) : (
                  <button
                    disabled={busy === c.matchId}
                    onClick={() => void requestIntro(c.matchId)}
                    className="bg-accent text-paper rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {busy === c.matchId ? 'Hazırlanıyor…' : 'Tanıştırılmak istiyorum'}
                  </button>
                )}
                <span className="text-ink-soft text-xs">
                  Tam kart ve iletişim, GİRVAK tanıştırdıktan sonra açılır.
                </span>
              </div>
            )}
            {error === c.matchId && <p className="mt-2 text-sm text-red-600">{errorMsg}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
