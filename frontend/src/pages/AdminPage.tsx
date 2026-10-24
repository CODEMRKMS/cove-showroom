import { useDocumentTitle } from '../lib/useDocumentTitle';

export function AdminPage() {
  useDocumentTitle('Inventory');
  return <h1 className="font-display text-3xl">Inventory</h1>;
}
