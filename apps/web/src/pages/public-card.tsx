import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { EvidenceLevel, EvidenceSourceKind } from '@evidex/shared';
import { api } from '../lib/api';

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

const LEVEL: Record<EvidenceLevel, { label: string; cls: string; note: string }> = {
  verified: {
    label: 'Doğrulanmış',
    cls: 'bg-verified',
    note: 'kaynağın sahibi olduğu makine ile doğrulandı',
  },
  documented: { label: 'Belgeli', cls: 'bg-documented', note: 'belgeyle destekli' },
  referenced: {
    label: 'Referanslı',
    cls: 'bg-referenced',
    note: 'platformda izlenen iş birliğinden kurum değerlendirmesi',
  },
  declared: { label: 'Beyan', cls: 'bg-declared', note: 'kişinin beyanı, henüz kanıtsız' },
};
const KIND: Record<EvidenceSourceKind, string> = {
  github_repo: 'GitHub deposu',
  live_url: 'Canlı site',
  document: 'Belge',
  network_reference: 'Kurum referansı',
  challenge_submission: 'Meydan okuma teslimi',
};
const ay = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }) : null;

/**
 * Herkese açık kart (keşfet 01). Gencin paylaştığı link; oturum yok. Kişisel kimlik (e-posta,
 * GitHub adı) yok; yalnız onaylı iddialar ve kanıt seviyeleri. Her seviyenin ne anlama geldiği
 * yazılır — okuyan kurum "doğrulanmış" ile "beyan" farkını tahmin etmez.
 */
export function PublicCardPage() {
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
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">Evidex</div>
        <h1 className="mt-2 text-2xl font-bold">Bu kart kapalı.</h1>
        <p className="text-ink-soft mt-2 text-sm">Sahibi paylaşımı kapatmış ya da link yanlış.</p>
      </div>
    );
  if (!card) return null;

  const kinds = [...new Set(card.sources.map((s) => s.kind))];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-ink-soft flex items-center justify-between text-xs font-semibold tracking-wide uppercase">
        <span>Evidex · kanıta dayalı kart</span>
        {card.cardApprovedAt && <span>onaylı {ay(card.cardApprovedAt)}</span>}
      </div>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{card.name}</h1>
      {card.headline && <p className="mt-1 text-lg">{card.headline}</p>}
      {card.city && <p className="text-ink-soft mt-1 text-sm">{card.city}</p>}
      {card.story && <p className="mt-5 max-w-prose leading-relaxed">{card.story}</p>}
      {card.silent && (
        <p className="text-ink-soft mt-4 text-xs">
          Kanıtlarda son etkinlik {ay(card.lastSignalAt) ?? '—'}; kart bir süredir sessiz.
        </p>
      )}

      <h2 className="text-ink-soft mt-10 text-xs font-semibold tracking-wide uppercase">
        Onaylı iddialar · {card.claims.length}
      </h2>
      <ul className="mt-3 space-y-3">
        {card.claims.map((c) => (
          <li key={c.id} className="border-line rounded-xl border p-4">
            <p className="text-sm leading-relaxed">{c.text}</p>
            <div className="text-ink-soft mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${LEVEL[c.level].cls}`}
                title={LEVEL[c.level].note}
              >
                {LEVEL[c.level].label}
              </span>
              {c.periodStart && (
                <span>
                  {ay(c.periodStart)} → {ay(c.periodEnd) ?? 'devam'}
                </span>
              )}
              <span>{c.sourceCount} kaynak</span>
            </div>
          </li>
        ))}
      </ul>

      {kinds.length > 0 && (
        <p className="text-ink-soft mt-6 text-xs">
          Kaynaklar: {kinds.map((k) => KIND[k]).join(' · ')}. Kod ya da belge saklanmaz; yalnız
          sinyal çıkarılır ve sahiplik doğrulanır.
        </p>
      )}
      <div className="border-line mt-10 border-t pt-4 text-xs">
        <span className="text-ink-soft">Seviye sözlüğü — </span>
        {(Object.keys(LEVEL) as EvidenceLevel[]).map((k) => (
          <span key={k} className="text-ink-soft mr-3">
            <b>{LEVEL[k].label}:</b> {LEVEL[k].note}
          </span>
        ))}
      </div>
    </div>
  );
}
