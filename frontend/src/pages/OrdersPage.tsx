import { useDocumentTitle } from '../lib/useDocumentTitle';

export function OrdersPage() {
  useDocumentTitle('My orders');
  return <h1 className="font-display text-3xl">My orders</h1>;
}
