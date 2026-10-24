import { screen } from '@testing-library/react';
import { axeViolations } from '../test/axe';
import { makeUser } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

describe('landing page at "/"', () => {
  it('shows signed-out visitors a hero, how it works, the demo note and the two sign-in buttons', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/cove/i);
    expect(
      screen.getByRole('img', { name: /sedan|hatchback|suv|coupe|sports/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'How it works' })).toBeInTheDocument();
    expect(screen.getByText(/^demo project/i, { selector: 'p' })).toHaveTextContent(
      /no real cars/i,
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('does not ask the protected vehicle API for anything', async () => {
    const { api } = renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(api.state.searches).toHaveLength(0);
  });

  it('sends signed-in visitors to the showroom', async () => {
    renderApp('/', { signedInAs: makeUser() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Showroom' })).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 2, name: 'How it works' });
    expect(await axeViolations()).toEqual([]);
  });
});
