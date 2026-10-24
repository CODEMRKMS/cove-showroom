import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';

function Harness({ onConfirm = vi.fn(), busy = false }: { onConfirm?: () => void; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <ConfirmDialog
          title="Buy Honda City?"
          confirmLabel="Buy for ₹12,50,000"
          busy={busy}
          onConfirm={onConfirm}
          onCancel={() => setOpen(false)}
        >
          <p>This is a simulated purchase.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

describe('Modal', () => {
  it('is a modal dialog named by its title, shown above the page', () => {
    render(
      <Modal title="Edit car" onClose={() => {}}>
        <input aria-label="Make" />
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit car' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Edit car' })).toBeInTheDocument();
  });

  it('moves focus into the dialog, to its first control', () => {
    render(
      <Modal title="Edit car" onClose={() => {}}>
        <input aria-label="Make" />
      </Modal>,
    );
    expect(screen.getByLabelText('Make')).toHaveFocus();
  });

  it('closes on Escape and on the Close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal title="Edit car" onClose={onClose}>
        <input aria-label="Make" />
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>Behind the dialog</button>
        <Modal title="Edit car" onClose={() => {}}>
          <input aria-label="Make" />
          <input aria-label="Model" />
        </Modal>
      </>,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    expect(screen.getByLabelText('Make')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Model')).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Make')).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it('closes when the dimmed backdrop is clicked, but not when the dialog itself is', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal title="Edit car" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    await user.click(screen.getByText('Body'));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmDialog', () => {
  it('shows the question, the detail and two clearly labelled buttons', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByRole('dialog', { name: 'Buy Honda City?' })).toBeInTheDocument();
    expect(screen.getByText('This is a simulated purchase.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy for ₹12,50,000' })).toBeInTheDocument();
  });

  it('calls onConfirm only when the confirm button is pressed', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Buy for ₹12,50,000' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('puts focus on Cancel first, so Enter never confirms by accident', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('returns focus to the button that opened it when cancelled or closed with Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('disables both buttons and says what is happening while busy', async () => {
    const user = userEvent.setup();
    render(<Harness busy />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled();
  });
});
