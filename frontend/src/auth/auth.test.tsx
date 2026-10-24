import { screen, waitFor, within } from '@testing-library/react';
import { createFakeApi, makeUser } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const asha = makeUser({ email: 'asha@example.com', name: 'Asha Rao' });
const admin = makeUser({ email: 'admin@example.com', name: 'Dev Admin', role: 'ADMIN' });

const apiWithAccounts = () =>
  createFakeApi({
    accounts: [
      { user: asha, password: 'correct-horse-9' },
      { user: admin, password: 'correct-horse-9' },
    ],
  });

describe('login page', () => {
  it('has a heading, labelled fields with the right autocomplete, and a link to register', async () => {
    renderApp('/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('shows and hides the password on request', async () => {
    const { user } = renderApp('/login');
    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('explains each empty field next to it, linked with aria-describedby', async () => {
    const { user } = renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    expect(email).toBeInvalid();
    expect(email).toHaveAccessibleDescription('Enter your email address.');
    expect(password).toBeInvalid();
    expect(password).toHaveAccessibleDescription('Enter your password.');
  });

  it('signs in, lands on the showroom and shows the person in the header', async () => {
    const { user, api } = renderApp('/login', { api: apiWithAccounts() });
    await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-9');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Showroom' })).toBeInTheDocument();
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(api.state.cookieUser?.email).toBe('asha@example.com');
  });

  it('says what went wrong for a wrong password and lets the person try again', async () => {
    const { user } = renderApp('/login', { api: apiWithAccounts() });
    await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'not-the-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('blocks a second submit while the first is in flight', async () => {
    const api = apiWithAccounts();
    api.state.loginDelayMs = 200;
    const { user } = renderApp('/login', { api });
    await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-9');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    // The button flips to its busy state straight away.
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    await screen.findByRole('heading', { level: 1, name: 'Showroom' });
  });

  it('sends a signed-in person who opens /login on to the showroom', async () => {
    renderApp('/login', { signedInAs: asha });
    expect(await screen.findByRole('heading', { level: 1, name: 'Showroom' })).toBeInTheDocument();
  });
});

describe('register page', () => {
  it('has labelled fields, autocomplete hints and the password rule stated up front', async () => {
    renderApp('/register');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Use at least 10 characters.',
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('checks every field before sending anything', async () => {
    const { user, api } = renderApp('/register');
    await user.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter your name.');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      expect.stringContaining('Use at least 10 characters.'),
    );

    await user.type(screen.getByLabelText('Name'), 'Asha');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Enter a valid email address, like name@example.com.',
    );
    expect(screen.getByLabelText('Password')).toBeInvalid();
    expect(api.state.accounts).toHaveLength(0);
  });

  it('creates the account, signs the person in and opens the showroom', async () => {
    const { user, api } = renderApp('/register');
    await user.type(await screen.findByLabelText('Name'), 'Meera Iyer');
    await user.type(screen.getByLabelText('Email'), 'Meera@Example.com');
    await user.type(screen.getByLabelText('Password'), 'a-long-enough-pass');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Showroom' })).toBeInTheDocument();
    expect(screen.getByText('Meera Iyer')).toBeInTheDocument();
    expect(api.state.accounts.map((a) => a.user.email)).toEqual(['meera@example.com']);
  });

  it('puts the "email taken" problem on the email field with a way forward', async () => {
    const { user } = renderApp('/register', { api: apiWithAccounts() });
    await user.type(await screen.findByLabelText('Name'), 'Another Asha');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-long-enough-pass');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
        'An account with this email already exists. Sign in instead.',
      ),
    );
    expect(screen.getByLabelText('Email')).toBeInvalid();
  });
});

describe('route guards and session', () => {
  it('sends a visitor who is not signed in to the login page', async () => {
    renderApp('/showroom');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('returns the person to the page they asked for after they sign in', async () => {
    const { user } = renderApp('/orders', { api: apiWithAccounts() });
    await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-9');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'My orders' })).toBeInTheDocument();
  });

  it('restores a session from the refresh cookie on page load, with no login form', async () => {
    renderApp('/showroom', { signedInAs: asha });
    expect(await screen.findByRole('heading', { level: 1, name: 'Showroom' })).toBeInTheDocument();
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
  });

  it('keeps working after the access token expires, using one silent refresh', async () => {
    const { user, api } = renderApp('/showroom', { signedInAs: asha });
    await screen.findByRole('heading', { level: 1, name: 'Showroom' });
    api.state.epoch += 1; // the token the app holds is now stale
    await user.click(screen.getByRole('link', { name: 'My orders' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'My orders' })).toBeInTheDocument();
  });

  it('signs out cleanly: the cookie is revoked and guarded pages ask for a login again', async () => {
    const { user, api } = renderApp('/showroom', { signedInAs: asha });
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(api.state.cookieUser).toBeNull();
  });

  it('shows the Admin link and admin page only to admins', async () => {
    const first = renderApp('/showroom', { signedInAs: asha });
    await screen.findByRole('heading', { level: 1, name: 'Showroom' });
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    first.unmount();

    renderApp('/showroom', { signedInAs: admin });
    await screen.findByRole('heading', { level: 1, name: 'Showroom' });
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('tells a non-admin who opens /admin that the page is for admins, instead of a blank page', async () => {
    renderApp('/admin', { signedInAs: asha });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Admins only' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the showroom' })).toBeInTheDocument();
  });

  it('lets an admin into /admin', async () => {
    renderApp('/admin', { signedInAs: admin });
    expect(await screen.findByRole('heading', { level: 1, name: 'Inventory' })).toBeInTheDocument();
  });
});

describe('layout', () => {
  it('has a skip link, landmarks and a footer that says purchases are simulated', async () => {
    renderApp('/login');
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText(/simulated/i)).toBeInTheDocument();
  });

  it('marks the current page in the navigation', async () => {
    renderApp('/showroom', { signedInAs: asha });
    await screen.findByRole('heading', { level: 1, name: 'Showroom' });
    expect(screen.getByRole('link', { name: 'Showroom' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'My orders' })).not.toHaveAttribute('aria-current');
  });

  it('has a custom 404 page with a way back', async () => {
    renderApp('/no-such-page');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the showroom' })).toHaveAttribute(
      'href',
      '/showroom',
    );
  });
});
