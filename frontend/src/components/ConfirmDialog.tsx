import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { btnDanger, btnPrimary, btnQuiet } from './styles';

type Props = {
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** True while the confirmed action is running; locks both buttons and ignores Escape. */
  busy?: boolean;
  /** Use for destructive actions such as delete. */
  danger?: boolean;
  children?: ReactNode;
};

/** Asks before an action that changes stock or removes a car. Cancel is focused first. */
export function ConfirmDialog({
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
  children,
}: Props) {
  return (
    <Modal title={title} onClose={busy ? () => {} : onCancel}>
      <div className="text-graphite">{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className={btnQuiet} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={danger ? btnDanger : btnPrimary}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
