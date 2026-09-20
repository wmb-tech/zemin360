import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';

/** KARAR-07: genç GitHub ile, kurum/operatör e-posta bağlantısıyla girer. */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/auth/magic-link', { method: 'POST', body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir şeyler ters gitti');
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link to="/" className="text-3xl font-extrabold tracking-tight">
        Evidex
      </Link>
      <p className="text-ink-soft mt-2">Beyan değil kanıt. Skor değil gerekçe.</p>

      <section className="border-line mt-10 rounded-xl border p-6">
        <h2 className="font-semibold">Genç yetenek</h2>
        <p className="text-ink-soft mt-1 text-sm">
          Kendini anlatma; kanıtını bağla. GitHub ile giriş yap, hangi repoları göstereceğini sen
          seç.
        </p>
        <a
          href="/api/auth/github"
          className="bg-ink text-paper mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold"
        >
          GitHub ile devam et
        </a>
      </section>

      <section className="border-line mt-4 rounded-xl border p-6">
        <h2 className="font-semibold">Kurum · GİRVAK</h2>
        {sent ? (
          <p className="mt-2 text-sm">
            Bağlantı e-postana gitti. 15 dakika geçerli; tek kullanımlık.
          </p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="mt-3 flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e-posta"
              className="border-line focus:border-accent flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
            />
            <button className="bg-accent text-paper rounded-lg px-4 py-2 text-sm font-semibold">
              Bağlantı gönder
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}
