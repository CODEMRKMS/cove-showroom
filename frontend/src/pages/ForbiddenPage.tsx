import { Link } from 'react-router';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export function ForbiddenPage() {
  useDocumentTitle('Admins only');
  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="font-display text-3xl">Admins only</h1>
      <p className="mt-3 text-graphite">
        Your account can browse and buy cars, but managing inventory needs an admin account.
      </p>
      <Link
        to="/showroom"
        className="mt-6 inline-flex min-h-11 items-center font-semibold text-ink underline"
      >
        Back to the showroom
      </Link>
    </div>
  );
}
