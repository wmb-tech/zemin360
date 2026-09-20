import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { THRESHOLDS, type CollaborationStatus, type MatchStrength } from '@evidex/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTitle } from '../lib/title';
import { Skeleton } from '../components/skeleton';

interface Overview {
  card: {
    status: 'draft' | 'approved';
    silent: boolean;
    sources: number;
    claims: number;
    approvedClaims: number;
    publicSlug: string | null;
    lastSignalAt: string | null;
  };
  matches: {
    matchId: string;
    strength: MatchStrength;
    needTitle: string | null;
    collaborationType: string | null;
    organization: string | null;
    city: string | null;
    introduced: boolean;
    collaborationStatus: CollaborationStatus | null;
  }[];
  openChallenges: number;
}

const STRENGTH: Record<MatchStrength, { label: string; cls: string }> = {
  strong: { label: 'Güçlü eşleşme', cls: 'bg-verified text-white' },
  possible: { label: 'Olası eşleşme', cls: 'bg-documented text-white' },
  weak: { label: 'Zayıf eşleşme', cls: 'bg-declared text-white' },
};
const COLLAB: Record<CollaborationStatus, string> = {
  introduced: 'Tanıştırıldınız',
  meeting: 'Görüşme yapıldı',
  started: 'İş birliği başladı',
  ongoing: 'Sürüyor',
  completed: 'Tamamlandı',
  did_not_happen: 'Gerçekleşmedi',
};
const TYPE: Record<string, string> = {
  internship: 'staj',
  project: 'proje',
  part_time: 'yarı zamanlı',
  full_time: 'tam zamanlı',
  pilot_customer: 'pilot müşteri',
  co_founder: 'kurucu ortak',
  mentor: 'mentorluk',
};

/**
 * Gencin ana sayfası: "kartım ne durumda, sırada ne var, kim benimle eşleşti". Kart onayı
 * sonrası boşluğu kapatır. Kurum adı tanıştırmaya kadar gizli (KARAR-09'un simetriği).
 */
export function TalentHomePage() {
  useTitle('Durum');
  const { me } = useAuth();
  const [params] = useSearchParams();
  const [o, setO] = useState<Overview | null>(null);
  useEffect(() => {
    void api<Overview>('/api/me/overview').then(setO);
  }, []);
  if (!o) return <Skeleton />;

  const ilkAd = me?.name.split(' ')[0] ?? '';
  // Sıradaki adım: tek, net.
  const adim =
    o.card.sources === 0
      ? { text: 'GitHub hesabını bağla; ajan kartını yazsın.', to: '/kart', cta: 'Kanıt bağla' }
      : o.card.approvedClaims === 0
        ? { text: 'Taslak iddiaları gözden geçir ve onayla.', to: '/kart', cta: 'Kartıma git' }
        : o.card.status !== 'approved'
          ? { text: 'Kartını onayla; ağa o zaman girersin.', to: '/kart', cta: 'Kartı onayla' }
          : o.card.silent
            ? {
                text: `Kartın ${THRESHOLDS.silentCardAfterDays} gündür sessiz. Yeni kaynak bağla ya da bir meydan okumaya katıl.`,
                to: '/davetler',
                cta: 'Meydan okumalar',
              }
            : o.openChallenges > 0
              ? {
                  text: `${o.openChallenges} açık meydan okuma var; teslimin karta doğrulanmış kanıt olarak girer.`,
                  to: '/davetler',
                  cta: 'Bak',
                }
              : {
                  text: 'Kartın ağda. Kurumlar ihtiyaç açtıkça ajan eşleştirir; güçlü eşleşmede e-posta alırsın.',
                  to: '/kart',
                  cta: 'Kartımı gör',
                };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Merhaba {ilkAd}</h1>
      {params.get('onay') && (
        <p className="border-verified text-verified mt-3 rounded-lg border px-3 py-2 text-sm">
          Kartın ağda. Bundan sonra kurumlar ihtiyaç açtıkça ajan seni gerekçesiyle değerlendirir;
          güçlü eşleşmede e-posta alırsın, tanıştırma GİRVAK onayıyla olur.
        </p>
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Kutu label="Kart">
          <div className="text-xl font-bold">
            {o.card.status === 'approved' ? 'Ağda' : 'Taslak'}
            {o.card.silent && (
              <span className="text-declared ml-2 text-sm font-semibold">sessiz</span>
            )}
          </div>
          <div className="text-ink-soft mt-1 text-sm">
            {o.card.sources} kaynak · {o.card.approvedClaims}/{o.card.claims} iddia onaylı
          </div>
        </Kutu>
        <Kutu label="Eşleşmeler">
          <div className="text-xl font-bold">{o.matches.length}</div>
          <div className="text-ink-soft mt-1 text-sm">
            {o.matches.filter((m) => m.introduced).length} tanıştırma
          </div>
        </Kutu>
        <Kutu label="Sıradaki adım">
          <p className="text-sm">{adim.text}</p>
          <Link
            to={adim.to}
            className="bg-accent text-paper mt-3 inline-block rounded-lg px-3 py-1.5 text-sm font-semibold"
          >
            {adim.cta}
          </Link>
        </Kutu>
      </div>

      <h2 className="text-ink-soft mt-10 text-xs font-semibold tracking-wide uppercase">
        Eşleşmeler ve iş birlikleri
      </h2>
      {o.matches.length === 0 ? (
        <p className="text-ink-soft mt-2 max-w-prose text-sm">
          Henüz eşleşme yok. Bir kurum ihtiyaç açıp GİRVAK kısa listeyi onaylayınca burada görünür;
          kurum seni ilk adın ve gerekçeyle görür, tanıştırma olursa iki tarafa e-posta gider.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {o.matches.map((m) => (
            <li key={m.matchId} className="border-line rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STRENGTH[m.strength].cls}`}
                >
                  {STRENGTH[m.strength].label}
                </span>
                <span className="font-semibold">{m.needTitle ?? 'İhtiyaç'}</span>
                {m.collaborationType && (
                  <span className="text-ink-soft text-xs">
                    · {TYPE[m.collaborationType] ?? m.collaborationType}
                  </span>
                )}
              </div>
              <div className="text-ink-soft mt-1 text-sm">
                {m.organization ?? `${m.city ? m.city + "'da " : ''}bir kurum`}
                {m.introduced
                  ? ' · tanıştırıldınız'
                  : ' · kurum seni inceliyor; tanıştırma GİRVAK onayıyla'}
                {m.collaborationStatus && ` · ${COLLAB[m.collaborationStatus]}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kutu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-line rounded-2xl border p-5">
      <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
