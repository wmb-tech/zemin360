import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import {
  Building2,
  ChartColumn,
  CircleHelp,
  Flag,
  Handshake,
  IdCard,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MoreHorizontal,
  Network,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

export interface NavItem {
  to: string;
  label: string;
  icon: keyof typeof ICONS;
}
const ICONS = {
  home: LayoutDashboard,
  card: IdCard,
  flag: Flag,
  needs: ListChecks,
  org: Building2,
  queue: Inbox,
  network: Network,
  collab: Handshake,
  metrics: ChartColumn,
  users: Users,
} satisfies Record<string, LucideIcon>;

const roleLabel = { talent: 'Genç', organization: 'Kurum', operator: 'GİRVAK' } as const;

/**
 * Uygulama kabuğu (docs/redesign/02 §Navigation). Masaüstü: sol menü 232 px, sabit. Telefon:
 * alt menü (≤4 madde, güvenli alan). Operatör: aynı malzeme, geniş çalışma alanı, daha sıkı.
 * Sahte arama/bildirim yok. Logo rolün ana sayfasına döner.
 */
export function Shell({ nav }: { nav: NavItem[] }) {
  const { me, logout } = useAuth();
  const dense = me?.role === 'operator';
  // Telefon alt menüsü en çok 4 madde taşır; fazlası "Diğer" altında (amputasyon değil, katlama).
  const altMenu = nav.length > 4 ? nav.slice(0, 3) : nav;
  const digerMenu = nav.length > 4 ? nav.slice(3) : [];
  const [digerAcik, setDigerAcik] = useState(false);
  const kimlik =
    me?.role === 'organization' && me.organization ? me.organization.name : (me?.name ?? '');

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      {/* Sol menü — masaüstü */}
      <aside className="border-line bg-surface sticky top-0 hidden h-screen flex-col border-r md:flex">
        <NavLink
          to="/"
          className="text-ink flex h-16 items-center px-6 text-xl font-extrabold tracking-tight"
        >
          Evidex
        </NavLink>
        <nav className="flex flex-1 flex-col gap-1 px-3 pt-2" aria-label="Ana menü">
          {nav.map((n) => {
            const Icon = ICONS[n.icon];
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `pressable flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-semibold ${
                    isActive
                      ? 'bg-accent-soft text-accent-strong'
                      : 'text-ink-soft hover:bg-paper-2 hover:text-ink'
                  }`
                }
              >
                <Icon size={18} strokeWidth={2} aria-hidden />
                {n.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-line border-t px-3 py-3">
          <NavLink
            to="/nasil-calisir"
            className="text-ink-soft hover:bg-paper-2 hover:text-ink flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-semibold"
          >
            <CircleHelp size={18} strokeWidth={2} aria-hidden />
            Nasıl çalışır
          </NavLink>
          <div className="mt-1 flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-ink truncate text-sm font-semibold">{kimlik}</div>
              <div className="text-ink-soft text-xs">{me ? roleLabel[me.role] : ''}</div>
            </div>
            <button
              onClick={() => void logout()}
              className="text-ink-soft hover:bg-paper-2 hover:text-ink pressable flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)]"
              aria-label="Çıkış"
              title="Çıkış"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      {/* Üst çubuk — telefon */}
      <header className="border-line bg-surface flex h-14 items-center justify-between border-b px-4 md:hidden">
        <NavLink to="/" className="text-ink text-lg font-extrabold tracking-tight">
          Evidex
        </NavLink>
        <button onClick={() => void logout()} className="text-ink-soft text-sm font-semibold">
          Çıkış
        </button>
      </header>

      <div className="min-w-0">
        <main
          className={`mx-auto w-full px-4 pt-6 pb-24 md:px-8 md:pt-8 md:pb-12 ${dense ? 'max-w-[1440px]' : 'max-w-[1120px]'}`}
        >
          <Outlet />
        </main>
      </div>

      {/* Alt menü — telefon */}
      {digerAcik && (
        <div
          className="fixed inset-0 z-20 bg-[color-mix(in_oklch,var(--color-ink)_30%,transparent)] md:hidden"
          onClick={() => setDigerAcik(false)}
          aria-hidden
        />
      )}
      <nav
        className="border-line bg-surface fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Ana menü"
      >
        {digerAcik && (
          <ul className="border-line border-b px-2 py-2" id="diger-menu">
            {digerMenu.map((n) => {
              const Icon = ICONS[n.icon];
              return (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    onClick={() => setDigerAcik(false)}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-semibold ${
                        isActive ? 'bg-accent-soft text-accent-strong' : 'text-ink'
                      }`
                    }
                  >
                    <Icon size={18} strokeWidth={2} aria-hidden />
                    {n.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex">
          {altMenu.map((n) => {
            const Icon = ICONS[n.icon];
            return (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setDigerAcik(false)}
                className={({ isActive }) =>
                  `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                    isActive ? 'text-accent-strong' : 'text-ink-soft'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-7 w-11 items-center justify-center rounded-full ${isActive ? 'bg-accent-soft' : ''}`}
                    >
                      <Icon size={18} strokeWidth={2} aria-hidden />
                    </span>
                    {n.label}
                  </>
                )}
              </NavLink>
            );
          })}
          {digerMenu.length > 0 && (
            <button
              onClick={() => setDigerAcik((v) => !v)}
              aria-expanded={digerAcik}
              aria-controls="diger-menu"
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                digerAcik ? 'text-accent-strong' : 'text-ink-soft'
              }`}
            >
              <span
                className={`flex h-7 w-11 items-center justify-center rounded-full ${digerAcik ? 'bg-accent-soft' : ''}`}
              >
                <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
              </span>
              Diğer
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
