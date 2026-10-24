import { Link } from 'react-router';
import { useMyOrders } from '../api/inventory';
import { btnPrimary } from '../components/styles';
import { apiErrorMessage } from '../lib/messages';
import { formatINR } from '../lib/money';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

export function OrdersPage() {
  useDocumentTitle('My orders');
  const orders = useMyOrders();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl">My orders</h1>
        <p className="mt-1 text-graphite">Each order keeps the price you paid on the day.</p>
      </div>

      {orders.isError ? (
        <div role="alert" className="rounded-card border border-sold bg-white/70 p-5">
          <p className="font-semibold text-sold">{apiErrorMessage(orders.error)}</p>
          <button type="button" className={`${btnPrimary} mt-3`} onClick={() => orders.refetch()}>
            Try again
          </button>
        </div>
      ) : orders.isPending ? (
        <div role="status" aria-label="Loading your orders">
          <div aria-hidden="true" className="h-32 animate-pulse rounded-card bg-floor/70" />
        </div>
      ) : orders.data.length === 0 ? (
        <div className="rounded-card bg-floor/60 p-8 text-center">
          <p className="font-display text-xl">You have not bought a car yet.</p>
          <p className="mt-2 text-graphite">Pick one from the showroom and it will appear here.</p>
          <Link to="/showroom" className={`${btnPrimary} mt-4`}>
            Browse the showroom
          </Link>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <caption className="sr-only">Your orders</caption>
          <thead className="max-md:sr-only">
            <tr className="border-b border-graphite/40 text-left">
              <th scope="col" className="px-3 py-2">
                Car
              </th>
              <th scope="col" className="px-3 py-2">
                Quantity
              </th>
              <th scope="col" className="px-3 py-2">
                Total paid
              </th>
              <th scope="col" className="px-3 py-2">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.data.map((order) => (
              <tr
                key={order.id}
                className="border-b border-graphite/20 max-md:mb-3 max-md:block max-md:rounded-card max-md:bg-floor/60 max-md:p-3"
              >
                <th scope="row" className="px-3 py-2 text-left font-semibold max-md:block">
                  {order.vehicleLabel}
                </th>
                <td className="px-3 py-2 max-md:block">{order.quantity}</td>
                <td className="px-3 py-2 tabular-nums max-md:block">
                  {formatINR(order.totalPrice)}
                </td>
                <td className="px-3 py-2 max-md:block">
                  <time dateTime={order.createdAt}>
                    {dateFormat.format(new Date(order.createdAt))}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
