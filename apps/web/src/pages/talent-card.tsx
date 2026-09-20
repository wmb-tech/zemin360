import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { THRESHOLDS, type EvidenceLevel } from '@evidex/shared';
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
  kind: 'github_repo' | 'live_url' | 'document' | 'network_reference' | 'challenge_submission';
  ref: string;
  ownershipVerified: boolean;
  verifyToken: string | null;
  lastScannedAt: string | null;
}
interface Card {
  talent: {
    id: string;
    headline: string | null;
    story: string | null;
    cardStatus: 'draft' | 'approved';
    githubConnected: boolean;
    installations: {
      id: string;
      accountLogin: string;
      accountType: 'user' | 'org';
      lastSyncedAt: string | null;
    }[];
    lastSignalAt: string | null;
    silent: boolean;
    publicSlug: string | null;
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

const KIND_LABEL: Record<Source['kind'], string> = {
  github_repo: 'GitHub deposu',
  live_url: 'Canlı site',
  document: 'Belge',
  network_reference: 'Kurum referansı',
  challenge_submission: 'Meydan okuma teslimi',
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
  // Kurulumdan dönüşte okuma kendiliğinden başlar; "senkronla" ayrı bir adım değil.
  // Sonraki okumalar haftalık zamanlayıcıda; kişi isterse "yeniden oku" der.
  const otoBasladi = useRef(false);
  useEffect(() => {
    if (!card || !params.get('installed') || otoBasladi.current) return;
    otoBasladi.current = true;
    void run('sync', () => api('/api/me/evidence/github/sync', { method: 'POST' }));
  }, [card, params]);

  const [note, setNote] = useState<string | null>(null);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  async function toplu(action: 'approve' | 'unapprove' | 'delete') {
    const ids = [...secili];
    if (action === 'delete' && !window.confirm(`${ids.length} iddia silinsin mi?`)) return;
    await run('bulk', () =>
      api('/api/me/card/claims/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) }),
    );
    setSecili(new Set());
  }
  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      const r = (await fn()) as { skippedOrgRepos?: number; unreadRepos?: number } | undefined;
      const notlar: string[] = [];
      if (r?.skippedOrgRepos)
        notlar.push(
          `${r.skippedOrgRepos} org reposu atlandı: commit'in olmayan repo kanıt sayılmaz.`,
        );
      if (r?.unreadRepos)
        notlar.push(
          `En son itilen 40 repo okundu; ${r.unreadRepos} eski repo okunmadı (GitHub'daki repo seçiminden daraltabilirsin).`,
        );
      if (notlar.length) setNote(notlar.join(' '));
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
            {busy === 'sync'
              ? 'GitHub bağlandı; repolar okunuyor, ajan kartı yazıyor (yarım dakika sürebilir)…'
              : 'GitHub bağlandı. Kart taslağı sağda; her iddiayı onayla ya da sil.'}
          </p>
        )}
        {card.talent.silent && (
          <p className="border-declared text-ink-soft mt-3 rounded-lg border px-3 py-2 text-sm">
            Kartın <b>sessiz</b>: kanıtlarında {THRESHOLDS.silentCardAfterDays} günden uzun süredir
            etkinlik yok. Yeni bir kaynak bağla ya da{' '}
            <Link to="/davetler" className="text-accent underline">
              bir meydan okumaya katıl
            </Link>
            ; eşleşmelerde güncel kartlar öne çıkar.
          </p>
        )}

        <div className="border-line mt-5 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">GitHub</div>
              <div className="text-ink-soft text-xs">
                {card.talent.githubConnected
                  ? `Bağlı · ${card.sources.filter((s) => s.kind === 'github_repo').length} repo`
                  : 'Hangi repoları göstereceğini sen seçersin'}
              </div>
            </div>
            {card.talent.githubConnected ? (
              <button
                disabled={busy === 'sync'}
                onClick={() =>
                  void run('sync', () => api('/api/me/evidence/github/sync', { method: 'POST' }))
                }
                className="border-line hover:bg-paper-2 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                title="Kanıt haftada bir kendiliğinden yenilenir; yeni repo ekledin ya da bekleyemiyorsan"
              >
                {busy === 'sync' ? 'Okunuyor…' : 'Yeniden oku'}
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
          {card.talent.installations.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {card.talent.installations.map((i) => (
                <span
                  key={i.id}
                  className="border-line inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5"
                >
                  <span className="text-ink-soft">{i.accountType === 'org' ? 'org' : 'hesap'}</span>
                  <span className="font-mono">{i.accountLogin}</span>
                  <button
                    onClick={() =>
                      void run(i.id, () =>
                        api(`/api/me/evidence/github/installations/${i.id}`, { method: 'DELETE' }),
                      )
                    }
                    className="text-ink-soft hover:text-red-600"
                    aria-label="Kaldır"
                    title="Bu hesabın repolarını karttan çıkar"
                  >
                    ×
                  </button>
                </span>
              ))}
              <a
                href="/api/me/evidence/github/install?target=org"
                className="text-accent underline"
                title="Üyesi olduğun bir organizasyonun repolarını da kanıt yap; sahiplik commit'lerinden ölçülür"
              >
                + org hesabı ekle
              </a>
            </div>
          )}
          {card.sources.some((s) => s.kind === 'github_repo') && (
            <ul className="mt-3 space-y-1 text-sm">
              {card.sources
                .filter((s) => s.kind === 'github_repo')
                .map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="text-verified">●</span>
                    <span className="font-mono text-xs">{s.ref}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <LiveUrlBlock
          sources={card.sources.filter((s) => s.kind === 'live_url')}
          busy={busy}
          run={run}
        />
        <DocumentBlock
          sources={card.sources.filter((s) => s.kind === 'document')}
          busy={busy}
          run={run}
        />
        {card.sources.some(
          (s) => s.kind === 'network_reference' || s.kind === 'challenge_submission',
        ) && (
          <div className="border-line mt-3 rounded-xl border p-4">
            <div className="font-semibold">Platform içi kanıt</div>
            <ul className="mt-2 space-y-1 text-sm">
              {card.sources
                .filter((s) => s.kind === 'network_reference' || s.kind === 'challenge_submission')
                .map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="text-ink-soft text-xs">
                      {s.kind === 'network_reference' ? 'Kurum referansı' : 'Meydan okuma teslimi'}
                    </span>
                    <span className="truncate font-mono text-xs">
                      {s.kind === 'challenge_submission' ? s.ref : 'iş birliği kaydı'}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
        {note && <p className="text-ink-soft mt-3 text-sm">{note}</p>}
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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="text-ink-soft text-xs font-semibold tracking-wide uppercase">
            İddialar · {onayli}/{card.claims.length} onaylı
          </div>
          {card.claims.length > 1 && (
            <div className="ml-auto flex flex-wrap gap-2 text-xs">
              {secili.size > 0 ? (
                <>
                  <span className="text-ink-soft self-center">{secili.size} seçili</span>
                  <BulkBtn label="Onayla" onClick={() => void toplu('approve')} />
                  <BulkBtn label="Onayı kaldır" onClick={() => void toplu('unapprove')} />
                  <BulkBtn label="Sil" danger onClick={() => void toplu('delete')} />
                  <BulkBtn label="Seçimi bırak" onClick={() => setSecili(new Set())} />
                </>
              ) : (
                <>
                  <BulkBtn
                    label="Tümünü seç"
                    onClick={() => setSecili(new Set(card.claims.map((c) => c.id)))}
                  />
                  <BulkBtn
                    label="Taslakları seç"
                    onClick={() =>
                      setSecili(new Set(card.claims.filter((c) => !c.approved).map((c) => c.id)))
                    }
                  />
                </>
              )}
            </div>
          )}
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
              onClick={(e) => {
                // Metne tıklayınca seçime al/çıkar (checkbox ve düğmeler kendi işini yapar)
                if ((e.target as HTMLElement).closest('input,button,a')) return;
                setSecili((s) => {
                  const n = new Set(s);
                  if (n.has(c.id)) n.delete(c.id);
                  else n.add(c.id);
                  return n;
                });
              }}
              className={`cursor-pointer rounded-xl border p-3 ${
                secili.has(c.id)
                  ? 'border-accent bg-accent-soft'
                  : c.approved
                    ? 'border-[var(--color-verified)]'
                    : 'border-line'
              }`}
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
                    {c.sourceIds.map((id) => {
                      const src = card.sources.find((x) => x.id === id);
                      if (!src) return null;
                      // Referans/teslim kaynaklarının ref'i iç id; kişiye tür adı gösterilir.
                      const ad =
                        src.kind === 'document'
                          ? src.ref.split('#')[0]
                          : src.kind === 'network_reference'
                            ? 'kurum referansı'
                            : src.ref.replace(/^https?:\/\//, '');
                      return (
                        <span
                          key={id}
                          className="bg-paper-2 rounded px-1.5 py-0.5 font-mono text-[11px]"
                          title={KIND_LABEL[src.kind]}
                        >
                          {ad}
                        </span>
                      );
                    })}
                    {c.sourceIds.length === 0 && <span className="text-declared">kaynak yok</span>}
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

        {approved && (
          <div className="border-line mt-6 border-t pt-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">Paylaşılabilir kart</span>
              <button
                disabled={busy === 'share'}
                onClick={() =>
                  void run('share', () =>
                    api('/api/me/card/share', {
                      method: 'POST',
                      body: JSON.stringify({ enabled: !card.talent.publicSlug }),
                    }),
                  )
                }
                className="border-line hover:bg-paper-2 rounded-lg border px-3 py-1 text-xs font-semibold disabled:opacity-50"
              >
                {card.talent.publicSlug ? 'Kapat' : 'Aç'}
              </button>
              {card.talent.publicSlug && (
                <a
                  href={`/k/${card.talent.publicSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent font-mono text-xs hover:underline"
                >
                  {window.location.origin}/k/{card.talent.publicSlug}
                </a>
              )}
            </div>
            <p className="text-ink-soft mt-1 text-xs">
              Linki bilen görür: yalnız onaylı iddialar ve kanıt seviyeleri; e-posta ve GitHub adı
              yok. Kapatınca link ölür.
            </p>
          </div>
        )}
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

/**
 * Canlı ürün kaynağı: adres ekle → token al → siteye meta etiketi ya da well-known dosyası
 * koy → doğrula. Doğrulanana kadar kaynak "beyan" seviyesindedir.
 */
function LiveUrlBlock({
  sources,
  busy,
  run,
}: {
  sources: Source[];
  busy: string | null;
  run: (key: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  return (
    <div className="border-line mt-3 rounded-xl border p-4">
      <div className="font-semibold">Canlı ürün</div>
      <div className="text-ink-soft text-xs">
        Yayında olan bir site ya da uygulama. Sahipliğini bir etiketle kanıtlarsın.
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run('url', () =>
            api('/api/me/evidence/url', { method: 'POST', body: JSON.stringify({ url }) }),
          ).then(() => setUrl(''));
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="border-line focus:border-accent flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none"
        />
        <button
          disabled={busy === 'url'}
          className="bg-ink text-paper rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          Ekle
        </button>
      </form>
      <ul className="mt-3 space-y-3 text-sm">
        {sources.map((s) => (
          <li key={s.id} className="border-line rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-xs">{s.ref}</span>
              <span
                className={`text-xs font-semibold ${s.ownershipVerified ? 'text-verified' : 'text-declared'}`}
              >
                {s.ownershipVerified ? 'Doğrulandı' : 'Doğrulanmadı'}
              </span>
            </div>
            {!s.ownershipVerified && s.verifyToken && (
              <div className="mt-2 text-xs">
                <div className="text-ink-soft">Sitenin &lt;head&gt; kısmına ekle:</div>
                <code className="bg-paper-2 mt-1 block overflow-x-auto rounded p-2">{`<meta name="evidex-verify" content="${s.verifyToken}">`}</code>
                <div className="text-ink-soft mt-1">
                  ya da <code>/.well-known/evidex.txt</code> dosyasına <code>{s.verifyToken}</code>{' '}
                  yaz.
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={busy === s.id}
                    onClick={() =>
                      void run(s.id, () =>
                        api(`/api/me/evidence/url/${s.id}/verify`, { method: 'POST' }),
                      )
                    }
                    className="bg-accent text-paper rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-50"
                  >
                    Doğrula
                  </button>
                  <button
                    onClick={() =>
                      void run(s.id, () =>
                        api(`/api/me/evidence/sources/${s.id}`, { method: 'DELETE' }),
                      )
                    }
                    className="text-ink-soft text-xs hover:text-red-600"
                  >
                    Kaldır
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Belge (PDF) kanıtı: sertifika, yarışma belgesi, staj yazısı. Dosya saklanmaz; sinyal çıkar,
 * iddia "belgeli" seviyesinde gelir. 5 MB, 30 sayfa sınırı sunucuda.
 */
function DocumentBlock({
  sources,
  busy,
  run,
}: {
  sources: Source[];
  busy: string | null;
  run: (key: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  async function upload(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    await run('doc', () =>
      fetch('/api/me/evidence/document', { method: 'POST', body: fd, credentials: 'include' }).then(
        async (r) => {
          const b = (await r.json()) as { ok: boolean; error?: { message: string } };
          if (!b.ok) throw new Error(b.error?.message ?? 'Yüklenemedi');
        },
      ),
    );
    if (inputRef.current) inputRef.current.value = '';
  }
  return (
    <div className="border-line mt-3 rounded-xl border p-4">
      <div className="font-semibold">Belge</div>
      <div className="text-ink-soft text-xs">
        Sertifika, yarışma belgesi, staj yazısı (PDF). Dosya saklanmaz; ne olduğu okunur, iddia
        "belgeli" seviyesinde gelir.
      </div>
      <ul className="mt-2 space-y-1">
        {sources.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span className="truncate font-mono text-xs">{s.ref.split('#')[0]}</span>
            <span className="text-documented text-xs">belgeli</span>
            <button
              onClick={() =>
                void run(s.id, () => api(`/api/me/evidence/sources/${s.id}`, { method: 'DELETE' }))
              }
              className="text-ink-soft ml-auto text-xs hover:text-red-600"
            >
              Kaldır
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-3 inline-block">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <span
          className={`border-line hover:bg-paper-2 inline-block cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold ${busy === 'doc' ? 'opacity-50' : ''}`}
        >
          {busy === 'doc' ? 'Okunuyor…' : 'PDF yükle'}
        </span>
      </label>
    </div>
  );
}

function BulkBtn({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-line hover:bg-paper-2 rounded-lg border px-2 py-1 font-semibold ${danger ? 'text-red-600' : ''}`}
    >
      {label}
    </button>
  );
}
