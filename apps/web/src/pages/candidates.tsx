import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Check, Minus } from 'lucide-react';
import type { MatchStrength } from '@evidex/shared';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter, Live } from '../components/motion';
import {
  Button,
  Empty,
  ErrorNote,
  Panel,
  Skeleton,
  Skills,
  type SkillRow,
  StrengthBadge,
} from '../components/ui';

interface Candidate {
  matchId: string;
  rank: number;
  strength: MatchStrength;
  name: string;
  headline: string | null;
  skills: SkillRow[];
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

/**
 * Kurumun aday listesi (KARAR-09): kısa liste GİRVAK açana kadar boş; sonra her aday bir
 * argüman — özet → uyuyor (kanıta bağlı) → eksik → tanıştırma durumu. Tanıştırmaya kadar
 * yalnız ilk ad; istek GİRVAK onayına düşer, e-posta o zaman gider.
 */
export function CandidatesPage() {
  useTitle('Adaylar');
  const { id } = useParams();
  const [need, setNeed] = useState<NeedLite | null>(null);
  const [data, setData] = useState<CandidatesResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; msg: string } | null>(null);
  const [live, setLive] = useState<string | null>(null);

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
      setLive("Tanıştırma isteği GİRVAK'a iletildi. Onaylanınca iki tarafa e-posta gider.");
    } catch (err) {
      setError({ id: matchId, msg: err instanceof Error ? err.message : 'İstek gönderilemedi' });
    } finally {
      setBusy(null);
    }
  }

  if (!need || !data) return <Skeleton rows={5} />;
  return (
    <div className="max-w-[880px]">
      <Live message={live} />
      <Enter i={0} as="header">
        <Link
          to={`/ihtiyaclar/${need.id}`}
          className="text-ink-soft inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft size={14} aria-hidden /> {need.card?.title ?? 'İhtiyaç'}
        </Link>
        <h1 className="text-ink mt-1 text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
          Adaylar
        </h1>
        {data.published && data.candidates.length > 0 && (
          <p className="text-ink-soft mt-2 max-w-[65ch]">
            Sıra ajanın gerekçesine göre; skor yok. Tanıştırmaya kadar yalnız ilk ad görünür.
            Beğendiğin adayla tanıştırılmak istediğini söyle; GİRVAK onaylayınca e-posta iki tarafa
            gider.
          </p>
        )}
      </Enter>

      <Enter i={1} as="section" className="mt-6">
        {need.cardStatus !== 'approved' && (
          <Empty title="Kart henüz onaylı değil">
            Kartı onaylayınca eşleştirme kendiliğinden koşar.
          </Empty>
        )}
        {need.cardStatus === 'approved' && !data.published && (
          <Empty title="GİRVAK kısa listeyi inceliyor">
            Ajan adayları gerekçesiyle sıraladı; GİRVAK operatörü listeyi açınca burada görürsün.
            Genellikle bir iş günü içinde.
          </Empty>
        )}
        {data.published && data.candidates.length === 0 && (
          <Empty title="Bu ihtiyaç için aday bulunamadı">
            GİRVAK ağ dışında keşif ya da bir meydan okuma başlatabilir; haber veririz.
          </Empty>
        )}
        <ol className="space-y-4">
          {data.candidates.map((c) => (
            <li key={c.matchId}>
              <Panel className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-ink-soft tnum text-sm font-semibold">#{c.rank}</span>
                  <h2 className="text-ink text-lg font-bold tracking-[-0.02em]">{c.name}</h2>
                  {c.headline && <span className="text-ink-soft">{c.headline}</span>}
                  <StrengthBadge strength={c.strength} long />
                </div>
                <p className="text-ink mt-3 max-w-[70ch] text-base leading-relaxed">
                  {c.reasoning.summaryForOrganization}
                </p>
                {c.skills.length > 0 && (
                  <div className="bg-paper-2 mt-4 rounded-[var(--radius-control)] px-4 py-3">
                    <div className="text-ink-soft text-xs font-bold tracking-wide uppercase">
                      Yetkinlikler · kanıttan ölçülmüş
                    </div>
                    <div className="mt-2">
                      <Skills skills={c.skills} />
                    </div>
                  </div>
                )}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-verified text-xs font-bold tracking-wide uppercase">
                      Uyuyor, çünkü
                    </div>
                    <ul className="mt-2 space-y-2">
                      {c.reasoning.fits.length === 0 && (
                        <li className="text-ink-soft text-sm">Kanıta bağlı bir uyum yazılmadı.</li>
                      )}
                      {c.reasoning.fits.map((f, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <Check size={16} className="text-verified mt-0.5 shrink-0" aria-hidden />
                          <span className="text-ink">
                            {f.text}
                            <span className="text-ink-soft"> · {f.claimIds.length} kanıt</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-ink-soft text-xs font-bold tracking-wide uppercase">
                      Eksik olan
                    </div>
                    <ul className="mt-2 space-y-2">
                      {c.reasoning.gaps.length === 0 && (
                        <li className="text-ink-soft text-sm">
                          Belirgin bir eksik tespit edilmedi.
                        </li>
                      )}
                      {c.reasoning.gaps.map((g, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <Minus size={16} className="text-ink-soft mt-0.5 shrink-0" aria-hidden />
                          <span className="text-ink">{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="border-line mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
                  {c.introduced ? (
                    <span className="bg-verified-soft text-verified rounded-md px-2 py-1 text-xs font-bold">
                      Tanıştırıldınız — tam kart açık
                    </span>
                  ) : c.introRequested ? (
                    <span className="bg-accent-soft text-accent-strong rounded-md px-2 py-1 text-xs font-bold">
                      GİRVAK incelemesi bekleniyor
                    </span>
                  ) : (
                    <Button
                      variant="primary"
                      pending={busy === c.matchId}
                      pendingText="İletiliyor…"
                      onClick={() => void requestIntro(c.matchId)}
                    >
                      Tanıştırılmak istiyorum
                    </Button>
                  )}
                  {!c.introduced && (
                    <span className="text-ink-soft text-xs">
                      Tam kart ve iletişim, GİRVAK tanıştırdıktan sonra açılır.
                    </span>
                  )}
                </div>
                {error?.id === c.matchId && <ErrorNote>{error.msg}</ErrorNote>}
              </Panel>
            </li>
          ))}
        </ol>
      </Enter>
    </div>
  );
}
