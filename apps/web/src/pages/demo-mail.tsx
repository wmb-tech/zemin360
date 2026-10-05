import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Mail, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useTitle } from '../lib/title';
import { Enter } from '../components/motion';
import { Button, Empty, ErrorNote, Panel, Skeleton } from '../components/ui';

interface DemoMail {
  id: string;
  to: string[];
  subject: string;
  body: string;
  createdAt: string;
}

const saat = (s: string) =>
  new Date(s).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Gövdedeki adresler tıklanır: takip cevabı (/takip/…) bu linkten verilir. */
function Govde({ text }: { text: string }) {
  const parcalar = text.split(/(https?:\/\/\S+)/g);
  return (
    <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
      {parcalar.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noreferrer"
            className="text-accent font-semibold break-all hover:underline"
          >
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </p>
  );
}

/**
 * Demo posta kutusu: @demo.evidex.dev hesaplarına giden e-postalar (gerçek kutu yok). Sunumda
 * tanıştırma e-postası ve iki tarafın tek kullanımlık takip linkleri buradan gösterilir.
 */
export function DemoMailPage() {
  useTitle('Demo posta kutusu');
  const [list, setList] = useState<DemoMail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      setList(await api<DemoMail[]>('/api/operator/demo/mail'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (error && !list) return <ErrorNote>{error}</ErrorNote>;
  if (!list) return <Skeleton rows={4} />;

  return (
    <div>
      <Enter i={0} as="header" className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/ag" className="text-ink-soft text-sm hover:underline">
            ← Ağ
          </Link>
          <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
            Demo posta kutusu
          </h1>
          <p className="text-ink-soft mt-1 max-w-[65ch]">
            Demo hesaplarına giden e-postalar dışarı çıkmaz, burada durur. Takip linkini açan kişi o
            tarafın yerine cevap verir; link tek kullanımlıktır.
          </p>
        </div>
        <Button pending={busy} pendingText="Yenileniyor…" onClick={() => void load()}>
          <RefreshCw size={14} aria-hidden /> Yenile
        </Button>
      </Enter>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Enter i={1} as="section" className="mt-6 grid gap-4">
        {list.length === 0 ? (
          <Empty icon={Mail} title="Henüz e-posta yok">
            Tanıştırma ya da takip sorusu onaylandığında demo taraflara giden e-posta burada
            görünür.
          </Empty>
        ) : (
          list.map((m) => (
            <Panel key={m.id} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-ink flex items-center gap-2 font-bold">
                  <Mail size={16} aria-hidden className="text-ink-soft" /> {m.subject}
                </h2>
                <span className="text-ink-soft tnum text-xs">{saat(m.createdAt)}</span>
              </div>
              {/* Adres büyük harfe çevrilmez: tr-TR'de "yesil" → "YESİL" bozulur. */}
              <p className="text-ink-soft mt-1 text-xs">
                <span className="font-semibold">Alıcı:</span> {m.to.join(', ')}
              </p>
              <div className="border-line mt-3 border-t pt-3">
                <Govde text={m.body} />
              </div>
            </Panel>
          ))
        )}
      </Enter>
    </div>
  );
}
