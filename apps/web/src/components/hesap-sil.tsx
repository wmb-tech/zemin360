import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ErrorNote, IkiAdim } from './ui';

/**
 * Hesabını sil (KVKK md. 11): hesap ve ona bağlı her şey sunucudan silinir; geri alınamaz.
 * Modal yok: iki adımlı düğme. GitHub App kurulumu GitHub tarafında kalır — nasıl kaldırılacağı
 * yazılır (bizim sunucumuzdan onu kaldıramayız).
 */
export function HesapSil({ rol }: { rol: 'talent' | 'organization' }) {
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  async function sil() {
    setBusy(true);
    setHata(null);
    try {
      await api('/api/me/account', { method: 'DELETE' });
      await refresh();
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Hesap silinemedi');
      setBusy(false);
    }
  }
  return (
    <section className="border-line mt-12 border-t pt-6">
      <h2 className="text-ink text-base font-bold">Hesabını sil</h2>
      <p className="text-ink-soft mt-1 max-w-prose text-sm">
        {rol === 'talent'
          ? 'Kartın, bağladığın kaynaklardan çıkarılan sinyaller, iddiaların, eşleşmelerin ve iş birliklerin kalıcı olarak silinir.'
          : 'Kurum hesabın, ihtiyaçların ve bunlara bağlı eşleşmeler kalıcı olarak silinir (kurumda başka üye varsa kurum kaydı kalır).'}{' '}
        Geri alınamaz.{' '}
        {rol === 'talent' && (
          <>
            GitHub uygulamasını ayrıca{' '}
            <a
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noreferrer"
              className="text-accent font-semibold hover:underline"
            >
              GitHub ayarlarından
            </a>{' '}
            kaldırabilirsin.{' '}
          </>
        )}
        <Link to="/gizlilik" className="text-accent font-semibold hover:underline">
          Aydınlatma metni
        </Link>
      </p>
      <div className="mt-3">
        <IkiAdim
          onConfirm={() => void sil()}
          disabled={busy}
          armedLabel="Emin misin? Tekrar bas: kalıcı olarak silinir"
          className="text-negative text-sm font-semibold hover:underline"
          armedClassName="bg-negative text-surface py-1.5"
        >
          {busy ? 'Siliniyor…' : 'Hesabımı sil'}
        </IkiAdim>
      </div>
      {hata && <ErrorNote>{hata}</ErrorNote>}
    </section>
  );
}
