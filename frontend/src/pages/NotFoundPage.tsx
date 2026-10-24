import { Link } from 'react-router';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="font-display text-3xl">Page not found</h1>
      <p className="mt-3 text-graphite">
        There is nothing at this address. It may have moved, or the link may have a typo.
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
