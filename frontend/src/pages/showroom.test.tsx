import { screen, waitFor, within } from '@testing-library/react';
import { pickAccent } from '../lib/accent';
import { createFakeApi, makeUser, makeVehicle, type FakeApi } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const asha = makeUser();

function showroomApi(extra: ReturnType<typeof makeVehicle>[] = []): FakeApi {
  return createFakeApi({
    vehicles: [
      makeVehicle({
        make: 'Honda',
        model: 'City',
        category: 'SEDAN',
        bodyStyle: 'SEDAN',
        price: 125_000_000,
        quantity: 5,
        colorOptions: ['#F2F2F2', '#1B1B1B'],
        createdAt: '2026-10-03T00:00:00.000Z',
      }),
      makeVehicle({
        make: 'Tata',
        model: 'Nexon EV',
        category: 'EV',
        bodyStyle: 'EV',
        price: 150_000_000,
        quantity: 0,
        colorOptions: ['#1F5FBF'],
        createdAt: '2026-10-02T00:00:00.000Z',
      }),
      makeVehicle({
        make: 'Maruti Suzuki',
        model: 'Swift',
        category: 'HATCHBACK',
        bodyStyle: 'HATCHBACK',
        price: 65_000_000,
        quantity: 2,
        colorOptions: ['#C0392B'],
        createdAt: '2026-10-01T00:00:00.000Z',
      }),
      ...extra,
    ],
  });
}

const open = async (route = '/showroom', api = showroomApi()) => {
  const view = renderApp(route, { api, signedInAs: asha });
  await screen.findByRole('heading', { level: 1, name: 'Showroom' });
  return { ...view, api };
};

const card = (name: string) => screen.findByRole('article', { name });
const lastSearch = (api: FakeApi) => api.state.searches.at(-1)!;

describe('showroom listing', () => {
  it('shows a loading status first, then every car with name, price and category', async () => {
    const api = showroomApi();
    api.state.searchDelayMs = 100;
    await open('/showroom', api);
    expect(screen.getByRole('status', { name: 'Loading cars' })).toBeInTheDocument();

    const honda = await card('Honda City');
    expect(within(honda).getByText('₹12,50,000')).toBeInTheDocument();
    expect(within(honda).getByText('Sedan')).toBeInTheDocument();
    expect(await card('Tata Nexon EV')).toBeInTheDocument();
    expect(await card('Maruti Suzuki Swift')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading cars' })).not.toBeInTheDocument();
  });

  it('announces the number of results in a live region', async () => {
    await open();
    const count = await screen.findByText('3 cars found');
    expect(count).toHaveAttribute('aria-live', 'polite');
  });

  it('states stock in words: how many, "Low stock" at 3 or fewer, "Sold out" at zero', async () => {
    await open();
    expect(within(await card('Honda City')).getByText('5 in stock')).toBeInTheDocument();
    expect(
      within(await card('Maruti Suzuki Swift')).getByText('Low stock: 2 left'),
    ).toBeInTheDocument();
    expect(
      within(await card('Tata Nexon EV')).getByText('Sold out', { selector: 'p' }),
    ).toBeInTheDocument();
  });

  it('disables Purchase with the text "Sold out" only on the car with no stock', async () => {
    await open();
    expect(
      within(await card('Tata Nexon EV')).getByRole('button', { name: 'Sold out' }),
    ).toBeDisabled();
    expect(
      within(await card('Honda City')).getByRole('button', { name: /buy this car/i }),
    ).toBeEnabled();
  });

  it('draws each car as an image described for screen readers', async () => {
    await open();
    const honda = await card('Honda City');
    expect(
      within(honda).getByRole('img', { name: '2025 Honda City, sedan, white' }),
    ).toBeInTheDocument();
  });

  it('lets the visitor try another paint, which re-describes the car and re-tints the card', async () => {
    const { user } = await open();
    const honda = await card('Honda City');
    const paint = within(honda).getByRole('radiogroup', { name: 'Paint colour' });
    expect(within(paint).getByRole('radio', { name: 'White' })).toBeChecked();
    await user.click(within(paint).getByRole('radio', { name: 'Black' }));
    expect(within(paint).getByRole('radio', { name: 'Black' })).toBeChecked();
    expect(
      within(honda).getByRole('img', { name: '2025 Honda City, sedan, black' }),
    ).toBeInTheDocument();
    expect(honda.style.getPropertyValue('--accent')).toBe(pickAccent('#1b1b1b').accent);
  });

  it('asks the API for page 1 of 12, newest first, by default', async () => {
    const { api } = await open();
    await card('Honda City');
    const params = lastSearch(api);
    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe('12');
    expect(params.get('sort')).toBe('-createdAt');
  });
});

describe('filters', () => {
  it('searches make or model after a short pause and shows only matches', async () => {
    const { user, api } = await open();
    await card('Honda City');
    await user.type(screen.getByRole('searchbox', { name: 'Search make or model' }), 'swift');
    await waitFor(() => expect(lastSearch(api).get('q')).toBe('swift'));
    expect(await screen.findByText('1 car found')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Honda City' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Maruti Suzuki Swift' })).toBeInTheDocument();
  });

  it('filters by category with toggle buttons that say which one is on', async () => {
    const { user, api } = await open();
    await card('Honda City');
    const group = screen.getByRole('group', { name: 'Category' });
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(group).getByRole('button', { name: 'EV' }));
    expect(within(group).getByRole('button', { name: 'EV' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await waitFor(() => expect(lastSearch(api).get('category')).toBe('EV'));
    expect(await screen.findByText('1 car found')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Tata Nexon EV' })).toBeInTheDocument();
  });

  it('filters by a price range typed in rupees and sends it to the API in paise', async () => {
    const { user, api } = await open();
    await card('Honda City');
    await user.type(screen.getByLabelText('Minimum price in rupees'), '700000');
    await user.type(screen.getByLabelText('Maximum price in rupees'), '1300000');
    await waitFor(() => {
      expect(lastSearch(api).get('minPrice')).toBe('70000000');
      expect(lastSearch(api).get('maxPrice')).toBe('130000000');
    });
    expect(await screen.findByText('1 car found')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Honda City' })).toBeInTheDocument();
  });

  it('explains a minimum above the maximum instead of sending a request the API would reject', async () => {
    const { user, api } = await open();
    await card('Honda City');
    await user.type(screen.getByLabelText('Minimum price in rupees'), '900000');
    await user.type(screen.getByLabelText('Maximum price in rupees'), '500000');
    expect(
      await screen.findByText('The minimum price is higher than the maximum.'),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const rejected = api.state.searches.filter(
      (p) => p.get('minPrice') === '90000000' && p.get('maxPrice') === '50000000',
    );
    expect(rejected).toHaveLength(0);
  });

  it('filters to cars in stock', async () => {
    const { user, api } = await open();
    await card('Honda City');
    await user.click(screen.getByRole('checkbox', { name: 'In stock only' }));
    await waitFor(() => expect(lastSearch(api).get('inStock')).toBe('true'));
    expect(await screen.findByText('2 cars found')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Tata Nexon EV' })).not.toBeInTheDocument();
  });

  it('sorts by price when asked', async () => {
    const { user, api } = await open();
    await card('Honda City');
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Price: low to high');
    await waitFor(() => expect(lastSearch(api).get('sort')).toBe('price'));
    await waitFor(() => {
      const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
      expect(names).toEqual(['Maruti Suzuki Swift', 'Honda City', 'Tata Nexon EV']);
    });
  });

  it('keeps filters in the URL, so a shared link opens with them applied', async () => {
    const { api } = await open(
      '/showroom?q=honda&category=SEDAN&inStock=true&minPrice=500000&sort=price',
    );
    await card('Honda City');
    const params = lastSearch(api);
    expect(params.get('q')).toBe('honda');
    expect(params.get('category')).toBe('SEDAN');
    expect(params.get('inStock')).toBe('true');
    expect(params.get('minPrice')).toBe('50000000');
    expect(params.get('sort')).toBe('price');
    expect(screen.getByRole('searchbox', { name: 'Search make or model' })).toHaveValue('honda');
    expect(screen.getByRole('button', { name: 'Sedan' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: 'In stock only' })).toBeChecked();
    expect(screen.getByLabelText('Minimum price in rupees')).toHaveValue('500000');
    expect(screen.getByLabelText('Sort by')).toHaveValue('price');
  });
});

describe('empty, error and paging states', () => {
  it('invites the visitor to clear filters when nothing matches, and clearing brings the cars back', async () => {
    const { user } = await open('/showroom?q=zzzz');
    expect(await screen.findByText('No cars match these filters.')).toBeInTheDocument();
    expect(screen.getByText('0 cars found')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await card('Honda City')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search make or model' })).toHaveValue('');
  });

  it('shows an empty-inventory message, without a Clear filters button, when there are no cars at all', async () => {
    await open('/showroom', createFakeApi({ vehicles: [] }));
    expect(await screen.findByText('The showroom is empty right now.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('says what went wrong when the API fails and retries on request', async () => {
    const api = showroomApi();
    api.state.failSearches = 1;
    const { user } = await open('/showroom', api);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on our side. Try again in a moment.');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await card('Honda City')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('pages through more than 12 cars and keeps the page in the URL', async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      makeVehicle({
        make: 'Filler',
        model: `Car ${i + 1}`,
        createdAt: `2026-09-0${(i % 9) + 1}T00:00:00.000Z`,
      }),
    );
    const { user, api } = await open('/showroom', showroomApi(many));
    await card('Honda City');
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(lastSearch(api).get('page')).toBe('2'));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});
