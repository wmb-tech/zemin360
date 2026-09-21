import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { THRESHOLDS, type EvidenceLevel, type EvidenceSourceKind } from '@evidex/shared';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter, Live } from '../components/motion';
import {
  Button,
  Empty,
  ErrorNote,
  Eyebrow,
  Input,
  LevelBadge,
  LinkButton,
  Panel,
  Skeleton,
  Skills,
  type SkillRow,
  SourceChip,
} from '../components/ui';

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
  kind: EvidenceSourceKind;
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
    city: string | null;
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
  skills: SkillRow[];
}

const ay = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }) : null;

type Zone = 'kaynaklar' | 'iddialar' | 'kart' | 'paylas';
type Run = (key: string, fn: () => Promise<unknown>) => Promise<boolean>;

/**
 * Gencin kartı (doğrula 02). Dört bölge: Kaynaklar · İddiaları incele · Kart · Paylaşım.
 * Onaysız hiçbir şey ağa girmez. Sunucu onaylamadan hiçbir satır "onaylı" görünmez; hata
 * durumunda satır yerinde kalır ve hata yanında yazar (docs/redesign/03 §transition matrix).
 */
export function TalentCardPage() {
  useTitle('Kartım');
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [settled, setSettled] = useState<Set<string>>(new Set()); // sunucu onayı sonrası vurgu
  const zone = (params.get('bolum') as Zone | null) ?? 'iddialar';
  const setZone = (z: Zone) => {
    const p = new URLSearchParams(params);
    if (z === 'iddialar') p.delete('bolum');
    else p.set('bolum', z);
    setParams(p, { replace: true });
  };

  async function load() {
    setCard(await api<Card>('/api/me/card'));
  }
  useEffect(() => {
    void load().catch((e: unknown) =>
      setError({ key: 'load', message: e instanceof Error ? e.message : 'Kart yüklenemedi' }),
    );
  }, []);

  // Kurulumdan dönüşte okuma kendiliğinden başlar; sonraki okumalar haftalık zamanlayıcıda.
  const otoBasladi = useRef(false);
  useEffect(() => {
    if (!card || !params.get('installed') || otoBasladi.current) return;
    otoBasladi.current = true;
    void run('sync', () => api('/api/me/evidence/github/sync', { method: 'POST' }));
  }, [card, params]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      const r = (await fn()) as
        { skippedOrgRepos?: number; unreadRepos?: number; failedRepos?: number } | undefined;
      const notlar: string[] = [];
      if (r?.skippedOrgRepos)
        notlar.push(
          `${r.skippedOrgRepos} org reposu atlandı: commit'in olmayan repo kanıt sayılmaz.`,
        );
      if (r?.failedRepos)
        notlar.push(`${r.failedRepos} repo okunamadı (boş, arşivli ya da erişim yok); atlandı.`);
      if (r?.unreadRepos)
        notlar.push(
          `Bu turda 40 repo okundu; ${r.unreadRepos} repo daha var. "Yeniden oku" sıradakileri getirir.`,
        );
      if (notlar.length) setNote(notlar.join(' '));
      await load();
      return true;
    } catch (err) {
      setError({ key, message: err instanceof Error ? err.message : 'İşlem tamamlanamadı' });
      return false;
    } finally {
      setBusy(null);
    }
  }
  /** Onay/sil sonrası satır vurgusu: yalnız sunucu "tamam" dedikten sonra. */
  function vurgula(ids: string[]) {
    setSettled(new Set(ids));
    window.setTimeout(() => setSettled(new Set()), 400);
  }
  async function toplu(action: 'approve' | 'unapprove' | 'delete') {
    const ids = [...secili];
    if (action === 'delete' && !window.confirm(`${ids.length} iddia silinsin mi? Geri alınamaz.`))
      return;
    const ok = await run('bulk', () =>
      api('/api/me/card/claims/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) }),
    );
    if (ok) {
      setSecili(new Set());
      if (action !== 'delete') vurgula(ids);
      setNote(
        action === 'delete'
          ? `${ids.length} iddia silindi.`
          : `${ids.length} iddia ${action === 'approve' ? 'onaylandı' : 'taslağa alındı'}.`,
      );
    }
  }
  async function iddiaOnay(c: Claim) {
    const ok = await run(c.id, () =>
      api(`/api/me/card/claims/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ approved: !c.approved }),
      }),
    );
    if (ok) vurgula([c.id]);
  }

  if (error?.key === 'load') return <ErrorNote>{error.message} — sayfayı yenile.</ErrorNote>;
  if (!card) return <Skeleton rows={6} />;

  const onayli = card.claims.filter((c) => c.approved);
  const taslak = card.claims.filter((c) => !c.approved);
  const agda = card.talent.cardStatus === 'approved';
  const github = card.sources.filter((s) => s.kind === 'github_repo');
  const zones: { key: Zone; label: string; badge?: string | undefined }[] = [
    { key: 'kaynaklar', label: 'Kaynaklar', badge: String(card.sources.length) },
    {
      key: 'iddialar',
      label: 'İddiaları incele',
      badge: taslak.length ? `${taslak.length} taslak` : undefined,
    },
    { key: 'kart', label: agda ? 'Yayındaki kart' : 'Kart' },
    { key: 'paylas', label: 'Paylaşım' },
  ];

  return (
    <div>
      <Live message={note} />
      <Enter i={0} as="header" className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
            Kartım
          </h1>
          <p className="text-ink-soft tnum mt-1">
            {agda ? 'Ağda' : 'Taslak'} · {onayli.length} onaylı iddia · {card.sources.length} kaynak
            {card.talent.silent && (
              <span className="text-declared">
                {' '}
                · {THRESHOLDS.silentCardAfterDays} gündür sessiz
              </span>
            )}
          </p>
        </div>
        {!agda && (
          <Button
            variant="primary"
            disabled={onayli.length === 0}
            pending={busy === 'approve'}
            pendingText="Onaylanıyor…"
            onClick={() =>
              void run('approve', () => api('/api/me/card/approve', { method: 'POST' })).then(
                (ok) => ok && nav('/durum?onay=1'),
              )
            }
            title={onayli.length === 0 ? 'Önce en az bir iddiayı onayla' : undefined}
          >
            Kartı onayla ve ağa gir
          </Button>
        )}
      </Enter>

      {params.get('installed') && (
        <p
          className="bg-verified-soft text-verified mt-4 rounded-[var(--radius-control)] px-4 py-3 text-sm font-semibold"
          aria-live="polite"
        >
          {busy === 'sync'
            ? 'GitHub bağlandı. Repolar okunuyor, ajan kartını yazıyor — yarım dakika sürebilir.'
            : 'GitHub bağlandı. Taslak iddialar aşağıda; doğru olanı onayla, olmayanı sil.'}
        </p>
      )}
      {note && !params.get('installed') && <p className="text-ink-soft mt-3 text-sm">{note}</p>}
      {error && error.key !== 'load' && <ErrorNote>{error.message}</ErrorNote>}

      <Enter i={1} as="div" className="border-line mt-6 flex gap-1 overflow-x-auto border-b">
        {zones.map((z) => (
          <button
            key={z.key}
            onClick={() => setZone(z.key)}
            aria-current={zone === z.key ? 'page' : undefined}
            className={`pressable -mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap ${
              zone === z.key
                ? 'border-accent text-accent-strong'
                : 'text-ink-soft hover:text-ink border-transparent'
            }`}
          >
            {z.label}
            {z.badge && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs ${zone === z.key ? 'bg-accent-soft' : 'bg-paper-2'}`}
              >
                {z.badge}
              </span>
            )}
          </button>
        ))}
      </Enter>

      <Enter i={2} as="section" className="mt-6">
        {zone === 'kaynaklar' && <Kaynaklar card={card} github={github} busy={busy} run={run} />}
        {zone === 'iddialar' && (
          <Iddialar
            card={card}
            onRewrite={() =>
              void run('rewrite', () => api('/api/me/card/rewrite', { method: 'POST' }))
            }
            taslak={taslak}
            onayli={onayli}
            secili={secili}
            setSecili={setSecili}
            settled={settled}
            busy={busy}
            onToggle={iddiaOnay}
            onDelete={(c) =>
              void run(c.id, () => api(`/api/me/card/claims/${c.id}`, { method: 'DELETE' }))
            }
            onEdit={(c, text) =>
              run(c.id, () =>
                api(`/api/me/card/claims/${c.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ text }),
                }),
              )
            }
            onBulk={toplu}
          />
        )}
        {zone === 'kart' && <Kart card={card} onayli={onayli} busy={busy} run={run} />}
        {zone === 'paylas' && (
          <Paylas card={card} busy={busy} run={run} agda={agda} setNote={setNote} />
        )}
      </Enter>
    </div>
  );
}

/* ---------------- Kaynaklar ---------------- */
function Kaynaklar({
  card,
  github,
  busy,
  run,
}: {
  card: Card;
  github: Source[];
  busy: string | null;
  run: Run;
}) {
  const [acik, setAcik] = useState<string | null>(null);
  const grup = (login: string) => github.filter((s) => s.ref.startsWith(`${login}/`));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-paper-2 flex h-10 w-10 items-center justify-center rounded-xl">
            <GitBranch size={20} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-ink font-bold">GitHub</div>
            <div className="text-ink-soft text-sm">
              {card.talent.githubConnected
                ? `${github.length} repo okundu · kod saklanmaz, sinyal çıkarılır`
                : 'Hangi repoları göstereceğini sen seçersin; kod saklanmaz'}
            </div>
          </div>
          {card.talent.githubConnected ? (
            <Button
              size="sm"
              pending={busy === 'sync'}
              pendingText="Okunuyor…"
              onClick={() =>
                void run('sync', () => api('/api/me/evidence/github/sync', { method: 'POST' }))
              }
              title="Kanıt haftada bir kendiliğinden yenilenir"
            >
              Yeniden oku
            </Button>
          ) : (
            <LinkButton variant="primary" href="/api/me/evidence/github/install">
              GitHub'ı bağla
            </LinkButton>
          )}
        </div>
        {card.talent.installations.length > 0 && (
          <ul className="border-line mt-4 divide-y divide-[var(--color-line)] border-t">
            {card.talent.installations.map((i) => {
              const repolar = grup(i.accountLogin);
              const open = acik === i.id;
              return (
                <li key={i.id} className="py-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAcik(open ? null : i.id)}
                      aria-expanded={open}
                      className="text-ink flex min-h-11 flex-1 items-center gap-2 text-left text-sm font-semibold"
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-[var(--duration-quick)] ${open ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                      <span className="font-mono">{i.accountLogin}</span>
                      <span className="text-ink-soft font-normal">
                        · {i.accountType === 'org' ? 'organizasyon' : 'kişisel hesap'} ·{' '}
                        {repolar.length} repo
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        window.confirm(
                          `${i.accountLogin} kurulumu kaldırılsın mı? Bu hesabın repoları karttan çıkar.`,
                        ) &&
                        void run(i.id, () =>
                          api(`/api/me/evidence/github/installations/${i.id}`, {
                            method: 'DELETE',
                          }),
                        )
                      }
                      className="text-ink-soft hover:text-negative flex h-9 w-9 items-center justify-center rounded-lg"
                      aria-label={`${i.accountLogin} kurulumunu kaldır`}
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                  <div className="disclose" data-open={open}>
                    <div>
                      <ul className="grid gap-x-6 pb-2 pl-6 sm:grid-cols-2">
                        {repolar.map((s) => (
                          <li
                            key={s.id}
                            className="text-ink-soft truncate py-0.5 font-mono text-xs"
                          >
                            {s.ref.split('/')[1]}
                          </li>
                        ))}
                        {repolar.length === 0 && (
                          <li className="text-ink-soft py-0.5 text-xs">
                            Bu hesaptan okunmuş repo yok.
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
            <li className="pt-3">
              <a
                href="/api/me/evidence/github/install?target=org"
                className="text-accent inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              >
                <Plus size={14} aria-hidden /> Organizasyon hesabı ekle
              </a>
              <span className="text-ink-soft ml-2 text-xs">
                Üyesi olduğun org'un repoları; sahiplik commit'lerinden ölçülür.
              </span>
            </li>
          </ul>
        )}
      </Panel>

      <CanliUrun
        sources={card.sources.filter((s) => s.kind === 'live_url')}
        busy={busy}
        run={run}
      />
      <Belge sources={card.sources.filter((s) => s.kind === 'document')} busy={busy} run={run} />
      {card.sources.some(
        (s) => s.kind === 'network_reference' || s.kind === 'challenge_submission',
      ) && (
        <Panel className="p-5 lg:col-span-2">
          <div className="text-ink font-bold">Platform içi kanıt</div>
          <p className="text-ink-soft mt-1 text-sm">
            Kurum referansları ve meydan okuma teslimleri; platformda oluştu, kaldırılamaz.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {card.sources
              .filter((s) => s.kind === 'network_reference' || s.kind === 'challenge_submission')
              .map((s) => (
                <li key={s.id}>
                  <SourceChip kind={s.kind} ref={s.ref} />
                </li>
              ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function CanliUrun({ sources, busy, run }: { sources: Source[]; busy: string | null; run: Run }) {
  const [url, setUrl] = useState('');
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-3">
        <div className="bg-paper-2 flex h-10 w-10 items-center justify-center rounded-xl">
          <Globe size={20} aria-hidden />
        </div>
        <div>
          <div className="text-ink font-bold">Canlı ürün</div>
          <div className="text-ink-soft text-sm">
            Yayında olan site ya da uygulama; sahipliğini bir etiketle kanıtlarsın.
          </div>
        </div>
      </div>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void run('url', () =>
            api('/api/me/evidence/url', { method: 'POST', body: JSON.stringify({ url }) }),
          ).then((ok) => ok && setUrl(''));
        }}
        className="mt-4 flex gap-2"
      >
        <Input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          aria-label="Site adresi"
        />
        <Button type="submit" pending={busy === 'url'} pendingText="Ekleniyor…">
          Ekle
        </Button>
      </form>
      <ul className="mt-3 space-y-3">
        {sources.map((s) => (
          <li key={s.id} className="border-line rounded-[var(--radius-control)] border p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-xs">{s.ref}</span>
              <span
                className={`ml-auto text-xs font-bold ${s.ownershipVerified ? 'text-verified' : 'text-declared'}`}
              >
                {s.ownershipVerified ? 'Doğrulandı' : 'Doğrulanmadı'}
              </span>
            </div>
            {!s.ownershipVerified && s.verifyToken && (
              <div className="text-ink-soft mt-2 text-xs">
                Sitenin <code>&lt;head&gt;</code> kısmına ekle:
                <code className="bg-paper-2 mt-1 block overflow-x-auto rounded p-2">{`<meta name="evidex-verify" content="${s.verifyToken}">`}</code>
                ya da <code>/.well-known/evidex.txt</code> dosyasına <code>{s.verifyToken}</code>{' '}
                yaz.
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    pending={busy === `v-${s.id}`}
                    pendingText="Kontrol ediliyor…"
                    onClick={() =>
                      void run(`v-${s.id}`, () =>
                        api(`/api/me/evidence/url/${s.id}/verify`, { method: 'POST' }),
                      )
                    }
                  >
                    Doğrula
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onClick={() =>
                      void run(s.id, () =>
                        api(`/api/me/evidence/sources/${s.id}`, { method: 'DELETE' }),
                      )
                    }
                  >
                    Kaldır
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Belge({ sources, busy, run }: { sources: Source[]; busy: string | null; run: Run }) {
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
    <Panel className="p-5">
      <div className="flex items-center gap-3">
        <div className="bg-paper-2 flex h-10 w-10 items-center justify-center rounded-xl">
          <FileText size={20} aria-hidden />
        </div>
        <div>
          <div className="text-ink font-bold">Belge</div>
          <div className="text-ink-soft text-sm">
            Sertifika, yarışma belgesi, staj yazısı (PDF). Dosya saklanmaz; iddia "belgeli"
            seviyesinde gelir.
          </div>
        </div>
      </div>
      <ul className="mt-3 space-y-1">
        {sources.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span className="truncate font-mono text-xs">{s.ref.split('#')[0]}</span>
            <LevelBadge level="documented" />
            <button
              onClick={() =>
                void run(s.id, () => api(`/api/me/evidence/sources/${s.id}`, { method: 'DELETE' }))
              }
              className="text-ink-soft hover:text-negative ml-auto text-xs"
            >
              Kaldır
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-4 inline-block">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <span
          className={`pressable border-line bg-surface hover:bg-paper-2 inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)] border px-4 text-sm font-semibold ${busy === 'doc' ? 'opacity-50' : ''}`}
        >
          {busy === 'doc' ? 'Okunuyor…' : 'PDF yükle'}
        </span>
      </label>
    </Panel>
  );
}

/* ---------------- İddialar ---------------- */
function Iddialar({
  card,
  taslak,
  onayli,
  secili,
  setSecili,
  settled,
  busy,
  onToggle,
  onDelete,
  onEdit,
  onBulk,
  onRewrite,
}: {
  card: Card;
  taslak: Claim[];
  onayli: Claim[];
  secili: Set<string>;
  setSecili: (s: Set<string>) => void;
  settled: Set<string>;
  busy: string | null;
  onToggle: (c: Claim) => void;
  onDelete: (c: Claim) => void;
  onEdit: (c: Claim, text: string) => Promise<boolean>;
  onBulk: (a: 'approve' | 'unapprove' | 'delete') => void;
  onRewrite: () => void;
}) {
  const toggleSel = (id: string) => {
    const n = new Set(secili);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSecili(n);
  };
  if (card.claims.length === 0)
    return card.sources.length > 0 ? (
      <Empty
        title="İddia yok, kaynak var"
        action={
          <Button
            variant="primary"
            pending={busy === 'rewrite'}
            pendingText="Repolar okunuyor, taslak yazılıyor…"
            onClick={onRewrite}
          >
            Kaynaklardan taslak yaz
          </Button>
        }
      >
        {card.sources.length} kaynak bağlı ama karta yazılmış iddia yok. Ajan bütün repoları güncel
        bağlamla okuyup 3–7 iş maddesi ve yetkinlik setini çıkarır; birkaç dakika sürebilir. Her
        maddeyi sen onaylarsın.
      </Empty>
    ) : (
      <Empty
        title="Henüz iddia yok"
        action={
          <Link to="?bolum=kaynaklar" className="text-accent text-sm font-semibold hover:underline">
            Kaynak bağla →
          </Link>
        }
      >
        GitHub, canlı ürün ya da belge bağlayınca ajan kartının taslağını yazar; her iddiayı sen
        onaylarsın.
      </Empty>
    );
  const grup = (baslik: string, liste: Claim[]) =>
    liste.length === 0 ? null : (
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-ink text-lg font-bold tracking-[-0.02em]">
            {baslik}{' '}
            <span className="text-ink-soft tnum text-base font-semibold">· {liste.length}</span>
          </h2>
          {liste.length > 1 && (
            <button
              onClick={() =>
                setSecili(
                  new Set(liste.every((c) => secili.has(c.id)) ? [] : liste.map((c) => c.id)),
                )
              }
              className="text-accent text-sm font-semibold hover:underline"
            >
              {liste.every((c) => secili.has(c.id)) ? 'Seçimi bırak' : 'Tümünü seç'}
            </button>
          )}
        </div>
        <ul className="mt-3 space-y-3">
          {liste.map((c) => (
            <IddiaSatiri
              key={c.id}
              c={c}
              card={card}
              selected={secili.has(c.id)}
              settled={settled.has(c.id)}
              busy={busy === c.id}
              onSelect={() => toggleSel(c.id)}
              onToggle={() => onToggle(c)}
              onDelete={() => window.confirm('Bu iddia silinsin mi? Geri alınamaz.') && onDelete(c)}
              onEdit={(t) => onEdit(c, t)}
            />
          ))}
        </ul>
      </div>
    );
  return (
    <div className="relative space-y-10">
      {grup('Gözden geçir', taslak)}
      {grup('Onaylı', onayli)}
      <p className="text-ink-soft border-line border-t pt-4 text-xs leading-relaxed">
        İddialar beğenmediğin bir dille yazıldıysa ya da işler birleştirilmediyse kartı sıfırdan
        yazdırabilirsin: mevcut tüm iddialar silinir, bütün repolar güncel bağlamla yeniden okunur
        (birkaç dakika sürebilir), yeni taslak çıkar; onaylı kart yeni taslağı onaylayana kadar
        taslağa döner.{' '}
        <button
          onClick={() =>
            window.confirm(
              `${card.claims.length} iddia silinip kart yeniden yazılacak. Onaylı kart, yeni taslağı onaylayana kadar taslağa döner. Devam?`,
            ) && onRewrite()
          }
          disabled={busy === 'rewrite'}
          className="text-accent font-semibold hover:underline disabled:opacity-50"
        >
          {busy === 'rewrite' ? 'Yazılıyor…' : 'Kartı yeniden yaz'}
        </button>
      </p>
      {secili.size > 0 && (
        <div
          className="bg-ink text-surface sticky bottom-20 z-10 flex flex-wrap items-center gap-2 rounded-[var(--radius-panel)] px-4 py-3 shadow-lg md:bottom-4"
          role="toolbar"
          aria-label="Toplu işlem"
        >
          <span className="tnum text-sm font-semibold">{secili.size} seçili</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => onBulk('approve')}
              className="pressable bg-surface text-ink rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-semibold"
            >
              Onayla
            </button>
            <button
              onClick={() => onBulk('unapprove')}
              className="pressable rounded-[var(--radius-control)] border border-white/30 px-3 py-1.5 text-sm font-semibold"
            >
              Taslağa al
            </button>
            <button
              onClick={() => onBulk('delete')}
              className="pressable rounded-[var(--radius-control)] border border-white/30 px-3 py-1.5 text-sm font-semibold"
            >
              Sil
            </button>
            <button
              onClick={() => setSecili(new Set())}
              className="text-surface/80 px-2 text-sm"
              aria-label="Seçimi bırak"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function IddiaSatiri({
  c,
  card,
  selected,
  settled,
  busy,
  onSelect,
  onToggle,
  onDelete,
  onEdit,
}: {
  c: Claim;
  card: Card;
  selected: boolean;
  settled: boolean;
  busy: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (t: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.text);
  return (
    <li
      className={`bg-surface rounded-[var(--radius-panel)] border p-4 ${settled ? 'settle' : ''} ${selected ? 'border-accent' : 'border-line'}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label="Seç"
          className="accent-accent mt-1 h-5 w-5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={600}
                className="border-line focus:border-accent w-full rounded-[var(--radius-control)] border px-3 py-2 text-base outline-none"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  pending={busy}
                  pendingText="Kaydediliyor…"
                  onClick={() => void onEdit(draft.trim()).then((ok) => ok && setEditing(false))}
                >
                  Kaydet
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  onClick={() => {
                    setDraft(c.text);
                    setEditing(false);
                  }}
                >
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-ink text-base leading-relaxed">{c.text}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LevelBadge level={c.level} />
            {c.periodStart && (
              <span className="text-ink-soft tnum text-sm">
                {ay(c.periodStart)} → {ay(c.periodEnd) ?? 'devam'}
              </span>
            )}
            {c.sourceIds.map((id) => {
              const s = card.sources.find((x) => x.id === id);
              return s ? <SourceChip key={id} kind={s.kind} ref={s.ref} /> : null;
            })}
            {c.sourceIds.length === 0 && <span className="text-declared text-xs">kaynak yok</span>}
          </div>
          {c.draftText && c.draftText !== c.text && (
            <p className="text-ink-soft mt-1 text-xs">Ajan taslağı düzenlendi.</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!c.approved ? (
            <Button
              size="sm"
              variant="primary"
              pending={busy}
              pendingText="…"
              onClick={onToggle}
              aria-label="Onayla"
            >
              <Check size={16} aria-hidden /> Onayla
            </Button>
          ) : (
            <button
              onClick={onToggle}
              disabled={busy}
              className="text-verified inline-flex min-h-9 items-center gap-1 text-sm font-bold"
              title="Taslağa geri al"
            >
              <Check size={16} aria-hidden /> Onaylı
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-ink-soft hover:text-ink hover:bg-paper-2 h-9 rounded-lg px-2 text-sm"
            >
              Düzenle
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={busy}
            className="text-ink-soft hover:text-negative hover:bg-negative-soft flex h-9 w-9 items-center justify-center rounded-lg"
            aria-label="Sil"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

/* ---------------- Kart (önizleme) ---------------- */
function Kart({
  card,
  onayli,
  busy,
  run,
}: {
  card: Card;
  onayli: Claim[];
  busy: string | null;
  run: Run;
}) {
  return (
    <Panel className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Yetkinlik kartı</Eyebrow>
          <h2 className="text-ink mt-1 text-2xl font-extrabold tracking-[-0.02em]">
            {card.user.name}
          </h2>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-bold ${card.talent.cardStatus === 'approved' ? 'bg-verified-soft text-verified' : 'bg-declared-soft text-declared'}`}
        >
          {card.talent.cardStatus === 'approved' ? 'Ağda' : 'Taslak'}
        </span>
      </div>
      <Duzenlenebilir
        value={card.talent.headline}
        placeholder="Başlık — ör. Full-stack web ve mobil geliştirici"
        busy={busy === 'headline'}
        onSave={(v) =>
          void run('headline', () =>
            api('/api/me/card', { method: 'PATCH', body: JSON.stringify({ headline: v }) }),
          )
        }
        className="mt-3 text-lg font-semibold"
      />
      <Duzenlenebilir
        value={card.talent.city}
        placeholder="Şehir — yerinde/hibrit ihtiyaçlarda eşleşme gerekçesine girer"
        busy={busy === 'city'}
        onSave={(v) =>
          void run('city', () =>
            api('/api/me/card', { method: 'PATCH', body: JSON.stringify({ city: v }) }),
          )
        }
        className="text-ink-soft mt-1 text-sm"
      />
      <Duzenlenebilir
        value={card.talent.story}
        placeholder="Hikâye — kanıttan otomatik yazılır, sen düzeltirsin"
        busy={busy === 'story'}
        multiline
        onSave={(v) =>
          void run('story', () =>
            api('/api/me/card', { method: 'PATCH', body: JSON.stringify({ story: v }) }),
          )
        }
        className="text-ink-soft mt-2 max-w-[70ch] leading-relaxed"
      />
      {card.skills.length > 0 && (
        <>
          <h3 className="text-ink-soft mt-8 text-xs font-bold tracking-wide uppercase">
            Yetkinlikler · kanıttan ölçülmüş
          </h3>
          <p className="text-ink-soft mt-1 text-xs">
            Onaylı iddiaların kaynaklarından otomatik çıkar; elle yazılmaz, bu yüzden düzenlenmez.
          </p>
          <div className="mt-3">
            <Skills skills={card.skills} />
          </div>
        </>
      )}
      <h3 className="text-ink-soft mt-8 text-xs font-bold tracking-wide uppercase">
        Onaylı iddialar · {onayli.length}
      </h3>
      {onayli.length === 0 ? (
        <p className="text-ink-soft mt-2 text-sm">
          Henüz onaylı iddia yok; "İddiaları incele" bölümünden onayla.
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-[var(--color-line)]">
          {onayli.map((c, i) => (
            <li key={c.id} className="flex gap-4 py-4">
              <span className="text-ink-soft tnum w-6 shrink-0 pt-0.5 text-sm font-semibold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p className="text-ink leading-relaxed">{c.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <LevelBadge level={c.level} />
                  {c.periodStart && (
                    <span className="text-ink-soft tnum text-sm">
                      {ay(c.periodStart)} → {ay(c.periodEnd) ?? 'devam'}
                    </span>
                  )}
                  {c.sourceIds.map((id) => {
                    const s = card.sources.find((x) => x.id === id);
                    return s ? <SourceChip key={id} kind={s.kind} ref={s.ref} /> : null;
                  })}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="text-ink-soft mt-6 text-xs">
        Kurumlar tanıştırmaya kadar yalnız ilk adını ve gerekçeyi görür; tam kart tanıştırma sonrası
        açılır.
      </p>
    </Panel>
  );
}

function Duzenlenebilir({
  value,
  placeholder,
  busy,
  multiline,
  onSave,
  className = '',
}: {
  value: string | null;
  placeholder: string;
  busy: boolean;
  multiline?: boolean;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  if (!editing)
    return (
      <button
        onClick={() => setEditing(true)}
        className={`hover:bg-paper-2 -mx-2 block w-full rounded-lg px-2 py-1 text-left ${value ? '' : 'text-declared'} ${className}`}
        title="Düzenlemek için tıkla"
      >
        {value ?? placeholder}
      </button>
    );
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className={`mt-1 flex flex-col gap-2 ${multiline ? '' : 'sm:flex-row'}`}>
      <Tag
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={multiline ? 4 : undefined}
        className="border-line focus:border-accent w-full rounded-[var(--radius-control)] border px-3 py-2 text-base outline-none"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          pending={busy}
          pendingText="…"
          onClick={() => {
            if (draft.trim() && draft !== value) onSave(draft.trim());
            setEditing(false);
          }}
        >
          Kaydet
        </Button>
        <Button
          size="sm"
          variant="tertiary"
          onClick={() => {
            setDraft(value ?? '');
            setEditing(false);
          }}
        >
          Vazgeç
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Paylaşım ---------------- */
function Paylas({
  card,
  busy,
  run,
  agda,
  setNote,
}: {
  card: Card;
  busy: string | null;
  run: Run;
  agda: boolean;
  setNote: (s: string) => void;
}) {
  const link = card.talent.publicSlug
    ? `${window.location.origin}/k/${card.talent.publicSlug}`
    : null;
  return (
    <Panel className="p-6">
      <h2 className="text-ink text-lg font-bold tracking-[-0.02em]">Paylaşılabilir kart</h2>
      <p className="text-ink-soft mt-1 max-w-prose text-sm">
        Linki bilen görür: yalnız onaylı iddialar ve kanıt seviyeleri; e-posta ve GitHub adı yok.
        Kapatınca link ölür, yeniden açınca yeni link üretilir.
      </p>
      {!agda ? (
        <p className="text-ink-soft mt-4 text-sm">Paylaşım için önce kartını onayla.</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant={link ? 'secondary' : 'primary'}
            pending={busy === 'share'}
            pendingText="…"
            onClick={() =>
              void run('share', () =>
                api('/api/me/card/share', {
                  method: 'POST',
                  body: JSON.stringify({ enabled: !card.talent.publicSlug }),
                }),
              )
            }
          >
            {link ? 'Paylaşımı kapat' : 'Paylaşımı aç'}
          </Button>
          {link && (
            <>
              <code className="bg-paper-2 rounded-[var(--radius-control)] px-3 py-2 text-sm">
                {link}
              </code>
              <Button
                size="sm"
                onClick={() =>
                  void navigator.clipboard.writeText(link).then(() => setNote('Link kopyalandı.'))
                }
              >
                Kopyala
              </Button>
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="text-accent inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              >
                Aç <ExternalLink size={14} aria-hidden />
              </a>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
