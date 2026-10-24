import { screen, waitFor, within } from '@testing-library/react';
import { createFakeApi, makeUser, makeVehicle, type FakeApi } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const admin = makeUser({ name: 'Dev Admin', email: 'admin@example.com', role: 'ADMIN' });

function adminApi(): FakeApi {
  return createFakeApi({
    vehicles: [
      makeVehicle({
        make: 'Honda',
        model: 'City',
        price: 125_000_000,
        quantity: 5,
        category: 'SEDAN',
      }),
      makeVehicle({
        make: 'Tata',
        model: 'Nexon EV',
        price: 150_000_000,
        quantity: 0,
        category: 'EV',
        bodyStyle: 'EV',
      }),
      makeVehicle({
        make: 'Maruti Suzuki',
        model: 'Swift',
        price: 65_000_000,
        quantity: 2,
        category: 'HATCHBACK',
        bodyStyle: 'HATCHBACK',
      }),
    ],
  });
}

const open = async (api = adminApi()) => {
  const view = renderApp('/admin', { api, signedInAs: admin });
  await screen.findByRole('heading', { level: 1, name: 'Inventory' });
  await screen.findByRole('row', { name: /Honda City/ });
  return { ...view, api };
};

const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('summary and table', () => {
  it('summarises the inventory from the real numbers', async () => {
    await open();
    const tile = (name: string) => screen.getByRole('group', { name });
    expect(within(tile('Vehicles')).getByText('3')).toBeInTheDocument();
    expect(within(tile('Units in stock')).getByText('7')).toBeInTheDocument();
    expect(within(tile('Low stock')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Sold out')).getByText('1')).toBeInTheDocument();
  });

  it('lists every car with price in INR and stock in words', async () => {
    await open();
    const honda = row('Honda City');
    expect(within(honda).getByText('₹12,50,000')).toBeInTheDocument();
    expect(within(honda).getByText('5 in stock')).toBeInTheDocument();
    expect(within(row('Tata Nexon EV')).getByText('Sold out')).toBeInTheDocument();
    expect(within(row('Maruti Suzuki Swift')).getByText('Low stock: 2 left')).toBeInTheDocument();
  });

  it('searches the inventory and sorts by a column, saying which way it is sorted', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Sort by Price' }));
    expect(screen.getByRole('columnheader', { name: /Price/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    const names = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((r) => within(r).getByRole('rowheader').textContent);
    expect(names()).toEqual(['Maruti Suzuki Swift', 'Honda City', 'Tata Nexon EV']);
    await user.click(screen.getByRole('button', { name: 'Sort by Price' }));
    expect(screen.getByRole('columnheader', { name: /Price/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await user.type(screen.getByRole('searchbox', { name: 'Search inventory' }), 'nexon');
    expect(screen.queryByRole('row', { name: /Honda City/ })).not.toBeInTheDocument();
    expect(row('Tata Nexon EV')).toBeInTheDocument();
  });

  it('shows an alert with a retry when the inventory cannot be loaded', async () => {
    const api = adminApi();
    api.state.failSearches = 1;
    const { user } = renderApp('/admin', { api, signedInAs: admin });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Try again in a moment.');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('row', { name: /Honda City/ })).toBeInTheDocument();
  });
});

describe('add a vehicle', () => {
  it('checks required fields and says what to fix, without sending anything', async () => {
    const { user, api } = await open();
    await user.click(screen.getByRole('button', { name: 'Add to inventory' }));
    const dialog = screen.getByRole('dialog', { name: 'Add to inventory' });
    await user.click(within(dialog).getByRole('button', { name: 'Add to inventory' }));
    expect(within(dialog).getByLabelText('Make')).toHaveAccessibleDescription('Enter the make.');
    expect(within(dialog).getByLabelText('Model')).toHaveAccessibleDescription('Enter the model.');
    expect(within(dialog).getByLabelText('Price in rupees')).toHaveAccessibleDescription(
      'Enter the price in whole rupees, like 650000.',
    );
    expect(within(dialog).getByLabelText('Quantity in stock')).toHaveAccessibleDescription(
      'Enter how many units are in stock (0 or more).',
    );
    expect(api.state.vehicles).toHaveLength(3);
  });

  it('rejects paint colours that are not hex codes', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Add to inventory' }));
    const dialog = screen.getByRole('dialog', { name: 'Add to inventory' });
    await user.type(within(dialog).getByLabelText('Paint colours'), 'red, #1B1B1B');
    await user.click(within(dialog).getByRole('button', { name: 'Add to inventory' }));
    expect(within(dialog).getByLabelText('Paint colours')).toHaveAccessibleDescription(
      expect.stringContaining('Use six-digit hex codes'),
    );
  });

  it('previews the car live as the form changes', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Add to inventory' }));
    const dialog = screen.getByRole('dialog', { name: 'Add to inventory' });
    await user.type(within(dialog).getByLabelText('Make'), 'Kia');
    await user.type(within(dialog).getByLabelText('Model'), 'Seltos');
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'SUV');
    await user.type(within(dialog).getByLabelText('Paint colours'), '#1B1B1B');
    expect(within(dialog).getByRole('img', { name: 'Kia Seltos, SUV, black' })).toBeInTheDocument();
  });

  it('creates the vehicle in paise, closes the dialog, adds the row and reports it', async () => {
    const { user, api } = await open();
    await user.click(screen.getByRole('button', { name: 'Add to inventory' }));
    const dialog = screen.getByRole('dialog', { name: 'Add to inventory' });
    await user.type(within(dialog).getByLabelText('Make'), 'Kia');
    await user.type(within(dialog).getByLabelText('Model'), 'Seltos');
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'SUV');
    await user.type(within(dialog).getByLabelText('Price in rupees'), '14,50,000');
    await user.type(within(dialog).getByLabelText('Quantity in stock'), '4');
    await user.type(within(dialog).getByLabelText('Year'), '2025');
    await user.type(within(dialog).getByLabelText('Paint colours'), '#1B1B1B, #F2F2F2');
    await user.click(within(dialog).getByRole('button', { name: 'Add to inventory' }));

    expect(await screen.findByText('Added Kia Seltos to the inventory.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /Kia Seltos/ })).toBeInTheDocument();
    expect(api.state.vehicles.at(-1)).toMatchObject({
      make: 'Kia',
      model: 'Seltos',
      category: 'SUV',
      bodyStyle: 'SUV',
      price: 145_000_000,
      quantity: 4,
      year: 2025,
      colorOptions: ['#1B1B1B', '#F2F2F2'],
    });
  });
});

describe('edit a vehicle', () => {
  it('opens with the current values and saves a changed price', async () => {
    const { user, api } = await open();
    await user.click(screen.getByRole('button', { name: 'Edit Honda City' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Honda City' });
    expect(within(dialog).getByLabelText('Make')).toHaveValue('Honda');
    expect(within(dialog).getByLabelText('Price in rupees')).toHaveValue('1250000');
    expect(within(dialog).queryByLabelText('Quantity in stock')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Change stock with Restock/)).toBeInTheDocument();

    const price = within(dialog).getByLabelText('Price in rupees');
    await user.clear(price);
    await user.type(price, '1300000');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved changes to Honda City.')).toBeInTheDocument();
    expect(api.state.vehicles[0]?.price).toBe(130_000_000);
    expect(await within(row('Honda City')).findByText('₹13,00,000')).toBeInTheDocument();
  });

  it("shows the server's field errors next to the field", async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Edit Honda City' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Honda City' });
    await user.clear(within(dialog).getByLabelText('Make'));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(within(dialog).getByLabelText('Make')).toHaveAccessibleDescription('Enter the make.');
  });
});

describe('restock', () => {
  it('uses a quantity stepper whose button says exactly what will happen', async () => {
    const { user, api } = await open();
    await user.click(screen.getByRole('button', { name: 'Restock Honda City' }));
    const dialog = screen.getByRole('dialog', { name: 'Restock Honda City' });
    const units = within(dialog).getByLabelText('Units to add');
    expect(units).toHaveValue(1);
    expect(within(dialog).getByRole('button', { name: 'Restock 1 unit' })).toBeInTheDocument();
    for (let i = 0; i < 4; i += 1) {
      await user.click(within(dialog).getByRole('button', { name: 'Add one unit' }));
    }
    expect(units).toHaveValue(5);
    await user.click(within(dialog).getByRole('button', { name: 'Remove one unit' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add one unit' }));
    await user.click(within(dialog).getByRole('button', { name: 'Restock 5 units' }));

    expect(await screen.findByText('Restocked Honda City: 10 in stock.')).toBeInTheDocument();
    expect(api.state.vehicles[0]?.quantity).toBe(10);
    expect(await within(row('Honda City')).findByText('10 in stock')).toBeInTheDocument();
  });

  it('never goes below one unit', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Restock Honda City' }));
    const dialog = screen.getByRole('dialog', { name: 'Restock Honda City' });
    expect(within(dialog).getByRole('button', { name: 'Remove one unit' })).toBeDisabled();
  });

  it('brings a sold-out car back into stock', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Restock Tata Nexon EV' }));
    await user.click(screen.getByRole('button', { name: 'Restock 1 unit' }));
    expect(await within(row('Tata Nexon EV')).findByText('Low stock: 1 left')).toBeInTheDocument();
  });
});

describe('delete', () => {
  it('names the car in the question and does nothing if cancelled', async () => {
    const { user, api } = await open();
    await user.click(screen.getByRole('button', { name: 'Delete Honda City' }));
    expect(screen.getByRole('dialog', { name: 'Delete Honda City?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.state.vehicles).toHaveLength(3);
  });

  it('deletes after confirmation, removes the row and updates the summary', async () => {
    const { user, api } = await open();
    await user.click(screen.getByRole('button', { name: 'Delete Honda City' }));
    await user.click(screen.getByRole('button', { name: 'Delete Honda City' }));
    expect(await screen.findByText('Deleted Honda City.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Honda City/ })).not.toBeInTheDocument(),
    );
    expect(api.state.vehicles).toHaveLength(2);
    expect(
      within(screen.getByRole('group', { name: 'Vehicles' })).getByText('2'),
    ).toBeInTheDocument();
  });
});

describe('activity feed', () => {
  it('lists recent inventory events in plain words and refreshes after an action', async () => {
    const { user } = await open();
    const feed = screen.getByRole('region', { name: 'Recent activity' });
    expect(within(feed).getByText('No activity yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restock Honda City' }));
    await user.click(screen.getByRole('button', { name: 'Restock 1 unit' }));
    expect(
      await within(feed).findByText('Dev Admin restocked Honda City: +1, 6 in stock'),
    ).toBeInTheDocument();
  });
});
