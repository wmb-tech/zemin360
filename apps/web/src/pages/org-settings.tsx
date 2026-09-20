import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTitle } from '../lib/title';
import { Skeleton } from '../components/skeleton';

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
      <h1 className="text-2xl font-bold tracking-tight">Kurum bilgileri</h1>
      <p className="text-ink-soft mt-2 text-sm">
        Kurum adı, gence giden tanıştırma ve takip e-postalarında görünür; ihtiyaç açmadan önce
        doğru olsun.
      </p>
      {p.needsName && (
        <p className="border-referenced text-referenced mt-4 rounded-lg border px-3 py-2 text-sm">
          Kurumunuzun adı henüz yok. Önce onu yazın.
        </p>
      )}
      <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
        <Alan
          label="Kurum adı"
          value={name}
          onChange={setName}
          required
          placeholder="Örn. Lodos Yazılım"
        />
        <Alan label="Şehir" value={city} onChange={setCity} placeholder="İstanbul" />
        <Alan
          label="Web sitesi"
          value={website}
          onChange={setWebsite}
          placeholder="https://…"
          type="url"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            disabled={busy || name.trim().length < 2}
            className="bg-accent text-paper rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Kaydet
          </button>
          {saved && <span className="text-verified text-sm">Kaydedildi</span>}
        </div>
      </form>
      <p className="text-ink-soft mt-8 text-xs">
        Referans yetkisi:{' '}
        {p.approved
          ? 'GİRVAK onaylı — biten iş birliklerinde verdiğiniz değerlendirme gencin kartına referans olarak girer.'
          : 'GİRVAK onayı bekliyor — onaydan sonra biten iş birliklerinde referans verebilirsiniz.'}
      </p>
    </div>
  );
}

function Alan({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-ink-soft text-xs font-semibold tracking-wide uppercase">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-line focus:border-accent mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
      />
    </label>
  );
}
