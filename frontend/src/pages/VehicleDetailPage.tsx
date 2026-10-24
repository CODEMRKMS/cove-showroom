import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client';
import type { Order } from '../api/types';
import { useVehicle } from '../api/vehicles';
import { PaintPicker } from '../components/PaintPicker';
import { PurchaseControl } from '../components/PurchaseControl';
import { btnQuiet } from '../components/styles';
import { StockText } from '../components/VehicleCard';
import { pickAccent } from '../lib/accent';
import { buildCarSpec, describeColour } from '../lib/carSpec';
import { CATEGORY_LABELS } from '../lib/labels';
import { apiErrorMessage } from '../lib/messages';
import { formatINR } from '../lib/money';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { usePageAccent } from '../lib/usePageAccent';
import { CarViewer } from '../studio/CarViewer';
import type { Hotspot } from '../studio/types';

const BackLink = () => (
  <Link to="/showroom" className="inline-flex min-h-11 items-center font-semibold underline">
    Back to showroom
  </Link>
);

/** One car, large: the 3D viewer (or the SVG car), its specs, paint choice, price, stock and Buy. */
export function VehicleDetailPage() {
  const { id } = useParams();
  const query = useVehicle(id);
  const [paint, setPaint] = useState<string | undefined>(undefined);
  // How many purchases this visit made. It drives the 3D moment and the confirmation panel.
  const [bought, setBought] = useState<Order[]>([]);
  const vehicle = query.data;
  useDocumentTitle(vehicle ? `${vehicle.make} ${vehicle.model}` : 'Car');
  const { accent, ink } = pickAccent(vehicle ? buildCarSpec(vehicle, paint).paint : undefined);
  usePageAccent(accent, ink);

  if (query.isPending) {
    return (
      <p role="status" className="text-graphite">
        Loading the car…
      </p>
    );
  }
  if (query.isError || !vehicle) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="font-display text-3xl">
          {missing ? 'Car not found' : 'Could not load the car'}
        </h1>
        <p className="text-graphite">
          {missing ? 'It may have been removed from the showroom.' : apiErrorMessage(query.error)}
        </p>
        <BackLink />
      </div>
    );
  }

  const spec = buildCarSpec(vehicle, paint);
  const name = `${vehicle.make} ${vehicle.model}`;
  const bodyLabel = CATEGORY_LABELS[vehicle.bodyStyle];
  const hotspots: Hotspot[] = [
    {
      id: 'body',
      label: 'Body',
      text: `${bodyLabel}${vehicle.year ? `, ${vehicle.year}` : ''}.`,
    },
    {
      id: 'paint',
      label: 'Paint',
      text: `Shown in ${describeColour(spec.paint)}. ${vehicle.colorOptions.length} paint ${vehicle.colorOptions.length === 1 ? 'option' : 'options'} in all.`,
    },
    {
      id: 'stock',
      label: 'Stock and price',
      text:
        vehicle.quantity > 0
          ? `${vehicle.quantity} in stock at ${formatINR(vehicle.price)}.`
          : `Sold out. Listed at ${formatINR(vehicle.price)}.`,
    },
  ];
  const lastOrder = bought.at(-1);
  const specs: [string, string][] = [
    ['Category', CATEGORY_LABELS[vehicle.category]],
    ...(vehicle.bodyStyle !== vehicle.category
      ? [['Body style', bodyLabel] as [string, string]]
      : []),
    ...(vehicle.year ? [['Year', String(vehicle.year)] as [string, string]] : []),
    ['Paint options', String(vehicle.colorOptions.length)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CarViewer
            spec={spec}
            interactive
            hotspots={hotspots}
            moment={bought.length}
            aspect="16 / 10"
          />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div>
            <h1 className="font-display text-3xl">{name}</h1>
            {vehicle.description && <p className="mt-2 text-graphite">{vehicle.description}</p>}
          </div>
          <p className="font-display text-3xl text-accent tabular-nums">
            {formatINR(vehicle.price)}
          </p>
          <StockText quantity={vehicle.quantity} tick={bought.length > 0} />
          {vehicle.colorOptions.length > 1 && (
            <PaintPicker colours={vehicle.colorOptions} selected={spec.paint} onSelect={setPaint} />
          )}
          <div className="flex flex-col gap-2">
            <PurchaseControl
              vehicle={vehicle}
              onPurchased={(order) => setBought((orders) => [...orders, order])}
            />
            <Link to="/showroom" className={btnQuiet}>
              Keep browsing
            </Link>
          </div>
          {lastOrder && (
            <section
              aria-labelledby="purchase-complete"
              className="moment-fade rounded-card border border-stock bg-white/60 p-4"
            >
              <h2 id="purchase-complete" className="font-display text-lg">
                Purchase complete
              </h2>
              <p className="mt-1">
                Bought {lastOrder.vehicleLabel} for {formatINR(lastOrder.totalPrice)}.
              </p>
              <p className="text-graphite">
                {vehicle.quantity > 0
                  ? `${vehicle.quantity} left in stock.`
                  : 'That was the last one in stock.'}
              </p>
              <Link
                to="/orders"
                className="mt-2 inline-flex min-h-11 items-center font-semibold underline"
              >
                View my orders
              </Link>
            </section>
          )}
          <ul
            aria-label="Specifications"
            className="mt-2 divide-y divide-line/30 border-y border-line/30"
          >
            {specs.map(([label, value]) => (
              <li key={label} className="flex justify-between gap-4 py-2">
                <span className="text-graphite">{label}</span>
                <span className="font-semibold">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
