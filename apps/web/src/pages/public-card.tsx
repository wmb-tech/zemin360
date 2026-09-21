import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { EvidenceLevel, EvidenceSourceKind } from '@evidex/shared';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter } from '../components/motion';
import { KIND, LEVEL, LevelBadge, Skeleton } from '../components/ui';

interface PublicCard {
  name: string;
  headline: string | null;
  story: string | null;
  city: string | null;
  cardApprovedAt: string | null;
  lastSignalAt: string | null;
  silent: boolean;
  claims: {
    id: string;
    text: string;
    level: EvidenceLevel;
    periodStart: string | null;
    periodEnd: string | null;
    sourceCount: number;
  }[];
  sources: { kind: EvidenceSourceKind; verified: boolean }[];
}

const SIRA: EvidenceLevel[] = ['verified', 'documented', 'referenced', 'declared'];
const ay = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) : null;

/**
 * Herkese açık kart — kanıt dosyası (keşfet 01). Oturum yok; kişisel kimlik (e-posta, GitHub adı)
 * yok; yalnız onaylı iddialar ve seviyeleri. İddialar seviyeye göre gruplanır: okuyan kurum
 * "doğrulanmış" ile "beyan"ı aynı yığında görmez. Seviye sözlüğü sayfanın parçası, ipucu değil.
 */
export function PublicCardPage() {
  useTitle('Kart');
  const { slug = '' } = useParams();
  const [card, setCard] = useState<PublicCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PublicCard>(`/api/cards/${slug}`)
      .then(setCard)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Kart bulunamadı'));
  }, [slug]);

  if (error)
    return (
      <Kabuk>
        <h1 className="text-ink mt-2 text-2xl font-bold tracking-[-0.02em]">Bu kart kapalı</h1>
        <p className="text-ink-soft mt-2 max-w-[55ch] leading-relaxed">
          Sahibi paylaşımı kapatmış ya da bağlantı yanlış. Evidex kartları yalnız sahibinin açtığı
          sürece görünür.
        </p>
        <Link
          to="/"
          className="text-accent mt-6 inline-block text-sm font-semibold hover:underline"
        >
          Evidex nedir?
        </Link>
      </Kabuk>
    );
  if (!card)
    return (
      <Kabuk>
        <Skeleton rows={6} />
      </Kabuk>
    );

  const kinds = [...new Set(card.sources.map((s) => s.kind))];
  const sayim = Object.fromEntries(
    SIRA.map((l) => [l, card.claims.filter((c) => c.level === l).length]),
  ) as Record<EvidenceLevel, number>;
  const gruplar = SIRA.filter((l) => sayim[l] > 0);

  return (
    <Kabuk wide>
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <Enter i={0} as="header">
            <h1 className="text-ink text-[32px] leading-tight font-extrabold tracking-[-0.035em] md:text-[40px]">
              {card.name}
            </h1>
            {card.headline && <p className="text-ink mt-2 text-lg">{card.headline}</p>}
            {card.city && <p className="text-ink-soft mt-1 text-sm">{card.city}</p>}
            {card.story && (
              <p className="text-ink mt-5 max-w-[65ch] leading-relaxed">{card.story}</p>
            )}
          </Enter>

          {gruplar.map((l, gi) => (
            <Enter key={l} i={gi + 1} as="section" className="mt-10">
              <div className="flex items-baseline gap-3">
                <LevelBadge level={l} />
                <span className="text-ink-soft text-sm">
                  {sayim[l]} iddia · {LEVEL[l].note.toLowerCase()}
                </span>
              </div>
              <ul className="border-line mt-3 divide-y divide-[var(--color-line)] border-y">
                {card.claims
                  .filter((c) => c.level === l)
                  .map((c) => (
                    <li key={c.id} className="py-4">
                      <p className="text-ink leading-relaxed">{c.text}</p>
                      <div className="text-ink-soft tnum mt-1.5 flex flex-wrap gap-x-3 text-xs">
                        {c.periodStart && (
                          <span>
                            {ay(c.periodStart)} – {ay(c.periodEnd) ?? 'sürüyor'}
                          </span>
                        )}
                        <span>{c.sourceCount} kaynak</span>
                      </div>
                    </li>
                  ))}
              </ul>
            </Enter>
          ))}
        </div>

        <Enter i={1} as="aside" className="md:pt-2">
          <dl className="text-sm">
            <div className="border-line border-b py-3">
              <dt className="text-ink-soft text-xs font-bold tracking-wide uppercase">Kart</dt>
              <dd className="text-ink mt-1">
                {card.cardApprovedAt ? `Onaylı · ${ay(card.cardApprovedAt)}` : 'Onaylı'}
              </dd>
            </div>
            <div className="border-line border-b py-3">
              <dt className="text-ink-soft text-xs font-bold tracking-wide uppercase">
                Son kanıt etkinliği
              </dt>
              <dd className={`mt-1 ${card.silent ? 'text-referenced' : 'text-ink'}`}>
                {ay(card.lastSignalAt) ?? '—'}
                {card.silent && ' · bir süredir sessiz'}
              </dd>
            </div>
            {kinds.length > 0 && (
              <div className="border-line border-b py-3">
                <dt className="text-ink-soft text-xs font-bold tracking-wide uppercase">
                  Kaynak türleri
                </dt>
                <dd className="text-ink mt-1">{kinds.map((k) => KIND[k]).join(' · ')}</dd>
              </div>
            )}
            <div className="py-3">
              <dt className="text-ink-soft text-xs font-bold tracking-wide uppercase">
                Seviyeler ne demek
              </dt>
              <dd className="mt-2 space-y-2">
                {SIRA.map((k) => (
                  <div key={k} className="flex items-start gap-2">
                    <LevelBadge level={k} />
                    <span className="text-ink-soft text-xs leading-relaxed">{LEVEL[k].note}</span>
                  </div>
                ))}
              </dd>
            </div>
          </dl>
          <p className="text-ink-soft mt-4 text-xs leading-relaxed">
            Kod ya da belge saklanmaz; yalnız sinyal çıkarılır, sahiplik doğrulanır. Kartın iletişim
            bilgisi yok: tanıştırma GİRVAK üzerinden yapılır.
          </p>
        </Enter>
      </div>
    </Kabuk>
  );
}

function Kabuk({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto px-4 py-10 md:py-14 ${wide ? 'max-w-[1040px]' : 'max-w-[640px]'}`}>
      <div className="text-ink-soft mb-8 flex items-center justify-between text-xs font-bold tracking-wide uppercase">
        <Link to="/" className="text-ink text-base font-extrabold tracking-tight normal-case">
          Evidex
        </Link>
        <span>Kanıta dayalı kart</span>
      </div>
      {children}
    </div>
  );
}
