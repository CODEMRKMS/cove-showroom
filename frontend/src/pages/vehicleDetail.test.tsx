import { screen, waitFor, within } from '@testing-library/react';
import { contrastRatio, pickAccent } from '../lib/accent';
import { formatINR } from '../lib/money';
import { axeViolations } from '../test/axe';
import { createFakeApi, makeUser, makeVehicle } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const asha = makeUser();
const city = makeVehicle({
  id: 'car-city',
  make: 'Honda',
  model: 'City',
  category: 'SEDAN',
  bodyStyle: 'SEDAN',
  year: 2025,
  price: 125_000_000,
  quantity: 5,
  colorOptions: ['#F2F2F2', '#1B1B1B'],
  description: 'A small, sensible sedan.',
});
const nexon = makeVehicle({
  id: 'car-nexon',
  make: 'Tata',
  model: 'Nexon EV',
  category: 'EV',
  bodyStyle: 'EV',
  quantity: 0,
  colorOptions: ['#1F5FBF'],
});
// Copies, so a purchase in one test never changes the stock another test sees.
const api = () => createFakeApi({ vehicles: [{ ...city }, { ...nexon }] });

const open = async (id = 'car-city') => {
  const view = renderApp(`/vehicles/${id}`, { api: api(), signedInAs: asha });
  await screen.findByRole('heading', { level: 1 });
  return view;
};

describe('vehicle detail page', () => {
  it('shows the car, its price and stock, its specs and a way back', async () => {
    await open();
    expect(screen.getByRole('heading', { level: 1, name: 'Honda City' })).toBeInTheDocument();
    expect(screen.getByText(formatINR(city.price))).toBeInTheDocument();
    expect(screen.getByText('5 in stock')).toBeInTheDocument();
    const specs = screen.getByRole('list', { name: 'Specifications' });
    expect(within(specs).getByText('Sedan')).toBeInTheDocument();
    expect(within(specs).getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('A small, sensible sedan.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to showroom/i })).toHaveAttribute(
      'href',
      '/showroom',
    );
    expect(screen.getByRole('img', { name: /Honda City.*sedan/i })).toBeInTheDocument();
  });

  it('lets the visitor pick a paint, and the picture follows', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('radio', { name: 'Black' }));
    expect(screen.getByRole('radio', { name: 'Black' })).toBeChecked();
    expect(screen.getByRole('img', { name: /Honda City.*black/i })).toBeInTheDocument();
  });

  it('buys one unit after confirmation and shows the new stock', async () => {
    const { user, api: fake } = await open();
    await user.click(screen.getByRole('button', { name: /buy this car/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^buy for/i }));
    expect(await screen.findByText('4 in stock')).toBeInTheDocument();
    expect(fake.state.orders).toHaveLength(1);
  });

  it('disables Buy for a sold-out car and says why', async () => {
    await open('car-nexon');
    expect(screen.getByText('Sold out', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sold out' })).toBeDisabled();
  });

  it('says so when the car does not exist', async () => {
    renderApp('/vehicles/car-nope', { api: api(), signedInAs: asha });
    expect(
      await screen.findByRole('heading', { level: 1, name: /car not found/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to showroom/i })).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in first', async () => {
    renderApp('/vehicles/car-city', { api: api() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    await open();
    expect(await axeViolations()).toEqual([]);
  });
});

describe('showroom cards link to the detail page', () => {
  it('has a "View details" link on every card', async () => {
    renderApp('/showroom', { api: api(), signedInAs: asha });
    const card = await screen.findByRole('article', { name: 'Honda City' });
    const link = within(card).getByRole('link', { name: /view details/i });
    expect(link).toHaveAttribute('href', '/vehicles/car-city');
    await waitFor(() => expect(link).toBeVisible());
  });
});

describe('page accent follows the paint', () => {
  const rootAccent = () => document.documentElement.style.getPropertyValue('--accent');

  it('sets the accent for the first paint, moves it with the choice, and clears it on leaving', async () => {
    const { user, unmount } = await open();
    expect(rootAccent()).toBe(pickAccent('#f2f2f2').accent);
    await user.click(screen.getByRole('radio', { name: 'Black' }));
    expect(rootAccent()).toBe(pickAccent('#1b1b1b').accent);
    unmount();
    expect(rootAccent()).toBe('');
  });

  it('uses a darker shade when the paint is too light to read as text', async () => {
    const pale = makeVehicle({ id: 'car-pale', colorOptions: ['#FFF200'] });
    renderApp('/vehicles/car-pale', {
      api: createFakeApi({ vehicles: [pale] }),
      signedInAs: asha,
    });
    await screen.findByRole('heading', { level: 1 });
    const accent = rootAccent();
    expect(accent).not.toBe('#fff200');
    for (const surface of ['#efeae2', '#e2dbd0']) {
      expect(contrastRatio(accent, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('purchase moment', () => {
  it('shows a plain confirmation with the price paid and the stock left, and a link to the orders', async () => {
    const { user } = await open();
    expect(screen.queryByRole('region', { name: /purchase complete/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /buy this car/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^buy for/i }));
    const panel = await screen.findByRole('region', { name: /purchase complete/i });
    expect(within(panel).getByText(/Honda City/)).toBeInTheDocument();
    expect(within(panel).getByText(formatINR(city.price), { exact: false })).toBeInTheDocument();
    expect(within(panel).getByText(/4 left in stock/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /view my orders/i })).toHaveAttribute(
      'href',
      '/orders',
    );
  });

  it('does not show the confirmation when the purchase is refused', async () => {
    const fake = api();
    const { user } = renderApp('/vehicles/car-city', { api: fake, signedInAs: asha });
    await screen.findByRole('heading', { level: 1 });
    fake.state.vehicles[0]!.quantity = 0;
    await user.click(screen.getByRole('button', { name: /buy this car/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^buy for/i }));
    await screen.findAllByText(/units left/i);
    expect(screen.queryByRole('region', { name: /purchase complete/i })).not.toBeInTheDocument();
  });
});
