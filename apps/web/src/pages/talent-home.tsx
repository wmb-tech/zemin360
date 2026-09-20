import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, ChevronRight, FileCheck2, IdCard, Users } from 'lucide-react';
import {
  THRESHOLDS,
  type CollaborationStatus,
  type EvidenceSourceKind,
  type MatchStrength,
} from '@evidex/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTitle } from '../lib/title';
import { Enter, Live } from '../components/motion';
import { Empty, ErrorNote, Eyebrow, KIND, Panel, Skeleton, StrengthBadge } from '../components/ui';

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
    fit: string | null;
    gap: string | null;
  }[];
  openChallenges: number;
  recentSources: {
    id: string;
    kind: EvidenceSourceKind;
    ref: string;
    verified: boolean;
    createdAt: string;
    lastScannedAt: string | null;
  }[];
  pendingClaims: number;
}

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
const gunOnce = (iso: string) => {
  const g = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return g <= 0 ? 'bugün' : g === 1 ? 'dün' : `${g} gün önce`;
};

/**
 * Gencin durum sayfası — onaylı görsel yönün çıpası (docs/redesign/assets). Sıra: başlık ve
 * kart durumu → sıradaki adım → kart/eşleşme özetleri → eşleşme gerekçesi → son kaynaklar.
 * Kurum adı tanıştırmaya kadar gizli; sayılar ve gerekçeler yalnız API'den.
 */
export function TalentHomePage() {
  useTitle('Durum');
  const { me } = useAuth();
  const [params] = useSearchParams();
  const [o, setO] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<Overview>('/api/me/overview')
      .then(setO)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Durum yüklenemedi'));
  }, []);
  if (err) return <ErrorNote>{err} — sayfayı yenileyip tekrar dene.</ErrorNote>;
  if (!o) return <Skeleton rows={5} />;

  const ilkAd = me?.name.split(' ')[0] ?? '';
  const agda = o.card.status === 'approved';
  // Sıradaki adım öncelik sırası (docs/redesign/01 §2). Tek, net, doğru sahip.
  const adim = (() => {
    if (o.card.sources === 0)
      return {
        baslik: 'GitHub hesabını bağla',
        aciklama: 'Repolarını sen seçersin; kod saklanmaz. Ajan kartının ilk taslağını yazar.',
        to: '/kart',
        cta: 'Kanıt bağla',
      };
    if (o.card.approvedClaims === 0)
      return {
        baslik: `${o.card.claims} taslak iddiayı gözden geçir`,
        aciklama: 'Doğru olanı onayla, olmayanı sil. Onaysız iddia ağa girmez.',
        to: '/kart',
        cta: 'İddiaları incele',
      };
    if (!agda)
      return {
        baslik: 'Kartını onayla ve ağa gir',
        aciklama:
          'Onaylı iddiaların hazır. Kart onaylanınca kurumlar seni gerekçeli listede görür.',
        to: '/kart',
        cta: 'Kartı onayla',
      };
    if (o.card.silent)
      return {
        baslik: 'Kartın sessiz — yeni kanıt bağla',
        aciklama: `${THRESHOLDS.silentCardAfterDays} günden uzun süredir yeni etkinlik yok; güncel kartlar eşleşmede öne çıkar.`,
        to: '/davetler',
        cta: 'Meydan okumalara bak',
      };
    if (o.pendingClaims > 0)
      return {
        baslik: `${o.pendingClaims} yeni iddiayı gözden geçir`,
        aciklama: 'Kartın ağda. Yeni taslakları onaylayınca kartın güçlenir.',
        to: '/kart',
        cta: 'İddiaları incele',
      };
    if (o.openChallenges > 0)
      return {
        baslik: `${o.openChallenges} açık meydan okuma var`,
        aciklama:
          'Gerçek bir kurum ihtiyacından türetilmiş 24–48 saatlik görev; teslimin karta doğrulanmış kanıt olarak girer.',
        to: '/davetler',
        cta: 'Görevleri gör',
      };
    return {
      baslik: 'Kartın ağda',
      aciklama:
        'Kurumlar ihtiyaç açtıkça ajan seni gerekçesiyle değerlendirir; güçlü eşleşmede e-posta alırsın.',
      to: '/kart',
      cta: 'Kartımı gör',
    };
  })();

  const durumCumlesi = agda
    ? `${o.card.approvedClaims} onaylı iddia · ${o.card.sources} kaynak`
    : o.card.sources === 0
      ? 'Henüz kaynak bağlanmadı'
      : `Taslak · ${o.card.approvedClaims}/${o.card.claims} iddia onaylı`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <Live message={params.get('onay') ? 'Kartın ağda.' : null} />
        <Enter i={0} as="header">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
                {ilkAd}, {agda ? 'kartın ağda' : 'kartın hazırlanıyor'}
              </h1>
              <p className="text-ink-soft tnum mt-1 text-base">{durumCumlesi}</p>
            </div>
            <Link
              to="/kart"
              className="pressable border-line bg-surface text-ink hover:bg-paper-2 hidden min-h-11 items-center gap-2 rounded-[var(--radius-control)] border px-4 text-sm font-semibold md:inline-flex"
            >
              <IdCard size={18} aria-hidden /> Kartımı gör
            </Link>
          </div>
        </Enter>

        <Enter i={1} y={10} as="section" className="mt-6">
          <div className="bg-accent-soft rounded-[var(--radius-feature)] p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="bg-surface text-accent hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl md:flex">
                <FileCheck2 size={26} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <Eyebrow>Sıradaki adım</Eyebrow>
                <h2 className="text-ink mt-1 text-xl font-bold tracking-[-0.02em] md:text-[22px]">
                  {adim.baslik}
                </h2>
                <p className="text-ink-soft mt-1 text-sm md:text-base">{adim.aciklama}</p>
              </div>
              <Link
                to={adim.to}
                className="pressable bg-accent text-surface hover:bg-accent-strong inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-5 text-sm font-semibold"
              >
                {adim.cta} <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </Enter>

        <Enter i={2} as="section" className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link to="/kart" className="group">
            <Panel className="pressable hover:border-accent/40 flex h-full items-center gap-4 p-5">
              <div className="bg-accent-soft text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <IdCard size={20} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <Eyebrow>Kart</Eyebrow>
                <div className="text-ink text-xl font-bold">{agda ? 'Ağda' : 'Taslak'}</div>
                <div className="text-ink-soft tnum text-sm">
                  {o.card.sources} kaynak · {o.card.approvedClaims}/{o.card.claims} iddia onaylı
                </div>
              </div>
              <ChevronRight size={18} className="text-ink-soft" aria-hidden />
            </Panel>
          </Link>
          <Panel className="flex items-center gap-4 p-5">
            <div className="bg-accent-soft text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              <Users size={20} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <Eyebrow>Eşleşmeler</Eyebrow>
              <div className="text-ink tnum text-xl font-bold">{o.matches.length}</div>
              <div className="text-ink-soft tnum text-sm">
                {o.matches.length === 0
                  ? 'Kısa liste açılınca burada görünür'
                  : `${o.matches.filter((m) => m.introduced).length} tanıştırma`}
              </div>
            </div>
          </Panel>
        </Enter>

        <Enter i={3} as="section" className="mt-8">
          <h2 className="text-ink text-lg font-bold tracking-[-0.02em]">
            {o.matches.length === 1 ? 'Sana uygun bir eşleşme' : 'Eşleşmeler'}
          </h2>
          {o.matches.length === 0 ? (
            <div className="mt-3">
              <Empty title="Henüz eşleşme yok">
                Bir kurum ihtiyaç açıp GİRVAK kısa listeyi onaylayınca burada görünür. Kurum seni
                ilk adın ve gerekçeyle görür; tanıştırma olursa iki tarafa e-posta gider.
              </Empty>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {o.matches.map((m) => (
                <li key={m.matchId}>
                  <Panel className="p-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-ink text-base font-bold">{m.needTitle ?? 'İhtiyaç'}</h3>
                      <StrengthBadge strength={m.strength} long />
                      {m.collaborationType && (
                        <span className="text-ink-soft text-sm">
                          {TYPE[m.collaborationType] ?? m.collaborationType}
                        </span>
                      )}
                    </div>
                    <p className="text-ink-soft mt-1 text-sm">
                      {m.organization ?? `${m.city ? `${m.city}'da ` : ''}bir kurum`}
                      {m.introduced
                        ? ' · tanıştırıldınız'
                        : ' · kurum seni inceliyor; tanıştırma GİRVAK onayıyla'}
                      {m.collaborationStatus && ` · ${COLLAB[m.collaborationStatus]}`}
                    </p>
                    {(m.fit || m.gap) && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {m.fit && (
                          <div className="bg-verified-soft rounded-[var(--radius-control)] px-4 py-3">
                            <div className="text-verified text-xs font-bold">Uyuyor</div>
                            <p className="text-ink mt-0.5 text-sm">{m.fit}</p>
                          </div>
                        )}
                        <div className="bg-paper-2 rounded-[var(--radius-control)] px-4 py-3">
                          <div className="text-ink-soft text-xs font-bold">Eksik</div>
                          <p className="text-ink mt-0.5 text-sm">
                            {m.gap ?? 'Belirgin bir eksik tespit edilmedi.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </Enter>
      </div>

      <Enter i={4} y={6} as="aside" className="min-w-0">
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-ink text-base font-bold">Son kaynaklar</h2>
            <Link to="/kart" className="text-accent text-sm font-semibold hover:underline">
              Tümünü gör
            </Link>
          </div>
          {o.recentSources.length === 0 ? (
            <p className="text-ink-soft mt-3 text-sm">
              Henüz kaynak yok. GitHub, canlı ürün ya da belge bağlayınca burada listelenir.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--color-line)]">
              {o.recentSources.map((s) => (
                <li key={s.id} className="flex items-start gap-3 py-3">
                  <div className="bg-paper-2 text-ink-soft mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase">
                    {KIND[s.kind].slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-ink truncate text-sm font-semibold">
                      {s.kind === 'document'
                        ? s.ref.split('#')[0]
                        : s.kind === 'network_reference'
                          ? 'Kurum referansı'
                          : s.ref.replace(/^https?:\/\//, '')}
                    </div>
                    <div className="text-ink-soft text-xs">
                      {KIND[s.kind]} · {s.verified ? 'doğrulandı' : 'beyan'} ·{' '}
                      {gunOnce(s.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {agda && !o.card.silent && (
          <div className="bg-accent-soft mt-4 rounded-[var(--radius-panel)] p-5">
            <div className="text-ink font-bold">Kartını güçlendir</div>
            <p className="text-ink-soft mt-1 text-sm">
              Canlı bir ürün ya da belge bağla; her yeni kanıt eşleşmede daha çok şey söyler.
            </p>
            <Link
              to="/kart"
              className="text-accent mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              Kaynak ekle <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        )}
      </Enter>
    </div>
  );
}
