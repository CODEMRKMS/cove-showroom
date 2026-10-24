import { screen, within } from '@testing-library/react';
import { axeViolations } from '../test/axe';
import { createFakeApi, makeUser, makeVehicle } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const asha = makeUser();
const admin = makeUser({ name: 'Dev Admin', role: 'ADMIN' });
const api = () =>
  createFakeApi({
    vehicles: [
      makeVehicle({ make: 'Honda', model: 'City', quantity: 5 }),
      makeVehicle({
        make: 'Tata',
        model: 'Nexon EV',
        category: 'EV',
        bodyStyle: 'EV',
        quantity: 0,
      }),
    ],
  });

describe('axe: no detectable accessibility violations on the main pages', () => {
  it('login', async () => {
    renderApp('/login');
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    expect(await axeViolations()).toEqual([]);
  });

  it('register, including its error state', async () => {
    const { user } = renderApp('/register');
    await user.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Name')).toBeInvalid();
    expect(await axeViolations()).toEqual([]);
  });

  it('showroom', async () => {
    renderApp('/showroom', { api: api(), signedInAs: asha });
    await screen.findByRole('article', { name: 'Honda City' });
    expect(await axeViolations()).toEqual([]);
  });

  it('showroom with the purchase dialog open', async () => {
    const { user } = renderApp('/showroom', { api: api(), signedInAs: asha });
    const card = await screen.findByRole('article', { name: 'Honda City' });
    await user.click(within(card).getByRole('button', { name: /buy this car/i }));
    await screen.findByRole('dialog');
    expect(await axeViolations()).toEqual([]);
  });

  it('my orders', async () => {
    renderApp('/orders', { api: api(), signedInAs: asha });
    await screen.findByText('You have not bought a car yet.');
    expect(await axeViolations()).toEqual([]);
  });

  it('admin inventory', async () => {
    renderApp('/admin', { api: api(), signedInAs: admin });
    await screen.findByRole('row', { name: /Honda City/ });
    expect(await axeViolations()).toEqual([]);
  });

  it('admin add dialog', async () => {
    const { user } = renderApp('/admin', { api: api(), signedInAs: admin });
    await screen.findByRole('row', { name: /Honda City/ });
    await user.click(screen.getByRole('button', { name: 'Add to inventory' }));
    await screen.findByRole('dialog', { name: 'Add to inventory' });
    expect(await axeViolations()).toEqual([]);
  });

  it('404', async () => {
    renderApp('/nowhere');
    await screen.findByRole('heading', { level: 1, name: 'Page not found' });
    expect(await axeViolations()).toEqual([]);
  });
});
