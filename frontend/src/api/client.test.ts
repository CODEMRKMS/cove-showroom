import { ApiError, createApiClient, createTokenStore, type TokenStore } from './client';

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const refreshOk = (accessToken: string) =>
  json(200, { accessToken, tokenType: 'Bearer', expiresIn: 900 });

const problem = (status: number, code: string, detail: string, extra: object = {}) =>
  json(status, { type: 'about:blank', title: 'Error', status, code, detail, ...extra });

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fetchMock: FetchMock = vi.fn(async (input, init) => handler(String(input), init ?? {}));
  const tokens = createTokenStore();
  const onSessionExpired = vi.fn();
  const client = createApiClient({ fetch: fetchMock, tokens, onSessionExpired });
  return { client, tokens, fetchMock, onSessionExpired };
}

const headerOf = (init: RequestInit | undefined, name: string) =>
  new Headers(init?.headers).get(name);
const callsTo = (fetchMock: FetchMock, path: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url) === path);

describe('token store', () => {
  it('starts empty, holds a token, and clears it', () => {
    const tokens = createTokenStore();
    expect(tokens.get()).toBeNull();
    tokens.set('abc');
    expect(tokens.get()).toBe('abc');
    tokens.clear();
    expect(tokens.get()).toBeNull();
  });

  it('keeps the token in memory only: nothing reaches web storage or cookies', () => {
    const tokens: TokenStore = createTokenStore();
    tokens.set('secret-access-token');
    const stored = [localStorage, sessionStorage].flatMap((storage) =>
      Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`),
    );
    expect(stored.join()).not.toContain('secret-access-token');
    expect(document.cookie).not.toContain('secret-access-token');
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('gives each store its own token', () => {
    const a = createTokenStore();
    const b = createTokenStore();
    a.set('one');
    expect(b.get()).toBeNull();
  });
});

describe('request basics', () => {
  it('sends the bearer token when there is one and none when there is not', async () => {
    const { client, tokens, fetchMock } = setup(() => json(200, { ok: true }));
    await client.request('/api/vehicles');
    expect(headerOf(fetchMock.mock.calls[0]?.[1], 'Authorization')).toBeNull();
    tokens.set('t1');
    await client.request('/api/vehicles');
    expect(headerOf(fetchMock.mock.calls[1]?.[1], 'Authorization')).toBe('Bearer t1');
  });

  it('sends JSON bodies with a content type, and appends query parameters', async () => {
    const { client, fetchMock } = setup(() => json(200, {}));
    await client.request('/api/vehicles', {
      method: 'POST',
      body: { make: 'Tata' },
      query: new URLSearchParams({ page: '2' }),
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('/api/vehicles?page=2');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"make":"Tata"}');
    expect(headerOf(init, 'Content-Type')).toBe('application/json');
  });

  it('returns the parsed body, or undefined for 204', async () => {
    const ok = setup(() => json(200, { hello: 'world' }));
    expect(await ok.client.request('/api/x')).toEqual({ hello: 'world' });
    const empty = setup(() => new Response(null, { status: 204 }));
    expect(await empty.client.request('/api/x', { method: 'DELETE' })).toBeUndefined();
  });
});

describe('errors', () => {
  it('turns the backend problem envelope into an ApiError', async () => {
    const { client } = setup(() =>
      problem(409, 'OUT_OF_STOCK', 'Only 0 units left.', {
        errors: [{ field: 'quantity', message: 'Too many' }],
      }),
    );
    const error = await client.request('/api/x', { method: 'POST' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'OUT_OF_STOCK',
      detail: 'Only 0 units left.',
      errors: [{ field: 'quantity', message: 'Too many' }],
    });
  });

  it('gives a readable error when the server answers with something that is not JSON', async () => {
    const { client } = setup(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await client.request('/api/x').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: 'HTTP_502' });
    expect((error as ApiError).detail).not.toContain('<html>');
  });

  it('reports a network failure as NETWORK_ERROR with advice', async () => {
    const { client } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    const error = await client.request('/api/x').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect((error as ApiError).detail).toMatch(/connection/i);
  });
});

describe('silent refresh', () => {
  /** A fake API: /protected needs the "fresh" token; refresh hands it out. */
  function protectedApi() {
    return setup((url, init) => {
      if (url === '/api/auth/refresh') return refreshOk('fresh');
      return headerOf(init, 'Authorization') === 'Bearer fresh'
        ? json(200, { secret: 42 })
        : problem(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    });
  }

  it('refreshes once through the cookie, stores the new token and retries the request', async () => {
    const { client, tokens, fetchMock } = protectedApi();
    tokens.set('expired');
    expect(await client.request('/api/protected')).toEqual({ secret: 42 });
    expect(tokens.get()).toBe('fresh');
    expect(callsTo(fetchMock, '/api/auth/refresh')).toHaveLength(1);
    const refreshInit = callsTo(fetchMock, '/api/auth/refresh')[0]![1];
    expect(refreshInit?.method).toBe('POST');
    expect(refreshInit?.credentials).toBe('same-origin');
    expect(headerOf(refreshInit, 'Authorization')).toBeNull();
    expect(callsTo(fetchMock, '/api/protected')).toHaveLength(2);
  });

  it('shares one refresh between requests that fail at the same time', async () => {
    const { client, tokens, fetchMock } = protectedApi();
    tokens.set('expired');
    const results = await Promise.all([
      client.request('/api/protected'),
      client.request('/api/protected'),
      client.request('/api/protected'),
    ]);
    expect(results).toHaveLength(3);
    expect(callsTo(fetchMock, '/api/auth/refresh')).toHaveLength(1);
  });

  it('signs out cleanly when the refresh is refused: clears the token and tells the app once', async () => {
    const { client, tokens, onSessionExpired } = setup(() =>
      problem(401, 'UNAUTHENTICATED', 'Sign in to continue.'),
    );
    tokens.set('expired');
    await expect(client.request('/api/protected')).rejects.toMatchObject({ status: 401 });
    expect(tokens.get()).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does not loop: if the retried request is still refused it gives up after one refresh', async () => {
    const { client, tokens, fetchMock, onSessionExpired } = setup((url) =>
      url === '/api/auth/refresh'
        ? refreshOk('fresh')
        : problem(401, 'UNAUTHENTICATED', 'Sign in to continue.'),
    );
    tokens.set('expired');
    await expect(client.request('/api/protected')).rejects.toMatchObject({ status: 401 });
    expect(callsTo(fetchMock, '/api/auth/refresh')).toHaveLength(1);
    expect(callsTo(fetchMock, '/api/protected')).toHaveLength(2);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does not try to refresh when a login attempt is refused', async () => {
    const { client, fetchMock, onSessionExpired } = setup(() =>
      problem(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
    );
    await expect(
      client.request('/api/auth/login', { method: 'POST', body: { email: 'a', password: 'b' } }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(callsTo(fetchMock, '/api/auth/refresh')).toHaveLength(0);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('only refreshes on 401, not on 403 or 409', async () => {
    const { client, fetchMock } = setup(() => problem(403, 'FORBIDDEN', 'No.'));
    await expect(client.request('/api/admin/events')).rejects.toMatchObject({ status: 403 });
    expect(callsTo(fetchMock, '/api/auth/refresh')).toHaveLength(0);
  });

  it('refresh() restores a session on page load and returns the token, or null', async () => {
    const good = setup(() => refreshOk('restored'));
    expect(await good.client.refresh()).toBe('restored');
    expect(good.tokens.get()).toBe('restored');

    const bad = setup(() => problem(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
    expect(await bad.client.refresh()).toBeNull();
    expect(bad.tokens.get()).toBeNull();
    // A visitor who was never signed in is not an "expired session".
    expect(bad.onSessionExpired).not.toHaveBeenCalled();
  });
});
