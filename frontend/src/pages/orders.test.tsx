import { screen, within } from '@testing-library/react';
import { createFakeApi, makeUser, makeVehicle } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const asha = makeUser();

describe('my orders', () => {
  it('invites a first purchase when there are no orders', async () => {
    renderApp('/orders', { signedInAs: asha });
    expect(await screen.findByText('You have not bought a car yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the showroom' })).toHaveAttribute(
      'href',
      '/showroom',
    );
  });

  it('shows a loading status while the orders load', async () => {
    const api = createFakeApi();
    api.state.ordersDelayMs = 150;
    renderApp('/orders', { api, signedInAs: asha });
    expect(await screen.findByRole('status', { name: 'Loading your orders' })).toBeInTheDocument();
    await screen.findByText('You have not bought a car yet.');
  });

  it('lists what was bought with the price paid, not the current price', async () => {
    const api = createFakeApi({
      vehicles: [makeVehicle({ make: 'Honda', model: 'City', price: 125_000_000, quantity: 5 })],
    });
    const { user } = renderApp('/showroom', { api, signedInAs: asha });
    const card = await screen.findByRole('article', { name: 'Honda City' });
    await user.click(within(card).getByRole('button', { name: /buy this car/i }));
    await user.click(screen.getByRole('button', { name: 'Buy for ₹12,50,000' }));
    await screen.findByText('Bought Honda City for ₹12,50,000.');

    // The price changes afterwards; the order keeps the snapshot.
    api.state.vehicles[0]!.price = 140_000_000;
    await user.click(screen.getByRole('link', { name: 'My orders' }));

    const table = await screen.findByRole('table', { name: 'Your orders' });
    const rowEl = within(table).getByRole('row', { name: /Honda City/ });
    expect(within(rowEl).getByText('1')).toBeInTheDocument();
    expect(within(rowEl).getByText('₹12,50,000', { selector: 'td' })).toBeInTheDocument();
    expect(within(rowEl).getByText(/20\d\d/)).toBeInTheDocument();
  });
});
