import { useId, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useBuyVehicle } from '../api/vehicles';
import type { Vehicle } from '../api/types';
import { pickAccent } from '../lib/accent';
import { buildCarSpec, describeColour } from '../lib/carSpec';
import { CATEGORY_LABELS } from '../lib/labels';
import { apiErrorMessage } from '../lib/messages';
import { formatINR } from '../lib/money';
import { stockState } from '../lib/stock';
import { CarIllustration } from './CarIllustration';
import { ConfirmDialog } from './ConfirmDialog';
import { PurchaseButton } from './PurchaseButton';
import { useToast } from './Toast';

/** "White", "Black", and "Grey 2" when two paints would share a name. */
export function paintNames(colours: string[]): string[] {
  const seen = new Map<string, number>();
  return colours.map((hex) => {
    const base = describeColour(hex);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const name = base.charAt(0).toUpperCase() + base.slice(1);
    return count === 1 ? name : `${name} ${count}`;
  });
}

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
  const [confirming, setConfirming] = useState(false);
  const buy = useBuyVehicle();
  const toast = useToast();

  const spec = buildCarSpec(vehicle, paint);
  const { accent, ink } = pickAccent(spec.paint);
  const colours = vehicle.colorOptions;
  const names = paintNames(colours);
  const name = `${vehicle.make} ${vehicle.model}`;

  function confirmPurchase() {
    buy.mutate(vehicle, {
      onSuccess: ({ order }) =>
        toast.success(`Bought ${order.vehicleLabel} for ${formatINR(order.totalPrice)}.`),
      onError: (error) => toast.error(apiErrorMessage(error)),
      onSettled: () => setConfirming(false),
    });
  }

  function onPaintKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + colours.length) % colours.length;
    setPaint(colours[next]);
    (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  }

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

        {colours.length > 1 && (
          <div role="radiogroup" aria-label="Paint colour" className="flex flex-wrap gap-1">
            {colours.map((hex, index) => {
              const selected = spec.paint === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={names[index]}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setPaint(hex)}
                  onKeyDown={(event) => onPaintKey(event, index)}
                  className="inline-flex size-11 items-center justify-center rounded-full"
                >
                  <span
                    aria-hidden="true"
                    style={{ background: hex }}
                    className={`size-7 rounded-full ring-1 ring-ink/40 ${selected ? 'outline-2 outline-offset-2 outline-ink' : ''}`}
                  />
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-auto pt-1">
          <PurchaseButton
            vehicleName={name}
            quantity={vehicle.quantity}
            onPurchase={() => setConfirming(true)}
          />
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Buy ${name}?`}
          confirmLabel={`Buy for ${formatINR(vehicle.price)}`}
          busy={buy.isPending}
          onConfirm={confirmPurchase}
          onCancel={() => setConfirming(false)}
        >
          <p>
            You are buying one {name} for {formatINR(vehicle.price)}.
          </p>
          <p className="mt-2">
            This is a simulated purchase: no payment is taken, and it only changes the stock count.
          </p>
        </ConfirmDialog>
      )}
    </article>
  );
}
