import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Logo } from './Logo';
import { btnQuiet } from './styles';

const navLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded-control px-3 font-semibold hover:bg-floor ${
    isActive
      ? 'bg-floor text-ink underline decoration-accent decoration-2 underline-offset-8'
      : 'text-graphite'
  }`;

export function Layout() {
  const { state, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const header = useRef<HTMLElement>(null);

  // Close the mobile menu on Escape and on a tap outside it (and after a link is chosen, see the nav).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  const user = state.status === 'authenticated' ? state.user : null;

  async function signOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-ink focus:px-4 focus:py-3 focus:text-white"
      >
        Skip to main content
      </a>
      <header ref={header} className="border-b border-line/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-2 sm:px-6">
          <Logo />
          {user && (
            <button
              type="button"
              className={`${btnQuiet} md:hidden`}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              Menu
            </button>
          )}
          {user && (
            <nav
              id={menuId}
              aria-label="Main"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('a, button')) setMenuOpen(false);
              }}
              className={`${menuOpen ? 'flex' : 'hidden'} w-full flex-col gap-1 py-2 md:flex md:w-auto md:flex-row md:items-center md:py-0`}
            >
              <NavLink to="/showroom" className={navLink}>
                Showroom
              </NavLink>
              <NavLink to="/orders" className={navLink}>
                My orders
              </NavLink>
              {user.role === 'ADMIN' && (
                <NavLink to="/admin" className={navLink}>
                  Admin
                </NavLink>
              )}
              <span className="px-3 py-2 text-graphite md:py-0">
                <span className="sr-only">Signed in as </span>
                <span className="font-semibold text-ink">{user.name}</span>
              </span>
              <button type="button" className={btnQuiet} onClick={signOut}>
                Sign out
              </button>
            </nav>
          )}
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto min-h-[60vh] max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-line/40 py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-graphite sm:px-6">
          <p>
            Cove is a demo project for a coding kata. Purchases are simulated inventory actions: no
            real payments are taken and no real cars are sold.
          </p>
          <p className="mt-2">© {new Date().getFullYear()} Cove.</p>
        </div>
      </footer>
    </>
  );
}
