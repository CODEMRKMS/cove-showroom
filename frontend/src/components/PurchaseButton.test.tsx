import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PurchaseButton } from './PurchaseButton';

const setup = (props: Partial<Parameters<typeof PurchaseButton>[0]> = {}) => {
  const onPurchase = vi.fn();
  render(
    <PurchaseButton vehicleName="Honda City" quantity={5} onPurchase={onPurchase} {...props} />,
  );
  return { onPurchase, user: userEvent.setup() };
};

describe('PurchaseButton with stock', () => {
  it('is an enabled "Buy this car" button that names the car for screen readers', async () => {
    const { onPurchase, user } = setup();
    const button = screen.getByRole('button', { name: 'Buy this car (Honda City)' });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Buy this car');
    await user.click(button);
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  it('stays enabled at one unit left', () => {
    setup({ quantity: 1 });
    expect(screen.getByRole('button', { name: /buy this car/i })).toBeEnabled();
  });
});

describe('PurchaseButton at zero stock', () => {
  it('is disabled and says "Sold out" in visible text', () => {
    setup({ quantity: 0 });
    const button = screen.getByRole('button', { name: /sold out/i });
    expect(button).toBeDisabled();
    expect(button).toBeVisible();
    expect(button).toHaveTextContent('Sold out');
    expect(screen.queryByRole('button', { name: /buy this car/i })).not.toBeInTheDocument();
  });

  it('explains itself in text, not only through colour, and links the explanation to the button', () => {
    setup({ quantity: 0 });
    const button = screen.getByRole('button', { name: /sold out/i });
    expect(button).toHaveAccessibleDescription(/no units left/i);
    expect(screen.getByText(/no units left/i)).toBeVisible();
  });

  it('does nothing when clicked', async () => {
    const { onPurchase, user } = setup({ quantity: 0 });
    await user.click(screen.getByRole('button', { name: /sold out/i }));
    expect(onPurchase).not.toHaveBeenCalled();
  });
});

describe('PurchaseButton while a purchase is in flight', () => {
  it('is disabled, says what is happening, and cannot be double-submitted', async () => {
    const { onPurchase, user } = setup({ busy: true });
    const button = screen.getByRole('button', { name: /buying/i });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onPurchase).not.toHaveBeenCalled();
  });
});
