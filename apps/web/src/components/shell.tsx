import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth';

const roleLabel = { talent: 'Genç', organization: 'Kurum', operator: 'GİRVAK' } as const;

/** Ortak kabuk: üst çubuk + içerik. Rolün menüsü buradan, sayfalar kendi menüsünü uydurmaz. */
export function Shell({ nav }: { nav: { to: string; label: string }[] }) {
  const { me, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-line border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <span className="text-lg font-extrabold tracking-tight">Evidex</span>
          <nav className="flex gap-4 text-sm">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  isActive ? 'text-accent font-semibold' : 'text-ink-soft hover:text-ink'
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="text-ink-soft ml-auto flex items-center gap-3 text-sm">
            {me && (
              <>
                <span>
                  {me.name} · {roleLabel[me.role]}
                </span>
                <button onClick={() => void logout()} className="hover:text-ink underline">
                  Çıkış
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
