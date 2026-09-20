import { useEffect, useState, type FormEvent } from 'react';
import { THRESHOLDS, type EvidenceLevel } from '@evidex/shared';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Button, Empty, ErrorNote, Eyebrow, Skeleton } from '../components/ui';
import { Enter, Live } from '../components/motion';
import { NeedPicker } from '../components/need-picker';

interface TalentRow {
  id: string;
  name: string;
  githubLogin: string | null;
  cardStatus: 'draft' | 'approved';
  lastSignalAt: string | null;
  githubConnected: boolean;
  sources: number;
  claims: Record<EvidenceLevel, number>;
  approvedClaims: number;
  silent: boolean;
}
interface OrgRow {
  id: string;
  name: string;
  city: string | null;
  approved: boolean;
  needs: number;
  members: number;
}
interface Overview {
  talents: TalentRow[];
  organizations: OrgRow[];
  silentTalents: number;
}

const LEVEL: { key: EvidenceLevel; label: string; cls: string }[] = [
  { key: 'verified', label: 'doğrulanmış', cls: 'bg-verified' },
  { key: 'documented', label: 'belgeli', cls: 'bg-documented' },
  { key: 'referenced', label: 'referanslı', cls: 'bg-referenced' },
  { key: 'declared', label: 'beyan', cls: 'bg-declared' },
];
const tarih = (s: string | null) => (s ? new Date(s).toLocaleDateString('tr-TR') : '—');

/**
 * Operatörün "Ağ" ekranı (canlı tut 04 + KARAR-10). Gençler: kart durumu, kanıt dağılımı,
 * sessizlik. Kurumlar: referans yetkisi burada verilir; onaysız kurum "tamamlandı" dese de
 * karta referans düşmez.
 */
export function NetworkPage() {
  useTitle('Ağ');
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [view, setView] = useState<'gencler' | 'kurumlar' | 'kesif'>('gencler');

  async function load() {
    setData(await api<Overview>('/api/operator/network'));
  }
  useEffect(() => {
    void load();
  }, []);

  async function approve(o: OrgRow) {
    setBusy(o.id);
    try {
      await api(`/api/operator/network/organizations/${o.id}/approval`, {
        method: 'POST',
        body: JSON.stringify({ approved: !o.approved }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy('refresh');
    setNote(null);
    try {
      const r = await api<{ refreshed: number; failed: number }>('/api/operator/network/refresh', {
        method: 'POST',
      });
      setNote(`${r.refreshed} kart yeniden okundu · ${r.failed} hata`);
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <Skeleton rows={5} />;

  const VIEWS = [
    { key: 'gencler', label: 'Gençler', n: data.talents.length },
    { key: 'kurumlar', label: 'Kurumlar', n: data.organizations.length },
    { key: 'kesif', label: 'Keşif ve davet', n: null },
  ] as const;

  return (
    <div>
      <Live message={note} />
      <Enter i={0} as="header" className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
            Ağ
          </h1>
          <p className="text-ink-soft tnum mt-1">
            {data.talents.length} genç · {data.organizations.length} kurum · {data.silentTalents}{' '}
            sessiz kart. GitHub kaynakları {THRESHOLDS.evidenceRefreshAfterDays} günde bir yeniden
            okunur; {THRESHOLDS.silentCardAfterDays} gündür etkinlik yoksa kart sessiz sayılır.
          </p>
        </div>
        <Button pending={busy === 'refresh'} pendingText="Okunuyor…" onClick={() => void refresh()}>
          Kanıtları şimdi yenile
        </Button>
      </Enter>
      {note && <p className="text-ink-soft mt-3 text-sm">{note}</p>}

      <Enter i={1} as="div" className="border-line mt-5 flex gap-1 border-b">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            aria-current={view === v.key ? 'page' : undefined}
            className={`pressable -mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${view === v.key ? 'border-accent text-accent-strong' : 'text-ink-soft hover:text-ink border-transparent'}`}
          >
            {v.label}
            {v.n !== null && (
              <span className="tnum bg-paper-2 rounded-md px-1.5 py-0.5 text-xs">{v.n}</span>
            )}
          </button>
        ))}
      </Enter>

      <Enter i={2} as="section" className="mt-6">
        {view === 'gencler' &&
          (data.talents.length === 0 ? (
            <Empty title="Henüz genç yok">GitHub ile giren ilk genç burada görünür.</Empty>
          ) : (
            <div className="bg-surface border-line overflow-x-auto rounded-[var(--radius-panel)] border">
              <table className="w-full text-sm">
                <thead className="bg-paper-2 text-ink-soft text-left text-xs font-bold tracking-wide uppercase">
                  <tr>
                    <th className="px-4 py-3">Genç</th>
                    <th className="px-4 py-3">Kart</th>
                    <th className="px-4 py-3">Kanıt</th>
                    <th className="px-4 py-3">Son etkinlik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {data.talents.map((t) => {
                    const toplam = LEVEL.reduce((a, l) => a + t.claims[l.key], 0);
                    return (
                      <tr key={t.id} className="hover:bg-paper-2/60">
                        <td className="px-4 py-3">
                          <div className="text-ink font-semibold">{t.name}</div>
                          {t.githubLogin && (
                            <div className="text-ink-soft font-mono text-xs">@{t.githubLogin}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-bold ${t.cardStatus === 'approved' ? 'bg-verified-soft text-verified' : 'bg-declared-soft text-declared'}`}
                          >
                            {t.cardStatus === 'approved' ? 'Ağda' : 'Taslak'}
                          </span>
                          {t.silent && (
                            <span className="bg-declared-soft text-declared ml-1 rounded-md px-2 py-0.5 text-xs font-bold">
                              sessiz
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-ink-soft tnum text-xs">
                            {t.sources} kaynak · {t.approvedClaims}/{toplam} iddia onaylı
                          </div>
                          {toplam > 0 && (
                            <div className="mt-1 flex flex-wrap gap-x-2 text-xs">
                              {LEVEL.filter((l) => t.claims[l.key] > 0).map((l) => (
                                <span key={l.key} className="tnum inline-flex items-center gap-1">
                                  <span className={`h-2 w-2 rounded-full ${l.cls}`} />
                                  {t.claims[l.key]} {l.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="text-ink-soft tnum px-4 py-3">
                          {tarih(t.lastSignalAt)}
                          {t.silent && <div className="text-xs">yol: meydan okuma daveti</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        {view === 'kurumlar' &&
          (data.organizations.length === 0 ? (
            <Empty title="Henüz kurum yok">Sihirli linkle giren ilk kurum burada görünür.</Empty>
          ) : (
            <div className="bg-surface border-line overflow-x-auto rounded-[var(--radius-panel)] border">
              <p className="text-ink-soft border-line border-b px-4 py-3 text-xs">
                Referans yetkisi: yalnız onaylı kurumun "tamamlandı" değerlendirmesi gencin kartına
                referans olarak düşer (KARAR-10).
              </p>
              <table className="w-full text-sm">
                <thead className="bg-paper-2 text-ink-soft text-left text-xs font-bold tracking-wide uppercase">
                  <tr>
                    <th className="px-4 py-3">Kurum</th>
                    <th className="px-4 py-3">Şehir</th>
                    <th className="tnum px-4 py-3">İhtiyaç · üye</th>
                    <th className="px-4 py-3">Referans yetkisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {data.organizations.map((o) => (
                    <tr key={o.id} className="hover:bg-paper-2/60">
                      <td className="text-ink px-4 py-3 font-semibold">{o.name}</td>
                      <td className="text-ink-soft px-4 py-3">{o.city ?? '—'}</td>
                      <td className="text-ink-soft tnum px-4 py-3">
                        {o.needs} · {o.members}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant={o.approved ? 'secondary' : 'primary'}
                          pending={busy === o.id}
                          pendingText="…"
                          onClick={() => void approve(o)}
                        >
                          {o.approved ? 'Onaylı — kaldır' : 'Onayla'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        {view === 'kesif' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <ScoutForm onDone={(m) => setNote(m)} />
            <InviteForm onDone={(m) => setNote(m)} />
          </div>
        )}
      </Enter>
    </div>
  );
}

function InviteForm({ onDone }: { onDone: (msg: string) => void }) {
  const [source, setSource] = useState('');
  const [emails, setEmails] = useState('');
  const [message, setMessage] = useState(
    "Merhaba, GİRVAK gençlik ağına davetlisiniz. Evidex'te kartınız beyanla değil kanıtla oluşur: GitHub reponuzu bağlarsınız, sistem sinyalleri çıkarır, siz onaylarsınız. Kurumlar gerekçeli eşleşmeyle sizi bulur.",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const list = emails
      .split(/[\s,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    try {
      const r = await api<{ payload: { emails: string[]; skipped: number } }>(
        '/api/operator/invites',
        { method: 'POST', body: JSON.stringify({ emails: list, source, message }) },
      );
      onDone(
        `${r.payload.emails.length} davet kuyruğa düştü (${r.payload.skipped} zaten ağda). Onay kuyruğundan gönder.`,
      );
      setEmails('');
      setSource('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="bg-surface border-line rounded-[var(--radius-panel)] border p-5"
    >
      <Eyebrow>Kulüp kanalı · toplu davet</Eyebrow>
      <input
        value={source}
        onChange={(e) => setSource(e.target.value)}
        required
        placeholder="Kaynak (ör. İTÜ Bilgisayar Kulübü)"
        className="border-line bg-surface focus:border-accent mt-3 w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 text-base outline-none"
      />
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        required
        rows={3}
        placeholder="e-postalar — satır, virgül ya da boşlukla ayır"
        className="border-line bg-surface focus:border-accent mt-2 w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 font-mono text-sm outline-none"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="border-line bg-surface focus:border-accent mt-2 w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 text-base outline-none"
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="mt-3">
        <Button type="submit" variant="primary" pending={busy} pendingText="Kuyruğa yazılıyor…">
          Kuyruğa koy
        </Button>
      </div>
    </form>
  );
}

/**
 * Keşif ajanı (keşfet 01): onaylı ihtiyaçtan GitHub araması, ajan gerekçeli seçer, davet kuyruğa
 * düşer. Ağ içi eşleşme zayıfsa operatörün ilk hamlesi.
 */
function ScoutForm({ onDone }: { onDone: (msg: string) => void }) {
  const [needId, setNeedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{
        queued: { id: string } | null;
        summary: { searched: number; inNetwork: number; picked: number; withEmail: number };
      }>(`/api/operator/needs/${needId}/scout`, { method: 'POST' });
      const s = r.summary;
      onDone(
        r.queued
          ? `${s.searched} profil tarandı (${s.inNetwork} zaten ağda) → ${s.picked} aday seçildi, ${s.withEmail} e-postalı. Davet onay kuyruğunda.`
          : `${s.searched} profil tarandı; ajan uygun aday bulmadı.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="bg-surface border-line rounded-[var(--radius-panel)] border p-5"
    >
      <Eyebrow>Keşif ajanı · ağ dışında ara</Eyebrow>
      <p className="text-ink-soft mt-1 text-xs">
        İhtiyacın becerilerinden GitHub araması kurulur; ajan herkese açık sinyale bakıp gerekçeli
        seçer. Davet sen onaylamadan gitmez.
      </p>
      <div className="mt-3">
        <NeedPicker value={needId} onChange={(id) => setNeedId(id)} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="mt-3">
        <Button
          type="submit"
          variant="primary"
          pending={busy}
          pendingText="Aranıyor… (GitHub + ajan, ~30 sn)"
          disabled={!needId}
        >
          Ara ve öner
        </Button>
      </div>
    </form>
  );
}
