import { useDocumentTitle } from '../lib/useDocumentTitle';

export function ShowroomPage() {
  useDocumentTitle('Showroom');
  return <h1 className="font-display text-3xl">Showroom</h1>;
}
