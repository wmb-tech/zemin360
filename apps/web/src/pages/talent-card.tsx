import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { EvidenceLevel } from '@evidex/shared';
import { api } from '../lib/api';

interface Claim {
  id: string;
  text: string;
  draftText: string | null;
  level: EvidenceLevel;
  sourceIds: string[];
  periodStart: string | null;
  periodEnd: string | null;
  approved: boolean;
}
interface Source {
  id: string;
  kind: string;
  ref: string;
  ownershipVerified: boolean;
  lastScannedAt: string | null;
}
interface Card {
  talent: {
    id: string;
    headline: string | null;
    story: string | null;
    cardStatus: 'draft' | 'approved';
    githubConnected: boolean;
    lastSignalAt: string | null;
  };
  user: { name: string; githubLogin: string | null };
  sources: Source[];
  claims: Claim[];
}

const LEVEL: Record<EvidenceLevel, { label: string; cls: string }> = {
  verified: { label: 'Doğrulanmış', cls: 'bg-[var(--color-verified)] text-white' },
  documented: { label: 'Belgeli', cls: 'bg-[var(--color-documented)] text-white' },
  referenced: { label: 'Referanslı', cls: 'bg-[var(--color-referenced)] text-white' },
  declared: { label: 'Beyan', cls: 'bg-[var(--color-declared)] text-white' },
};

const ay = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }) : null;

/**
 * Gencin kartı (döngü adımı 02). Kanıt bağla → taslak iddialar → tek tek onayla → kartı onayla.
 * Onaysız hiçbir şey ağa girmez; bu ekranın tek amacı kişiye kendi kartının kontrolünü vermek.
 */
export function TalentCardPage() {
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();

  async function load() {
    setCard(await api<Card>('/api/me/card'));
  }
  useEffect(() => {
    void load();
  }, []);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(null);
    }
  }

  if (!card) return null;
  const onayli = card.claims.filter((c) => c.approved).length;
  const approved = card.talent.cardStatus === 'approved';

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
      {/* Sol: kanıt kaynakları */}
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Kanıtlarım</h1>
        <p className="text-ink-soft mt-2 text-sm">
          Kendini anlatma; kanıtını bağla. Kod saklanmaz, yalnız sinyal çıkarılır.
        </p>
        {params.get('installed') && (
          <p className="text-verified mt-3 text-sm font-semibold">
            GitHub bağlandı. Şimdi senkronla.
          </p>
        )}

        <div className="border-line mt-5 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">GitHub</div>
              <div className="text-ink-soft text-xs">
                {card.talent.githubConnected
                  ? `Bağlı · ${card.sources.length} repo`
                  : 'Hangi repoları göstereceğini sen seçersin'}
              </div>
            </div>
            {card.talent.githubConnected ? (
              <button
                disabled={busy === 'sync'}
                onClick={() =>
                  void run('sync', () => api('/api/me/evidence/github/sync', { method: 'POST' }))
                }
                className="bg-ink text-paper rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              >
                {busy === 'sync' ? 'Okunuyor…' : 'Senkronla'}
              </button>
            ) : (
              <a
                href="/api/me/evidence/github/install"
                className="bg-ink text-paper rounded-lg px-3 py-1.5 text-sm font-semibold"
              >
                Bağla
              </a>
            )}
          </div>
          {card.sources.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {card.sources.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="text-verified">●</span>
                  <span className="font-mono text-xs">{s.ref}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-line text-ink-soft mt-3 rounded-xl border border-dashed p-4 text-sm">
          Canlı ürün (URL) ve belge (PDF) kaynakları yakında.
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      {/* Sağ: kart */}
      <section className="border-line h-fit rounded-2xl border p-6">
        <div className="text-ink-soft flex items-center justify-between text-xs font-semibold tracking-wide uppercase">
          <span>Yetkinlik kartı</span>
          <span className={approved ? 'text-verified' : ''}>
            {approved ? 'Onaylı · ağda' : 'Taslak'}
          </span>
        </div>
        <h2 className="mt-2 text-xl font-bold tracking-tight">{card.user.name}</h2>
        <EditableLine
          value={card.talent.headline}
          placeholder="Başlık (ör. Mobil ve web geliştirici)"
          onSave={(v) =>
            run('headline', () =>
              api('/api/me/card', { method: 'PATCH', body: JSON.stringify({ headline: v }) }),
            )
          }
        />
        <EditableLine
          value={card.talent.story}
          placeholder="Hikâye — kanıttan otomatik yazılır, sen düzeltirsin"
          multiline
          onSave={(v) =>
            run('story', () =>
              api('/api/me/card', { method: 'PATCH', body: JSON.stringify({ story: v }) }),
            )
          }
        />

        <div className="text-ink-soft mt-6 text-xs font-semibold tracking-wide uppercase">
          İddialar · {onayli}/{card.claims.length} onaylı
        </div>
        {card.claims.length === 0 && (
          <p className="text-ink-soft mt-2 text-sm">
            Henüz iddia yok. GitHub'ı bağlayıp senkronla.
          </p>
        )}
        <ul className="mt-2 space-y-2">
          {card.claims.map((c) => (
            <li
              key={c.id}
              className={`rounded-xl border p-3 ${c.approved ? 'border-[var(--color-verified)]' : 'border-line'}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={c.approved}
                  disabled={busy === c.id}
                  onChange={(e) =>
                    void run(c.id, () =>
                      api(`/api/me/card/claims/${c.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ approved: e.target.checked }),
                      }),
                    )
                  }
                  className="mt-1"
                  aria-label="Onayla"
                />
                <div className="flex-1">
                  <div className="text-sm">{c.text}</div>
                  <div className="text-ink-soft mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${LEVEL[c.level].cls}`}
                    >
                      {LEVEL[c.level].label}
                    </span>
                    {c.periodStart && (
                      <span>
                        {ay(c.periodStart)} → {ay(c.periodEnd) ?? 'devam'}
                      </span>
                    )}
                    <span>{c.sourceIds.length} kaynak</span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    void run(c.id, () => api(`/api/me/card/claims/${c.id}`, { method: 'DELETE' }))
                  }
                  className="text-ink-soft text-xs hover:text-red-600"
                  aria-label="Sil"
                >
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>

        {!approved && (
          <div className="border-line mt-6 border-t pt-4">
            <button
              disabled={onayli === 0 || busy === 'approve'}
              onClick={() =>
                void run('approve', () => api('/api/me/card/approve', { method: 'POST' }))
              }
              className="bg-accent text-paper rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Kartı onayla ve ağa gir
            </button>
            {onayli === 0 && (
              <p className="text-ink-soft mt-2 text-xs">En az bir iddiayı onaylaman gerekiyor.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function EditableLine({
  value,
  placeholder,
  multiline,
  onSave,
}: {
  value: string | null;
  placeholder: string;
  multiline?: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`mt-1 block w-full text-left ${value ? 'text-sm' : 'text-declared text-sm'} hover:underline`}
      >
        {value ?? placeholder}
      </button>
    );
  }
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className="mt-1 flex gap-2">
      <Tag
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={multiline ? 3 : undefined}
        className="border-line focus:border-accent flex-1 rounded-lg border px-2 py-1 text-sm outline-none"
      />
      <button
        onClick={() => {
          setEditing(false);
          if (draft.trim() && draft !== value) onSave(draft.trim());
        }}
        className="bg-ink text-paper rounded-lg px-3 text-xs font-semibold"
      >
        Kaydet
      </button>
    </div>
  );
}
