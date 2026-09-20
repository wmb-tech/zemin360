import { useEffect, useState, type FormEvent } from 'react';
import { THRESHOLDS, type EvidenceLevel } from '@evidex/shared';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Skeleton } from '../components/skeleton';
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

  if (!data) return <Skeleton />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ağ</h1>
          <p className="text-ink-soft mt-2 max-w-prose text-sm">
            {data.talents.length} genç · {data.organizations.length} kurum · {data.silentTalents}{' '}
            sessiz kart. GitHub kaynakları {THRESHOLDS.evidenceRefreshAfterDays} günde bir yeniden
            okunur; {THRESHOLDS.silentCardAfterDays} gündür etkinlik yoksa kart sessiz sayılır.
          </p>
        </div>
        <button
          disabled={busy === 'refresh'}
          onClick={() => void refresh()}
          className="border-line hover:bg-paper-2 rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy === 'refresh' ? 'Okunuyor…' : 'Kanıtları şimdi yenile'}
        </button>
      </div>
      {note && <p className="text-ink-soft mt-3 text-sm">{note}</p>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="text-ink-soft text-xs font-semibold tracking-wide uppercase">Gençler</h2>
          <ul className="mt-2 divide-y divide-[var(--color-line)]">
            {data.talents.map((t) => {
              const toplam = LEVEL.reduce((a, l) => a + t.claims[l.key], 0);
              return (
                <li key={t.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{t.name}</span>
                    {t.githubLogin && (
                      <span className="text-ink-soft font-mono text-xs">@{t.githubLogin}</span>
                    )}
                    <span className="bg-paper-2 rounded px-2 py-0.5 text-xs">
                      {t.cardStatus === 'approved' ? 'Kart onaylı' : 'Taslak'}
                    </span>
                    {t.silent && (
                      <span className="border-declared text-declared rounded border px-1.5 py-0.5 text-[10px] font-semibold">
                        sessiz · son etkinlik {tarih(t.lastSignalAt)}
                      </span>
                    )}
                    <span className="text-ink-soft ml-auto text-xs">
                      {t.sources} kaynak · {t.approvedClaims}/{toplam} iddia onaylı
                    </span>
                  </div>
                  {toplam > 0 && (
                    <div className="mt-2 flex h-1.5 overflow-hidden rounded-full">
                      {LEVEL.map((l) =>
                        t.claims[l.key] > 0 ? (
                          <div
                            key={l.key}
                            title={`${t.claims[l.key]} ${l.label}`}
                            className={l.cls}
                            style={{ width: `${(t.claims[l.key] / toplam) * 100}%` }}
                          />
                        ) : null,
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {data.talents.length === 0 && (
              <li className="text-ink-soft py-4 text-sm">Henüz genç yok.</li>
            )}
          </ul>
        </section>

        <section>
          <ScoutForm onDone={(m) => setNote(m)} />
          <div className="mt-4">
            <InviteForm onDone={(m) => setNote(m)} />
          </div>
          <h2 className="text-ink-soft mt-8 text-xs font-semibold tracking-wide uppercase">
            Kurumlar
          </h2>
          <p className="text-ink-soft mt-1 text-xs">
            Referans yetkisi: yalnız onaylı kurumun "tamamlandı" değerlendirmesi gencin kartına
            referans olarak düşer (KARAR-10).
          </p>
          <ul className="mt-2 divide-y divide-[var(--color-line)]">
            {data.organizations.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{o.name}</div>
                  <div className="text-ink-soft text-xs">
                    {o.city ?? 'şehir yok'} · {o.needs} ihtiyaç · {o.members} üye
                  </div>
                </div>
                <button
                  disabled={busy === o.id}
                  onClick={() => void approve(o)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                    o.approved ? 'bg-verified text-white' : 'border-line hover:bg-paper-2 border'
                  }`}
                >
                  {o.approved ? 'Onaylı ✓' : 'Onayla'}
                </button>
              </li>
            ))}
            {data.organizations.length === 0 && (
              <li className="text-ink-soft py-4 text-sm">Henüz kurum yok.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

/**
 * Kulüp kanalı (keşfet 01): bir liste yapıştır (üniversite kulübü, etkinlik), kuyruğa düşer,
 * onayla davet gider. Ağdakiler elenir. Ajan burada yok; davet metni operatörün.
 */
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
    <form onSubmit={(e) => void submit(e)} className="border-line rounded-2xl border p-4">
      <h2 className="text-ink-soft text-xs font-semibold tracking-wide uppercase">
        Kulüp kanalı · toplu davet
      </h2>
      <input
        value={source}
        onChange={(e) => setSource(e.target.value)}
        required
        placeholder="Kaynak (ör. İTÜ Bilgisayar Kulübü)"
        className="border-line focus:border-accent mt-3 w-full rounded-lg border px-3 py-1.5 text-sm outline-none"
      />
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        required
        rows={3}
        placeholder="e-postalar — satır, virgül ya da boşlukla ayır"
        className="border-line focus:border-accent mt-2 w-full rounded-lg border px-3 py-1.5 font-mono text-xs outline-none"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="border-line focus:border-accent mt-2 w-full rounded-lg border px-3 py-1.5 text-sm outline-none"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        disabled={busy}
        className="bg-accent text-paper mt-3 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
      >
        Kuyruğa koy
      </button>
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
    <form onSubmit={(e) => void submit(e)} className="border-line rounded-2xl border p-4">
      <h2 className="text-ink-soft text-xs font-semibold tracking-wide uppercase">
        Keşif ajanı · ağ dışında ara
      </h2>
      <p className="text-ink-soft mt-1 text-xs">
        İhtiyacın becerilerinden GitHub araması kurulur; ajan herkese açık sinyale bakıp gerekçeli
        seçer. Davet sen onaylamadan gitmez.
      </p>
      <div className="mt-3">
        <NeedPicker value={needId} onChange={(id) => setNeedId(id)} />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        disabled={busy || !needId}
        className="bg-accent text-paper mt-3 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? 'Aranıyor…' : 'Ara ve öner'}
      </button>
    </form>
  );
}
