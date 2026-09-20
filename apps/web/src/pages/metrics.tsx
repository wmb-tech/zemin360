import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter } from '../components/motion';
import { ErrorNote, Eyebrow, Panel, Skeleton } from '../components/ui';

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
  introducer: 'Tanıştırma taslağı',
  follow_up: 'Takip sorusu',
  checkin_interpreter: 'Takip cevabı yorumu',
  challenge_designer: 'Meydan okuma tasarımı',
  submission_evaluator: 'Teslim değerlendirme',
  scout: 'Keşif',
};

/** Payda ve örneklem her zaman görünür; 0/0 = "yeterli veri yok", %0 değil. */
function oran(pay: number, payda: number) {
  if (payda === 0) return { deger: 'Yeterli veri yok', alt: '0/0', kucuk: true };
  return { deger: `%${Math.round((pay / payda) * 100)}`, alt: `${pay}/${payda}`, kucuk: payda < 5 };
}

/** Tam sayıysa ondalık gösterme ("0.0 soru" değil "0 soru"). */
const sayi = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function MetricsPage() {
  useTitle('Ölçüm');
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api<Metrics>('/api/operator/metrics')
      .then(setM)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Yüklenemedi'));
  }, []);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!m) return <Skeleton rows={5} />;

  const karar = m.agentProposals.approved + m.agentProposals.edited + m.agentProposals.rejected;
  const kart = oran(m.cardAccuracy.unchangedClaims, m.cardAccuracy.approvedClaims);
  const donus = oran(m.topFiveConversion.reachedMeeting, m.topFiveConversion.introduced);
  const onay = oran(m.agentProposals.approved + m.agentProposals.edited, karar);

  return (
    <div>
      <Enter i={0} as="header">
        <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
          Ölçüm
        </h1>
        <p className="text-ink-soft mt-1 max-w-[65ch]">
          Yapay zekânın katkısı dört ürün metriği ve önerilerin akıbetiyle ölçülür. Sayaç yok; her
          sayı tablolardan türetilir ve paydasıyla gösterilir.
        </p>
      </Enter>

      <Enter i={1} as="section" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Olcum
          label="Kart doğruluğu"
          deger={kart.deger}
          payda={`${kart.alt} iddia ajanın yazdığı gibi onaylandı`}
          kucuk={kart.kucuk}
        />
        <Olcum
          label="İhtiyaç netliği"
          deger={
            m.needClarity.avgQuestionsToApproval === null
              ? 'Yeterli veri yok'
              : `${sayi(m.needClarity.avgQuestionsToApproval)} soru`
          }
          payda={`${m.needClarity.approvedNeeds} onaylı ihtiyaç · ilk taslakta ortalama ${m.needClarity.avgInitialMissingFields === null ? '—' : sayi(m.needClarity.avgInitialMissingFields)} eksik alan`}
          kucuk={m.needClarity.approvedNeeds < 5}
        />
        <Olcum
          label="İhtiyaçtan tanıştırmaya"
          deger={
            m.timeToIntroduction.avgHours === null
              ? 'Yeterli veri yok'
              : `${Math.round(m.timeToIntroduction.avgHours)} saat`
          }
          payda={`${m.timeToIntroduction.needsWithIntroduction} ihtiyaçta ilk tanıştırma`}
          kucuk={m.timeToIntroduction.needsWithIntroduction < 5}
        />
        <Olcum
          label="İlk beşten görüşme"
          deger={donus.deger}
          payda={`${donus.alt} tanıştırılan ilk-beş aday görüşmeye döndü`}
          kucuk={donus.kucuk}
        />
      </Enter>

      <Enter i={2} as="section" className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <Eyebrow>Ajan önerilerinin akıbeti</Eyebrow>
          <div className="mt-3 grid grid-cols-4 gap-3">
            <Sayi n={m.agentProposals.approved} label="onaylandı" cls="text-verified" />
            <Sayi n={m.agentProposals.edited} label="düzeltildi" cls="text-documented" />
            <Sayi n={m.agentProposals.rejected} label="reddedildi" cls="text-negative" />
            <Sayi n={m.agentProposals.proposed} label="bekliyor" cls="text-declared" />
          </div>
          <p className="text-ink-soft tnum mt-3 text-sm">
            Onay oranı <b className="text-ink">{onay.deger}</b> ({onay.alt})
            {onay.kucuk && ' · küçük örneklem'}
          </p>
        </Panel>
        <Panel className="p-5">
          <Eyebrow>Ajan çalışmaları</Eyebrow>
          <p className="text-ink-soft mt-1 text-xs">Operasyonel telemetri; sonuç metriği değil.</p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {m.agentRuns.map((r) => (
                <tr key={r.agent} className="border-line border-t">
                  <td className="text-ink py-2">{AGENT_LABEL[r.agent] ?? r.agent}</td>
                  <td className="tnum py-2 text-right">{r.runs} çağrı</td>
                  <td className="text-ink-soft tnum py-2 text-right">
                    {r.avg_ms === null ? '—' : `${(r.avg_ms / 1000).toFixed(1)} sn`}
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
        </Panel>
      </Enter>
    </div>
  );
}

function Olcum({
  label,
  deger,
  payda,
  kucuk,
}: {
  label: string;
  deger: string;
  payda: string;
  kucuk: boolean;
}) {
  return (
    <Panel className="p-5">
      <Eyebrow>{label}</Eyebrow>
      <div
        className={`tnum mt-2 font-extrabold tracking-[-0.02em] ${deger.startsWith('Yeterli') ? 'text-ink-soft text-lg' : 'text-ink text-[28px]'}`}
      >
        {deger}
      </div>
      <div className="text-ink-soft tnum mt-1 text-sm">{payda}</div>
      {kucuk && !deger.startsWith('Yeterli') && (
        <div className="text-declared mt-1 text-xs">Küçük örneklem; eğilim değil sayım.</div>
      )}
    </Panel>
  );
}
function Sayi({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div>
      <div className={`tnum text-2xl font-extrabold ${cls}`}>{n}</div>
      <div className="text-ink-soft text-xs">{label}</div>
    </div>
  );
}
