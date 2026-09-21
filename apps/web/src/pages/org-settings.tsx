import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTitle } from '../lib/title';
import { Button, ErrorNote, Field, Input, Skeleton } from '../components/ui';
import { Enter } from '../components/motion';

interface OrgProfile {
  id: string;
  name: string;
  city: string | null;
  website: string | null;
  approved: boolean;
  needsName: boolean;
}

/** Kurum profili: ad zorunlu (e-postalara giriyor), şehir ve site isteğe bağlı. */
export function OrgSettingsPage() {
  useTitle('Kurum');
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [p, setP] = useState<OrgProfile | null>(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void api<OrgProfile>('/api/org').then((o) => {
      setP(o);
      setName(o.needsName ? '' : o.name);
      setCity(o.city ?? '');
      setWebsite(o.website ?? '');
    });
  }, []);
  if (!p) return <Skeleton />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/org', {
        method: 'PATCH',
        body: JSON.stringify({ name, city: city || null, website: website || null }),
      });
      await refresh();
      setSaved(true);
      if (params.get('ilk')) nav('/ihtiyaclar');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg">
      <Enter i={0} as="header">
        <h1 className="text-ink text-[28px] leading-tight font-extrabold tracking-[-0.035em] md:text-[34px]">
          Kurum bilgileri
        </h1>
        <p className="text-ink-soft mt-2">
          Kurum adı, gence giden tanıştırma ve takip e-postalarında görünür; ihtiyaç açmadan önce
          doğru olsun.
        </p>
      </Enter>
      {p.needsName && (
        <p className="bg-accent-soft text-accent-strong mt-4 rounded-[var(--radius-control)] px-4 py-3 text-sm font-semibold">
          Kurumunuzun adı henüz yok. Önce onu yazın.
        </p>
      )}
      <Enter i={1} as="section">
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          <Field label="Kurum adı">
            <Input
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Lodos Yazılım"
            />
          </Field>
          <Field label="Şehir" hint="Eşleşmede yakınlık için (isteğe bağlı)">
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="İstanbul" />
          </Field>
          <Field label="Web sitesi">
            <Input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              pending={busy}
              pendingText="Kaydediliyor…"
              disabled={name.trim().length < 2}
            >
              Kaydet
            </Button>
            {saved && (
              <span className="text-verified text-sm font-semibold" aria-live="polite">
                Kaydedildi
              </span>
            )}
          </div>
        </form>
        <p className="text-ink-soft mt-8 text-sm">
          Referans yetkisi:{' '}
          {p.approved
            ? 'GİRVAK onaylı — biten iş birliklerinde verdiğiniz değerlendirme gencin kartına referans olarak girer.'
            : 'GİRVAK onayı bekliyor — onaydan sonra biten iş birliklerinde referans verebilirsiniz.'}
        </p>
      </Enter>
    </div>
  );
}
