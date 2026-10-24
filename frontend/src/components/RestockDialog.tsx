import { useId, useState, type FormEvent } from 'react';
import type { Vehicle } from '../api/types';
import { apiErrorMessage } from '../lib/messages';
import { Modal } from './Modal';
import { btnPrimary, btnQuiet, field, label } from './styles';

const MAX_RESTOCK = 10_000; // the API's limit per restock

type Props = {
  vehicle: Vehicle;
  onRestock: (quantity: number) => Promise<void>;
  onCancel: () => void;
};

const stepperButton =
  'inline-flex size-11 items-center justify-center rounded-control text-xl font-semibold ring-1 ring-graphite hover:bg-floor disabled:cursor-not-allowed disabled:opacity-50';

/** Adds units to stock. A stepper keeps the number sensible; the button states the exact result. */
export function RestockDialog({ vehicle, onRestock, onCancel }: Props) {
  const inputId = useId();
  const [text, setText] = useState('1');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const quantity = /^\d+$/.test(text) ? Number(text) : NaN;
  const valid = Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_RESTOCK;
  const clamp = (n: number) => String(Math.min(MAX_RESTOCK, Math.max(1, n)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await onRestock(quantity);
    } catch (error) {
      setProblem(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Restock ${vehicle.make} ${vehicle.model}`} onClose={onCancel}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-graphite">Currently {vehicle.quantity} in stock.</p>
        {problem && (
          <p
            role="alert"
            className="rounded-control border border-sold bg-white/70 p-3 font-semibold text-sold"
          >
            {problem}
          </p>
        )}
        <div>
          <label htmlFor={inputId} className={label}>
            Units to add
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Remove one unit"
              className={stepperButton}
              disabled={!valid || quantity <= 1}
              onClick={() => setText(clamp(quantity - 1))}
            >
              −
            </button>
            <input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_RESTOCK}
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={valid ? undefined : true}
              aria-describedby={valid ? undefined : `${inputId}-error`}
              className={`${field} w-28 text-center`}
            />
            <button
              type="button"
              aria-label="Add one unit"
              className={stepperButton}
              disabled={valid && quantity >= MAX_RESTOCK}
              onClick={() => setText(clamp((valid ? quantity : 0) + 1))}
            >
              +
            </button>
          </div>
          {!valid && (
            <p id={`${inputId}-error`} className="mt-1 text-sm font-semibold text-sold">
              Enter a whole number from 1 to {MAX_RESTOCK.toLocaleString('en-IN')}.
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className={btnQuiet} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={!valid || busy}>
            {busy
              ? 'Working…'
              : valid
                ? `Restock ${quantity} ${quantity === 1 ? 'unit' : 'units'}`
                : 'Restock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
