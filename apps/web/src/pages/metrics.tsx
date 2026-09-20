import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Skeleton } from '../components/ui';

interface Metrics {
  cardAccuracy: { approvedClaims: number; unchangedClaims: number };
  needClarity: {
    approvedNeeds: number;
    avgQuestionsToApproval: number | null;
    avgInitialMissingFields: number | null;
  };
  timeToIntroduction: { needsWithIntroduction: number; avgHours: number | null };
  topFiveConversion: { introduced: number; reachedMeeting: number };
  agentProposals: { proposed: number; approved: number; edited: number; rejected: number };
  agentRuns: { agent: string; runs: number; avg_ms: number | null }[];
}

const AGENT_LABEL: Record<string, string> = {
  card_drafter: 'Kart taslağı',
  need_structurer: 'İhtiyaç yapılandırma',
  matcher: 'Eşleştirme',
  follow_up: 'Takip sorusu',
  checkin_interpreter: 'Takip cevabı yorumu',
  challenge_designer: 'Meydan okuma tasarımı',
  submission_evaluator: 'Teslim değerlendirme',
  introducer: 'Tanıştırma taslağı',
  scout: 'Keşif',
};

const pct = (a: number, b: number) => (b === 0 ? '—' : `%${Math.round((a / b) * 100)}`);
const num = (n: number | null, digits = 1) => (n === null ? '—' : n.toFixed(digits));

/**
 * Ölçüm paneli: AI'ın katkısı sayıyla. Her kutuda payda görünür — "%100 (1/1)" ile
 * "%100 (40/40)" aynı şey değildir, panel bunu gizlemez.
 */
export function MetricsPage() {
  useTitle('Ölçüm');
  const [m, setM] = useState<Metrics | null>(null);
  useEffect(() => {
    void api<Metrics>('/api/operator/metrics').then(setM);
  }, []);
  if (!m) return <Skeleton />;

  const onerilen = m.agentProposals.approved + m.agentProposals.edited + m.agentProposals.rejected;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Ölçüm</h1>
      <p className="text-ink-soft mt-2 max-w-prose">
        Yapay zekânın katkısı, dört ürün metriği ve ajan önerilerinin akıbetiyle ölçülür. Sayaç yok;
        her sayı tablolardan türetilir.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Kart doğruluğu"
          value={pct(m.cardAccuracy.unchangedClaims, m.cardAccuracy.approvedClaims)}
          sub={`${m.cardAccuracy.unchangedClaims}/${m.cardAccuracy.approvedClaims} iddia ajanın yazdığı gibi onaylandı`}
        />
        <Tile
          label="İhtiyaç netliği"
          value={num(m.needClarity.avgQuestionsToApproval)}
          sub={`ortalama soru sayısı · ilk taslakta ${num(m.needClarity.avgInitialMissingFields)} eksik alan · ${m.needClarity.approvedNeeds} onaylı ihtiyaç`}
        />
        <Tile
          label="İhtiyaçtan tanıştırmaya"
          value={
            m.timeToIntroduction.avgHours === null
              ? '—'
              : `${num(m.timeToIntroduction.avgHours, 0)} sa`
          }
          sub={`${m.timeToIntroduction.needsWithIntroduction} ihtiyaçta ilk tanıştırma`}
        />
        <Tile
          label="İlk beşten görüşme"
          value={pct(m.topFiveConversion.reachedMeeting, m.topFiveConversion.introduced)}
          sub={`${m.topFiveConversion.reachedMeeting}/${m.topFiveConversion.introduced} tanıştırılan ilk-beş aday görüşmeye döndü`}
        />
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section className="border-line rounded-2xl border p-5">
          <h2 className="text-ink-soft text-xs font-semibold tracking-wide uppercase">
            Ajan önerilerinin akıbeti
          </h2>
          <div className="mt-3 flex items-end gap-6">
            <Big n={m.agentProposals.approved} label="onaylandı" cls="text-verified" />
            <Big n={m.agentProposals.edited} label="düzeltildi" cls="text-documented" />
            <Big n={m.agentProposals.rejected} label="reddedildi" cls="text-referenced" />
            <Big n={m.agentProposals.proposed} label="bekliyor" cls="text-declared" />
          </div>
          <p className="text-ink-soft mt-3 text-xs">
            Onay oranı {pct(m.agentProposals.approved + m.agentProposals.edited, onerilen)} (
            {m.agentProposals.approved + m.agentProposals.edited}/{onerilen})
          </p>
        </section>
        <section className="border-line rounded-2xl border p-5">
          <h2 className="text-ink-soft text-xs font-semibold tracking-wide uppercase">
            Ajan çalışmaları
          </h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {m.agentRuns.map((r) => (
                <tr key={r.agent} className="border-line border-t">
                  <td className="py-2">{AGENT_LABEL[r.agent] ?? r.agent}</td>
                  <td className="py-2 text-right tabular-nums">{r.runs} çağrı</td>
                  <td className="text-ink-soft py-2 text-right tabular-nums">
                    {r.avg_ms === null ? '—' : `${Math.round(r.avg_ms)} ms`}
                  </td>
                </tr>
              ))}
              {m.agentRuns.length === 0 && (
                <tr>
                  <td className="text-ink-soft py-2">Henüz çağrı yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border-line rounded-2xl border p-5">
      <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
      <div className="text-ink-soft mt-1 text-xs">{sub}</div>
    </div>
  );
}

function Big({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div>
      <div className={`text-2xl font-extrabold tabular-nums ${cls}`}>{n}</div>
      <div className="text-ink-soft text-xs">{label}</div>
    </div>
  );
}
