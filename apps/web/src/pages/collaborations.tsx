import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Clock, MessageSquare } from 'lucide-react';
import type { CheckinInsight, CollaborationStatus } from '@evidex/shared';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter, Live } from '../components/motion';
import { Button, Empty, ErrorNote, Eyebrow, Panel, Skeleton } from '../components/ui';

interface Round {
  side: 'talent' | 'organization';
  sentAt: string;
  answeredAt: string | null;
  status: CollaborationStatus | null;
  feedback: string | null;
  insight: CheckinInsight | null;
}
interface Collaboration {
  id: string;
  matchId: string;
  status: CollaborationStatus;
  introducedAt: string | null;
  lastCheckinAt: string | null;
  lastFollowUpAt: string | null;
  silentSince: string | null;
  needTitle: string | null;
  organizationName: string;
  organizationApproved: boolean;
  talentName: string;
  rounds: number;
  conflict: boolean;
  needsOperator: boolean;
  lastRound: Round[];
}

const STATUS: Record<CollaborationStatus, string> = {
  introduced: 'Tanıştırıldı',
  meeting: 'Görüşüldü',
  started: 'Başladı',
  ongoing: 'Sürüyor',
  completed: 'Tamamlandı',
  did_not_happen: 'Olmadı',
};
const SIRA: CollaborationStatus[] = ['introduced', 'meeting', 'started', 'ongoing', 'completed'];
const FLAG: Record<string, string> = {
  no_contact: 'görüşülemedi',
  schedule: 'takvim',
  scope: 'kapsam',
  payment: 'ödeme',
  communication: 'iletişim',
  positive: 'olumlu',
  ended: 'bitti',
};
const tarih = (s: string | null) => (s ? new Date(s).toLocaleDateString('tr-TR') : '—');

/**
 * İş birlikleri (izle 06). Satır: taraflar, durum, son cevap, istisna (çelişki ≠ sessizlik).
 * Açılınca iki tarafın cevabı, zaman çizgisi, elle durum değişimi (denetim izine düşer).
 * Referans: yalnız onaylı kurum + tamamlandı (KARAR-10) — satırda açıkça yazılır.
 */
export function CollaborationsPage() {
  useTitle('İş birlikleri');
  const [list, setList] = useState<Collaboration[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setList(await api<Collaboration[]>('/api/operator/collaborations'));
  }
  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Yüklenemedi'));
  }, []);

  async function scan() {
    setBusy('scan');
    setError(null);
    try {
      const r = await api<{ proposed: number; silent: number }>('/api/operator/follow-ups/scan', {
        method: 'POST',
      });
      setLive(`${r.proposed} takip önerisi kuyruğa düştü · ${r.silent} sessiz işaretlendi.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tarama koşmadı');
    } finally {
      setBusy(null);
    }
  }
  async function setStatus(c: Collaboration, status: CollaborationStatus) {
    setBusy(c.id);
    setError(null);
    try {
      await api(`/api/operator/collaborations/${c.matchId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setLive(
        `${c.talentName} · ${c.organizationName}: durum "${STATUS[status]}" olarak kaydedildi; denetim izine yazıldı.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Durum kaydedilemedi');
    } finally {
      setBusy(null);
    }
  }

  if (error && !list) return <ErrorNote>{error}</ErrorNote>;
  if (!list) return <Skeleton rows={5} />;
  const dikkat = list.filter((c) => c.conflict || c.needsOperator || c.silentSince);

  return (
    <div>
      <Live message={live} />
      <Enter i={0} as="header" className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
            İş birlikleri
          </h1>
          <p className="text-ink-soft mt-1 max-w-[65ch]">
            Tanıştırmadan 3 gün sonra ajan iki tarafa sorar; cevaplar buraya düşer. Sen yalnız
            bayraklı, çelişkili ve sessiz olanlara bakarsın. Zamanlayıcı saatte bir tarar.
          </p>
        </div>
        <Button pending={busy === 'scan'} pendingText="Taranıyor…" onClick={() => void scan()}>
          Şimdi tara
        </Button>
      </Enter>
      {live && <p className="text-verified mt-3 text-sm font-semibold">{live}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {dikkat.length > 0 && (
        <p className="bg-referenced-soft text-referenced mt-4 inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold">
          <AlertTriangle size={16} aria-hidden /> {dikkat.length} iş birliği dikkat istiyor
        </p>
      )}

      <Enter i={1} as="section" className="mt-6">
        {list.length === 0 ? (
          <Empty title="Henüz tanıştırma yok">
            Tanıştırma onaylanınca iş birliği kaydı burada açılır; üç gün sonra ilk takip sorusu
            gider.
          </Empty>
        ) : (
          <ul className="bg-surface border-line divide-y divide-[var(--color-line)] rounded-[var(--radius-panel)] border">
            {list.map((c) => {
              const acik = open === c.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setOpen(acik ? null : c.id)}
                    aria-expanded={acik}
                    className="hover:bg-paper-2/60 flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
                  >
                    <ChevronDown
                      size={16}
                      className={`text-ink-soft transition-transform duration-[var(--duration-quick)] ${acik ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                    <span className="text-ink font-semibold">
                      {c.talentName} · {c.organizationName}
                    </span>
                    <span className="bg-paper-2 text-ink rounded-md px-2 py-0.5 text-xs font-bold">
                      {STATUS[c.status]}
                    </span>
                    {c.conflict && (
                      <Etiket cls="bg-referenced-soft text-referenced">
                        Çelişki — taraflar farklı durum dedi
                      </Etiket>
                    )}
                    {c.needsOperator && (
                      <Etiket cls="bg-accent-soft text-accent-strong">
                        Bayrak — ajan operatör istedi
                      </Etiket>
                    )}
                    {c.silentSince && (
                      <Etiket cls="bg-declared-soft text-declared">
                        Sessiz — {tarih(c.silentSince)}'den beri cevap yok
                      </Etiket>
                    )}
                    <span className="text-ink-soft tnum ml-auto text-xs">
                      {c.needTitle ?? 'İhtiyaç'} · tanıştırma {tarih(c.introducedAt)} · {c.rounds}{' '}
                      tur
                    </span>
                  </button>
                  <div className="disclose" data-open={acik}>
                    <div>
                      <div className="border-line grid items-start gap-4 border-t px-4 py-4 lg:grid-cols-[1fr_1fr]">
                        <div className="lg:col-span-2">
                          <Eyebrow>Zaman çizgisi</Eyebrow>
                          <ol className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            {SIRA.map((s, i) => {
                              const gecti =
                                c.status === 'did_not_happen'
                                  ? i === 0
                                  : SIRA.indexOf(c.status) >= i;
                              return (
                                <li key={s} className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${gecti ? 'bg-verified-soft text-verified' : 'bg-paper-2 text-ink-soft'}`}
                                  >
                                    {gecti && <Check size={12} aria-hidden />}
                                    {STATUS[s]}
                                  </span>
                                  {i < SIRA.length - 1 && <span className="text-ink-soft">→</span>}
                                </li>
                              );
                            })}
                            {c.status === 'did_not_happen' && (
                              <li className="bg-negative-soft text-negative rounded-md px-2 py-0.5 font-semibold">
                                Gerçekleşmedi
                              </li>
                            )}
                          </ol>
                        </div>
                        {c.lastRound.length === 0 && (
                          <p className="text-ink-soft text-sm lg:col-span-2">
                            <Clock size={14} className="mr-1 inline" aria-hidden />
                            Henüz takip sorusu gönderilmedi; tarama 3 gün sonra öneri üretir.
                          </p>
                        )}
                        {c.lastRound.map((r) => (
                          <Panel key={r.side} className="p-4 text-sm">
                            <Eyebrow>
                              {r.side === 'talent' ? 'Genç' : 'Kurum'} · gönderildi{' '}
                              {tarih(r.sentAt)}
                            </Eyebrow>
                            {r.answeredAt ? (
                              <>
                                <div className="text-ink mt-1 font-bold">
                                  {r.status && STATUS[r.status]}
                                </div>
                                {r.feedback && <p className="text-ink mt-1">{r.feedback}</p>}
                                {r.insight && (
                                  <div className="bg-paper-2 mt-2 rounded-[var(--radius-control)] p-3 text-xs">
                                    <span className="text-ink-soft inline-flex items-center gap-1">
                                      <MessageSquare size={12} aria-hidden /> Ajan:
                                    </span>{' '}
                                    {r.insight.summary}
                                    {r.insight.flags.length > 0 && (
                                      <span className="text-ink-soft">
                                        {' '}
                                        · {r.insight.flags.map((f) => FLAG[f] ?? f).join(', ')}
                                      </span>
                                    )}
                                    {r.insight.operatorNote && (
                                      <div className="text-accent-strong mt-1 font-semibold">
                                        {r.insight.operatorNote}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-ink-soft mt-1">Cevap bekleniyor</div>
                            )}
                          </Panel>
                        ))}
                        <div className="lg:col-span-2">
                          <Eyebrow>Durumu elle değiştir</Eyebrow>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(Object.keys(STATUS) as CollaborationStatus[]).map((s) => (
                              <Button
                                key={s}
                                size="sm"
                                disabled={busy === c.id || s === c.status}
                                onClick={() => void setStatus(c, s)}
                              >
                                {STATUS[s]}
                              </Button>
                            ))}
                          </div>
                          <p className="text-ink-soft mt-2 text-xs">
                            {c.organizationApproved
                              ? 'Kurum GİRVAK onaylı: "tamamlandı" + kurum notu gencin kartına referans olarak düşer.'
                              : 'Kurum GİRVAK onaylı değil: "tamamlandı" dese de referans üretmez (KARAR-10). Onayı Ağ → Kurumlar\'da ver.'}{' '}
                            Başladı/bitti/olmadı iki tarafa e-postayla bildirilir.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Enter>
    </div>
  );
}
function Etiket({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${cls}`}>{children}</span>;
}
