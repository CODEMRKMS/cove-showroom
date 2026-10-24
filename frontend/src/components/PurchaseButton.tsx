import { useId } from 'react';
import { btnPrimary } from './styles';

type Props = {
  vehicleName: string;
  quantity: number;
  onPurchase: () => void;
  /** True while a purchase request is in flight; blocks a second click. */
  busy?: boolean;
};

/** The one place that decides whether a car can be bought. Sold-out is stated in text, not just greyed. */
export function PurchaseButton({ vehicleName, quantity, onPurchase, busy = false }: Props) {
  const reasonId = useId();

  if (quantity <= 0) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" className={btnPrimary} disabled aria-describedby={reasonId}>
          Sold out
        </button>
        <p id={reasonId} className="text-sm text-graphite">
          No units left. An admin can restock this car.
        </p>
      </div>
    );
  }

  return (
    <button type="button" className={btnPrimary} disabled={busy} onClick={onPurchase}>
      {busy ? (
        'Buying…'
      ) : (
        <>
          Buy this car <span className="sr-only">({vehicleName})</span>
        </>
      )}
    </button>
  );
}
