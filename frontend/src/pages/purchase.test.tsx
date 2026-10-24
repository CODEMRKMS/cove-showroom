import { screen, waitFor, within } from '@testing-library/react';
import { createFakeApi, makeUser, makeVehicle } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const asha = makeUser();

const setup = async (quantity: number) => {
  const honda = makeVehicle({ make: 'Honda', model: 'City', price: 125_000_000, quantity });
  const api = createFakeApi({ vehicles: [honda] });
  const view = renderApp('/showroom', { api, signedInAs: asha });
  const article = await screen.findByRole('article', { name: 'Honda City' });
  return { ...view, api, honda, article };
};

describe('purchase flow', () => {
  it('asks for confirmation first, naming the car and the price, and says it is simulated', async () => {
    const { user, article, api } = await setup(5);
    await user.click(within(article).getByRole('button', { name: /buy this car/i }));
    const dialog = screen.getByRole('dialog', { name: 'Buy Honda City?' });
    expect(within(dialog).getByText(/₹12,50,000/)).toBeInTheDocument();
    expect(within(dialog).getByText(/simulated/i)).toBeInTheDocument();
    expect(api.state.orders).toHaveLength(0);
  });

  it('does nothing when the visitor cancels, and puts focus back on the Buy button', async () => {
    const { user, article, api } = await setup(5);
    const buy = within(article).getByRole('button', { name: /buy this car/i });
    await user.click(buy);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(buy).toHaveFocus();
    expect(api.state.orders).toHaveLength(0);
    expect(within(article).getByText('5 in stock')).toBeInTheDocument();
  });

  it('buys one unit: stock drops on the card, a toast reports the real result, an order exists', async () => {
    const { user, article, api, honda } = await setup(5);
    await user.click(within(article).getByRole('button', { name: /buy this car/i }));
    await user.click(screen.getByRole('button', { name: 'Buy for ₹12,50,000' }));

    expect(await screen.findByText('Bought Honda City for ₹12,50,000.')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Notifications' })).toHaveTextContent(
      'Bought Honda City',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(within(article).getByText('4 in stock')).toBeInTheDocument());
    expect(honda.quantity).toBe(4);
    expect(api.state.orders).toHaveLength(1);
    expect(api.state.orders[0]).toMatchObject({
      vehicleLabel: 'Honda City',
      totalPrice: 125_000_000,
    });
  });

  it('turns the button into a disabled "Sold out" when the last unit is bought', async () => {
    const { user, article } = await setup(1);
    await user.click(within(article).getByRole('button', { name: /buy this car/i }));
    await user.click(screen.getByRole('button', { name: 'Buy for ₹12,50,000' }));
    await waitFor(() =>
      expect(within(article).getByRole('button', { name: 'Sold out' })).toBeDisabled(),
    );
    expect(within(article).getByText('Sold out', { selector: 'p' })).toBeInTheDocument();
  });

  it('rolls back and explains when someone else bought the last unit first (409)', async () => {
    const { user, article, honda } = await setup(2);
    // The page still shows 2, but the server has since sold everything.
    honda.quantity = 0;
    await user.click(within(article).getByRole('button', { name: /buy this car/i }));
    await user.click(screen.getByRole('button', { name: 'Buy for ₹12,50,000' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Only 0 units left.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The optimistic change is undone and the card shows the real stock.
    await waitFor(() =>
      expect(within(article).getByRole('button', { name: 'Sold out' })).toBeDisabled(),
    );
    expect(screen.queryByText(/Bought Honda City/)).not.toBeInTheDocument();
  });
});
