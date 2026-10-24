import { useState } from 'react';
import { useBuyVehicle } from '../api/vehicles';
import type { Order, Vehicle } from '../api/types';
import { apiErrorMessage } from '../lib/messages';
import { formatINR } from '../lib/money';
import { ConfirmDialog } from './ConfirmDialog';
import { PurchaseButton } from './PurchaseButton';
import { useToast } from './Toast';

type Props = {
  vehicle: Vehicle;
  /** Called once the server has accepted the purchase, after the dialog has closed. */
  onPurchased?: (order: Order) => void;
};

/** The guarded Buy button, its confirmation dialog and the toast that reports the real result. */
export function PurchaseControl({ vehicle, onPurchased }: Props) {
  const [confirming, setConfirming] = useState(false);
  const buy = useBuyVehicle();
  const toast = useToast();
  const name = `${vehicle.make} ${vehicle.model}`;

  function confirmPurchase() {
    // The dialog closes first: while it is open, the page behind it (and the toasts) is hidden from
    // screen readers, so a toast raised now would not be announced.
    buy.mutate(vehicle, {
      onSuccess: ({ order }) => {
        setConfirming(false);
        toast.success(`Bought ${order.vehicleLabel} for ${formatINR(order.totalPrice)}.`);
        onPurchased?.(order);
      },
      onError: (error) => {
        setConfirming(false);
        toast.error(apiErrorMessage(error));
      },
    });
  }

  return (
    <>
      <PurchaseButton
        vehicleName={name}
        quantity={vehicle.quantity}
        onPurchase={() => setConfirming(true)}
      />
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
    </>
  );
}
