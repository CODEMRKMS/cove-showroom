import type { CSSProperties } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { CarViewer } from '../studio/CarViewer';
import { LogoMark } from '../components/Logo';
import { btnPrimary, btnQuiet } from '../components/styles';
import { pickAccent } from '../lib/accent';
import { buildCarSpec } from '../lib/carSpec';
import { useDocumentTitle } from '../lib/useDocumentTitle';

// A fixed showpiece. The vehicle API is protected, so the public page never reads real inventory.
const HERO_CAR = buildCarSpec({
  make: 'Cove',
  model: 'Studio car',
  year: null,
  bodyStyle: 'SPORTS',
  colorOptions: ['#c0392b'],
});

const STEPS = [
  { title: 'Browse', text: 'Sign in to see every car in stock, drawn on the studio floor.' },
  { title: 'Filter', text: 'Search by name and narrow by category, price range or paint.' },
  { title: 'Buy', text: 'Buying takes one unit from stock. The button turns off at zero.' },
  { title: 'Admin manages stock', text: 'Admins add, edit, restock and remove cars.' },
] as const;

/** The public front door. Signed-in visitors skip it and land in the showroom. */
export function LandingPage() {
  useDocumentTitle('Cove');
  const { state } = useAuth();
  if (state.status === 'authenticated') return <Navigate to="/showroom" replace />;

  const { accent, ink } = pickAccent(HERO_CAR.paint);
  return (
    <div
      style={{ '--accent': accent, '--accent-ink': ink } as CSSProperties}
      className="flex flex-col gap-16"
    >
      <section aria-labelledby="hero-title" className="flex flex-col items-center gap-8 pt-4">
        <LogoMark className="size-14" />
        <div className="max-w-2xl text-center">
          <h1 id="hero-title" className="font-display text-4xl leading-tight sm:text-5xl">
            Cove is a car showroom with live stock
          </h1>
          <p className="mt-4 text-lg text-graphite">
            Browse the cars, filter by what you need, and buy one from stock. Admins keep the
            inventory up to date.
          </p>
        </div>
        <CarViewer spec={HERO_CAR} className="w-full max-w-3xl" aspect="16 / 8" />
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/login" className={btnPrimary}>
            Sign in
          </Link>
          <Link to="/register" className={btnQuiet}>
            Create account
          </Link>
        </div>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="font-display text-2xl">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.title} className="rounded-card bg-floor/60 p-5 shadow-cove">
              <h3 className="font-display text-lg">{step.title}</h3>
              <p className="mt-2 text-graphite">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="rounded-card border border-line/40 p-4 text-graphite">
        Demo project: there are no real cars and no real payments. A purchase only changes the stock
        count.
      </p>
    </div>
  );
}
