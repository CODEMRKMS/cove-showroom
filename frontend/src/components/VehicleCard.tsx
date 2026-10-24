import { useId, useState, type CSSProperties } from 'react';
import type { Vehicle } from '../api/types';
import { pickAccent } from '../lib/accent';
import { buildCarSpec } from '../lib/carSpec';
import { CATEGORY_LABELS } from '../lib/labels';
import { formatINR } from '../lib/money';
import { stockState } from '../lib/stock';
import { CarIllustration } from './CarIllustration';
import { PaintPicker } from './PaintPicker';
import { PurchaseControl } from './PurchaseControl';

export function StockText({ quantity }: { quantity: number }) {
  const state = stockState(quantity);
  if (state === 'sold-out') return <p className="font-semibold text-sold">Sold out</p>;
  if (state === 'low') return <p className="font-semibold text-low">Low stock: {quantity} left</p>;
  return <p className="font-semibold text-stock">{quantity} in stock</p>;
}

/** One car in the showroom: illustration, facts, paint choice and the guarded Buy button. */
export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const headingId = useId();
  const [paint, setPaint] = useState<string | undefined>(undefined);
  const spec = buildCarSpec(vehicle, paint);
  const { accent, ink } = pickAccent(spec.paint);
  const name = `${vehicle.make} ${vehicle.model}`;

  return (
    <article
      aria-labelledby={headingId}
      style={{ '--accent': accent, '--accent-ink': ink } as CSSProperties}
      className="flex w-full flex-col rounded-card bg-floor/60 shadow-cove"
    >
      {/* The car stands directly on the cove floor, with no frame around it. */}
      <div className="px-4 pt-5">
        <CarIllustration spec={spec} className="h-auto w-full" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={headingId} className="font-display text-xl">
            {name}
          </h2>
          {vehicle.year && <p className="text-graphite">{vehicle.year}</p>}
        </div>
        <p className="text-graphite">{CATEGORY_LABELS[vehicle.category]}</p>
        <p className="font-display text-2xl text-accent tabular-nums">{formatINR(vehicle.price)}</p>
        <StockText quantity={vehicle.quantity} />

        {vehicle.colorOptions.length > 1 && (
          <PaintPicker colours={vehicle.colorOptions} selected={spec.paint} onSelect={setPaint} />
        )}

        <div className="mt-auto pt-1">
          <PurchaseControl vehicle={vehicle} />
        </div>
      </div>
    </article>
  );
}
