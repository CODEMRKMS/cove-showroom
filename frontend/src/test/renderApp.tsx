import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { User } from '../api/types';
import { AppProviders, AppRoutes } from '../App';
import { createFakeApi, type FakeApi } from './fakeApi';
import { server } from './server';

type Options = {
  api?: FakeApi;
  /** Start with a refresh cookie for this user, as if they had signed in earlier. */
  signedInAs?: User;
};

/** Renders the whole app at a route against the fake API. Returns the fake so tests can read what happened. */
export function renderApp(route = '/', { api = createFakeApi(), signedInAs }: Options = {}) {
  server.use(...api.handlers);
  if (signedInAs) {
    api.state.cookieUser = signedInAs;
    if (!api.state.accounts.some((a) => a.user.id === signedInAs.id)) {
      api.state.accounts.push({ user: signedInAs, password: 'correct-horse-9' });
    }
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders queryClient={queryClient}>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
  return { ...view, api, user: userEvent.setup(), queryClient };
}
