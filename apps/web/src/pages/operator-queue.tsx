import { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter, Live } from '../components/motion';
import { Button, Empty, ErrorNote, Eyebrow, Panel, Skeleton, Textarea } from '../components/ui';

type Action = 'publish_shortlist' | 'introduce' | 'send_follow_up' | 'invite';
interface QueueItem {
  id: string;
  action: Action;
  subjectType: string;
  subjectId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

const ACTION: Record<Action, { label: string; sonuc: string }> = {
  publish_shortlist: {
    label: 'Kısa listeyi aç',
    sonuc:
      'Kurum adayları ilk adla ve gerekçeyle görür; güçlü adaylara "kartın eşleşti" e-postası gider.',
  },
  introduce: {
    label: 'Tanıştır',
    sonuc:
      'Aşağıdaki e-posta gence ve kurum üyelerine gider; kurum tam kartı görür; iş birliği kaydı açılır.',
  },
  send_follow_up: {
    label: 'Takip sorusu gönder',
    sonuc:
      'İki tarafa tek kullanımlık linkli e-posta gider; cevaplar iş birlikleri ekranına düşer.',
  },
  invite: { label: 'Ağa davet et', sonuc: 'Listedeki adreslere davet e-postası gider.' },
};
/** Hangi payload alanları düzenlenebilir (metin). Alıcı/özne düzenlenmez. */
const EDITABLE: Record<Action, { key: string; label: string; rows?: number }[]> = {
  publish_shortlist: [],
  introduce: [
    { key: 'subject', label: 'Konu' },
    { key: 'message', label: 'Mesaj', rows: 8 },
  ],
  send_follow_up: [
    { key: 'subject', label: 'Konu' },
    { key: 'messageTalent', label: 'Gence', rows: 6 },
    { key: 'messageOrganization', label: 'Kuruma', rows: 6 },
  ],
  invite: [
    { key: 'subject', label: 'Konu' },
    { key: 'message', label: 'Mesaj', rows: 6 },
  ],
};
const yas = (iso: string) => {
  const dk = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return dk < 60
    ? `${dk} dk`
    : dk < 1440
      ? `${Math.round(dk / 60)} sa`
      : `${Math.round(dk / 1440)} gün`;
};

/**
 * Onay kuyruğu (ADR-0004): solda filtrelenebilir liste, sağda karar paneli. Onay = yürüt;
 * düzenle = açık mod (kaydet/vazgeç); ret = hiçbir şey olmaz. Kayıt yalnız sunucu onayından
 * sonra listeden çıkar; hata olursa yerinde kalır. Klavye: ↑/↓ kayıt, A onay, R ret, E düzenle.
 */
export function OperatorQueuePage() {
  useTitle('Onay kuyruğu');
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [filter, setFilter] = useState<Action | 'all'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);

  async function load() {
    const list = await api<QueueItem[]>('/api/operator/queue');
    setItems(list);
    return list;
  }
  useEffect(() => {
    void load().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'Kuyruk yüklenemedi'),
    );
  }, []);

  const gorunen = useMemo(
    () => (items ?? []).filter((i) => filter === 'all' || i.action === filter),
    [items, filter],
  );
  const secili = gorunen.find((i) => i.id === selected) ?? gorunen[0] ?? null;

  async function decide(decision: 'approve' | 'reject' | 'edit') {
    if (!secili) return;
    if (
      edit &&
      !window.confirm(
        'Kaydedilmemiş düzenleme var. Onaylamadan önce kaydedilsin mi? (İptal: düzenlemeyi at)',
      )
    )
      setEdit(null);
    setBusy(decision);
    setError(null);
    try {
      await api(`/api/operator/queue/${secili.id}`, {
        method: 'POST',
        body: JSON.stringify(
          decision === 'edit' ? { decision: 'edit', editedPayload: edit ?? {} } : { decision },
        ),
      });
      // Yalnız sunucu onayından sonra listeden çıkar; sıradaki seçilir, sonuç duyurulur.
      const idx = gorunen.findIndex((i) => i.id === secili.id);
      const list = await load();
      const kalan = list.filter((i) => filter === 'all' || i.action === filter);
      setSelected(kalan[Math.min(idx, kalan.length - 1)]?.id ?? null);
      setEdit(null);
      setLive(
        decision === 'reject'
          ? `${ACTION[secili.action].label} reddedildi; hiçbir şey gönderilmedi.`
          : `${ACTION[secili.action].label} ${decision === 'edit' ? 'düzenlenerek ' : ''}onaylandı ve yürütüldü.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Karar kaydedilemedi; kayıt yerinde duruyor.');
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
      if (!secili) return;
      const idx = gorunen.findIndex((i) => i.id === secili.id);
      if (e.key === 'ArrowDown')
        setSelected(gorunen[Math.min(idx + 1, gorunen.length - 1)]?.id ?? null);
      if (e.key === 'ArrowUp') setSelected(gorunen[Math.max(idx - 1, 0)]?.id ?? null);
      if (e.key.toLowerCase() === 'a' && !edit) void decide('approve');
      if (e.key.toLowerCase() === 'r' && !edit) void decide('reject');
      if (e.key.toLowerCase() === 'e' && EDITABLE[secili.action].length) setEdit(baslangic(secili));
      if (e.key === 'Escape') setEdit(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (error && !items) return <ErrorNote>{error}</ErrorNote>;
  if (!items) return <Skeleton rows={5} />;

  const sayilar = Object.fromEntries(
    (['all', ...Object.keys(ACTION)] as const).map((k) => [
      k,
      k === 'all' ? items.length : items.filter((i) => i.action === k).length,
    ]),
  );

  return (
    <div>
      <Live message={live} />
      <Enter i={0} as="header" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
            Onay kuyruğu
          </h1>
          <p className="text-ink-soft mt-1">
            Ajanın dışa dönük her önerisi burada bekler. Sen onaylamadan hiçbir mesaj gitmez, hiçbir
            liste açılmaz.
          </p>
        </div>
        <div className="text-ink-soft hidden text-xs md:block">
          ↑↓ kayıt · A onayla · R reddet · E düzenle
        </div>
      </Enter>

      <Enter i={1} as="div" className="mt-5 flex flex-wrap gap-1">
        {(['all', ...(Object.keys(ACTION) as Action[])] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            onClick={() => {
              setFilter(k);
              setSelected(null);
              setEdit(null);
            }}
            className={`pressable min-h-9 rounded-full px-3 text-sm font-semibold ${filter === k ? 'bg-ink text-surface' : 'bg-surface border-line text-ink-soft hover:text-ink border'}`}
          >
            {k === 'all' ? 'Tümü' : ACTION[k].label}{' '}
            <span className="tnum opacity-70">{sayilar[k]}</span>
          </button>
        ))}
      </Enter>

      {items.length === 0 ? (
        <div className="mt-6">
          <Empty title="Bekleyen dış eylem yok">
            Ajan bir kısa liste, tanıştırma, takip sorusu ya da davet önerdiğinde burada görünür.
          </Empty>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(320px,40fr)_60fr]">
          <Enter i={2} as="section" className="min-w-0">
            <ul
              className="bg-surface border-line divide-y divide-[var(--color-line)] rounded-[var(--radius-panel)] border"
              role="listbox"
              aria-label="Kuyruk"
            >
              {gorunen.map((it) => {
                const on = secili?.id === it.id;
                return (
                  <li key={it.id} role="option" aria-selected={on}>
                    <button
                      onClick={() => {
                        setSelected(it.id);
                        setEdit(null);
                      }}
                      className={`pressable flex w-full flex-col gap-0.5 px-4 py-3 text-left ${on ? 'bg-accent-soft' : 'hover:bg-paper-2'}`}
                    >
                      <div className="flex w-full items-center gap-2">
                        <span
                          className={`text-xs font-bold ${on ? 'text-accent-strong' : 'text-ink-soft'}`}
                        >
                          {ACTION[it.action].label}
                        </span>
                        <span className="text-ink-soft tnum ml-auto text-xs">
                          {yas(it.createdAt)}
                        </span>
                      </div>
                      <div className="text-ink truncate text-sm font-semibold">{konu(it)}</div>
                    </button>
                  </li>
                );
              })}
              {gorunen.length === 0 && (
                <li className="text-ink-soft px-4 py-6 text-sm">Bu türde bekleyen yok.</li>
              )}
            </ul>
          </Enter>

          <section className="min-w-0" aria-live="off">
            {secili && (
              <Panel key={secili.id} className="pane-enter p-6">
                <Eyebrow>{ACTION[secili.action].label}</Eyebrow>
                <h2 className="text-ink mt-1 text-xl font-bold tracking-[-0.02em]">
                  {konu(secili)}
                </h2>
                <p className="text-ink-soft mt-2 text-sm">{ACTION[secili.action].sonuc}</p>

                <div className="mt-5">
                  <Eyebrow>Ajanın önerisi</Eyebrow>
                  <div className="mt-2">
                    {edit ? (
                      <div className="grid gap-4">
                        {EDITABLE[secili.action].map((f) => (
                          <label key={f.key} className="block">
                            <span className="text-ink text-sm font-semibold">{f.label}</span>
                            {f.rows ? (
                              <Textarea
                                rows={f.rows}
                                value={edit[f.key] ?? ''}
                                onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}
                                className="mt-1.5"
                              />
                            ) : (
                              <input
                                value={edit[f.key] ?? ''}
                                onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}
                                className="border-line bg-surface focus:border-accent mt-1.5 w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 text-base outline-none"
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <Payload item={secili} />
                    )}
                  </div>
                </div>

                {error && <ErrorNote>{error}</ErrorNote>}
                <div className="border-line mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
                  {edit ? (
                    <>
                      <Button
                        variant="primary"
                        pending={busy === 'edit'}
                        pendingText="Kaydedilip yürütülüyor…"
                        onClick={() => void decide('edit')}
                      >
                        <Check size={16} aria-hidden /> Düzenlemeyle onayla
                      </Button>
                      <Button variant="tertiary" onClick={() => setEdit(null)}>
                        Düzenlemeyi at
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        pending={busy === 'approve'}
                        pendingText="Yürütülüyor…"
                        onClick={() => void decide('approve')}
                      >
                        <Check size={16} aria-hidden /> Onayla
                      </Button>
                      {EDITABLE[secili.action].length > 0 && (
                        <Button onClick={() => setEdit(baslangic(secili))}>
                          <Pencil size={14} aria-hidden /> Düzenle
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        pending={busy === 'reject'}
                        pendingText="…"
                        onClick={() => void decide('reject')}
                        className="ml-auto"
                      >
                        <X size={16} aria-hidden /> Reddet
                      </Button>
                    </>
                  )}
                </div>
              </Panel>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function baslangic(it: QueueItem): Record<string, string> {
  return Object.fromEntries(
    EDITABLE[it.action].map((f) => [f.key, String(it.payload[f.key] ?? '')]),
  );
}
function konu(it: QueueItem): string {
  const p = it.payload;
  if (it.action === 'publish_shortlist') return String(p.needTitle ?? 'İhtiyaç');
  if (it.action === 'invite')
    return `${String(p.source ?? 'Liste')} · ${(p.emails as string[] | undefined)?.length ?? 0} kişi`;
  return String(p.subject ?? p.needTitle ?? '');
}

/** Tam giden yük: alıcılar ve metin. Operatör ne gideceğini görmeden onaylamaz. */
function Payload({ item }: { item: QueueItem }) {
  const p = item.payload;
  if (item.action === 'publish_shortlist') {
    const c = (p.counts ?? {}) as { strong?: number; possible?: number; weak?: number };
    return (
      <div className="bg-paper-2 rounded-[var(--radius-control)] p-4 text-sm">
        <div className="text-ink font-semibold">{String(p.needTitle ?? 'İhtiyaç')}</div>
        <div className="text-ink-soft tnum mt-1">
          {c.strong ?? 0} güçlü · {c.possible ?? 0} olası · {c.weak ?? 0} zayıf aday
        </div>
        <div className="text-ink-soft mt-1 text-xs">
          Gerekçeler ajanın; kurum yalnız ilk ad görür.
        </div>
      </div>
    );
  }
  if (item.action === 'introduce')
    return (
      <Mektup
        konu={String(p.subject ?? '')}
        govde={String(p.message ?? '')}
        kime="Genç + kurum üyeleri"
        not={p.requestedBy === 'organization' ? 'Kurum istedi · ajan taslağı' : undefined}
      />
    );
  if (item.action === 'send_follow_up')
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Mektup konu={String(p.subject ?? '')} govde={String(p.messageTalent ?? '')} kime="Gence" />
        <Mektup
          konu={String(p.subject ?? '')}
          govde={String(p.messageOrganization ?? '')}
          kime="Kuruma"
        />
        <p className="text-ink-soft text-xs md:col-span-2">
          [link] yerine tek kullanımlık cevap linki girer.
        </p>
      </div>
    );
  const emails = (p.emails ?? []) as string[];
  const adaylar = (p.candidates ?? []) as {
    login: string;
    url: string;
    fit: 'strong' | 'possible';
    why: string;
    email: string | null;
  }[];
  return (
    <div className="grid gap-3">
      <Mektup
        konu={String(p.subject ?? '')}
        govde={String(p.message ?? '')}
        kime={`${emails.length} adres${Number(p.skipped ?? 0) > 0 ? ` · ${String(p.skipped)} zaten ağda` : ''}`}
      />
      <p className="text-ink-soft font-mono text-xs">
        {emails.slice(0, 10).join(', ')}
        {emails.length > 10 ? ` … +${emails.length - 10}` : ''}
      </p>
      {adaylar.length > 0 && (
        <ul className="space-y-1 text-sm">
          {adaylar.map((c) => (
            <li key={c.login}>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="text-ink font-mono font-semibold hover:underline"
              >
                @{c.login}
              </a>{' '}
              <span className={c.fit === 'strong' ? 'text-verified' : 'text-accent-strong'}>
                {c.fit === 'strong' ? 'güçlü' : 'olası'}
              </span>{' '}
              <span className="text-ink-soft">— {c.why}</span>
              {!c.email && <span className="text-declared"> · e-posta yok, elle ulaş</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function Mektup({
  konu,
  govde,
  kime,
  not,
}: {
  konu: string;
  govde: string;
  kime: string;
  not?: string | undefined;
}) {
  return (
    <div className="border-line rounded-[var(--radius-control)] border p-4 text-sm">
      <div className="text-ink-soft flex flex-wrap gap-x-3 text-xs">
        <span>
          Kime: <b className="text-ink">{kime}</b>
        </span>
        {not && <span>· {not}</span>}
      </div>
      <div className="text-ink mt-1 font-semibold">{konu}</div>
      <p className="text-ink mt-2 whitespace-pre-wrap">{govde}</p>
    </div>
  );
}
