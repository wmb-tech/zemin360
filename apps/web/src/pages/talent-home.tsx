import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileCheck2,
  FileText,
  Flag,
  GitBranch,
  Globe,
  Handshake,
  Users,
} from 'lucide-react';
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
    consentRequested: boolean;
    talentConsent: string | null;
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
        baslik: 'İlk kanıtını bağla',
        aciklama:
          'GitHub reposu, canlı ürün veya PDF belgenle başla. Ajan kartının ilk taslağını yazar.',
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
    const pendingIntroduction = o.matches.find(
      (match) => match.consentRequested && match.talentConsent === 'pending' && !match.introduced,
    );
    if (pendingIntroduction)
      return {
        baslik: 'Tanıştırma isteğine karar ver',
        aciklama:
          'Bir kurum seninle tanıştırılmak istiyor. Kabulün olmadan iletişim bilgilerin paylaşılmaz.',
        to: '/tanistirmalar',
        cta: 'İsteği incele',
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
    if (!o.card.publicSlug)
      return {
        baslik: 'Kartını paylaş',
        aciklama:
          'Linki bilen yalnız onaylı iddialarını ve kanıt seviyelerini görür; e-posta ve GitHub adın görünmez.',
        to: '/kart?bolum=paylas',
        cta: 'Paylaşımı aç',
      };
    return {
      baslik: 'Kartın ağda ve paylaşımda',
      aciklama:
        'Kurumlar ihtiyaç açtıkça ajan seni gerekçesiyle değerlendirir; güçlü eşleşmede e-posta alırsın.',
      to: '/kart?bolum=paylas',
      cta: 'Paylaşım linki',
    };
  })();

  const durumCumlesi = agda
    ? `${o.card.approvedClaims} onaylı iddia · ${o.card.sources} kaynak`
    : o.card.sources === 0
      ? 'Henüz kaynak bağlanmadı'
      : `Taslak · ${o.card.approvedClaims}/${o.card.claims} iddia onaylı`;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-10">
      <div className="min-w-0">
        <Live message={params.get('onay') ? 'Kartın ağda.' : null} />
        <Enter i={0} as="header">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Yetenek kartın</Eyebrow>
              <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
                {ilkAd}, {agda ? 'kartın ağda' : 'kartın hazırlanıyor'}
              </h1>
              <p className="text-ink-soft tnum mt-1 text-base">{durumCumlesi}</p>
            </div>
          </div>
        </Enter>

        <Enter i={1} y={10} as="section" className="mt-7">
          {!agda && (
            <Ilerleme
              adimlar={[
                { ad: 'Bağla', bitti: o.card.sources > 0 },
                { ad: 'Okut', bitti: o.card.claims > 0 || o.card.approvedClaims > 0 },
                { ad: 'Onayla', bitti: agda },
                { ad: 'Paylaş', bitti: Boolean(o.card.publicSlug) },
              ]}
            />
          )}
          <div className="bg-surface border-line work-panel mt-4 rounded-[var(--radius-feature)] border p-6 md:p-7">
            <div className="flex flex-col gap-5">
              <div className="text-accent flex items-center gap-2">
                <FileCheck2 size={26} aria-hidden />
                <span className="text-xs font-bold">
                  {agda ? 'Kartın hazır' : 'Bir sonraki adım'}
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="text-ink text-2xl font-bold tracking-[-0.025em] md:text-[28px]">
                  {adim.baslik}
                </h2>
                <p className="text-ink-soft mt-2 max-w-[52ch] text-sm leading-relaxed md:text-base">
                  {adim.aciklama}
                </p>
              </div>
              <Link
                to={adim.to}
                className="pressable bg-accent text-surface hover:bg-accent-strong inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-[var(--radius-control)] px-5 text-sm font-semibold"
              >
                {adim.cta} <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </Enter>

        <Enter i={2} as="section" className="border-line mt-6 grid grid-cols-3 gap-3 border-y py-5">
          <div>
            <div className="text-ink-soft text-xs font-semibold">Kanıt kaynakları</div>
            <Link
              to="/kart?bolum=kaynaklar"
              className="text-ink tnum mt-1 inline-flex min-h-11 items-center gap-2 text-lg font-bold hover:text-accent"
            >
              {o.card.sources} kaynak <ChevronRight size={14} aria-hidden />
            </Link>
          </div>
          <div>
            <div className="text-ink-soft text-xs font-semibold">Onaylı iddialar</div>
            <div className="text-ink tnum mt-1 flex min-h-11 items-center text-lg font-bold">
              {o.card.approvedClaims}
              <span className="text-ink-soft ml-1 text-sm font-normal">/ {o.card.claims}</span>
            </div>
          </div>
          <div>
            <div className="text-ink-soft text-xs font-semibold">Tanıştırmalar</div>
            <div className="text-ink tnum mt-1 flex min-h-11 items-center text-lg font-bold">
              {o.matches.filter((m) => m.introduced).length}
            </div>
          </div>
        </Enter>

        <Enter i={3} as="section" className="mt-8">
          <h2 className="text-ink text-lg font-bold tracking-[-0.02em]">
            {o.matches.length === 1 ? 'Sana uygun bir eşleşme' : 'Eşleşmeler'}
          </h2>
          {o.matches.length === 0 ? (
            <div className="mt-3">
              <Empty icon={Users} bekliyor title="Henüz eşleşme yok">
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
                        ? ` · ${m.collaborationStatus ? COLLAB[m.collaborationStatus] : 'Tanıştırıldınız'}`
                        : ' · kurum seni inceliyor; tanıştırma GİRVAK onayıyla'}
                    </p>
                    {(m.fit || m.gap) && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {m.fit && (
                          <div>
                            <div className="text-verified text-xs font-bold">Uyuyor</div>
                            <p className="text-ink mt-0.5 text-sm">{m.fit}</p>
                          </div>
                        )}
                        <div>
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
        <section className="border-line border-b pb-6 xl:pt-1">
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
                  <div
                    className="bg-paper-2 text-ink-soft mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    title={KIND[s.kind]}
                  >
                    <KaynakIkon kind={s.kind} />
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
                      {KIND[s.kind]} ·{' '}
                      {s.kind === 'document' ? 'belgeli' : s.verified ? 'doğrulandı' : 'beyan'} ·{' '}
                      {gunOnce(s.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {agda && !o.card.silent && (
          <div className="mt-6">
            <div className="text-ink text-sm font-bold">Yeni bir iş tamamladın mı?</div>
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

/** İlk kullanımın dört adımı: hangisinde olduğun tek bakışta görünsün (ilk gelen genç için). */
function Ilerleme({ adimlar }: { adimlar: { ad: string; bitti: boolean }[] }) {
  const simdiki = adimlar.findIndex((a) => !a.bitti);
  return (
    <ol className="flex items-center justify-between gap-2" aria-label="Kartının durumu">
      {adimlar.map((a, i) => {
        const aktif = i === simdiki;
        return (
          <li key={a.ad} className="flex items-center gap-1.5 sm:min-w-0 sm:flex-1 sm:gap-2">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                a.bitti
                  ? 'bg-verified text-surface'
                  : aktif
                    ? 'bg-accent text-surface'
                    : 'border-line text-ink-soft border bg-surface'
              }`}
              aria-hidden
            >
              {a.bitti ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={`text-sm whitespace-nowrap ${aktif ? 'text-ink font-bold' : a.bitti ? 'text-ink' : 'text-ink-soft'}`}
            >
              {a.ad}
              <span className="sr-only">{a.bitti ? ' — tamam' : aktif ? ' — şimdi' : ''}</span>
            </span>
            {i < adimlar.length - 1 && (
              <span
                className={`hidden h-px min-w-3 flex-1 sm:block ${a.bitti ? 'bg-verified/50' : 'bg-line'}`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

const KAYNAK_IKON = {
  github_repo: GitBranch,
  live_url: Globe,
  document: FileText,
  network_reference: Handshake,
  challenge_submission: Flag,
} as const;
function KaynakIkon({ kind }: { kind: keyof typeof KAYNAK_IKON }) {
  const Icon = KAYNAK_IKON[kind];
  return <Icon size={16} aria-hidden />;
}
