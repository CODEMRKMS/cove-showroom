import type { RefreshResponse } from './types';

export type FieldError = { field: string; message: string };

/** What every failed API call becomes. `status` 0 means the server could not be reached at all. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
    readonly errors: FieldError[] = [],
    readonly requestId?: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

/**
 * Holds the short-lived access token. It lives in a closure, so it is gone when the tab closes and
 * is never written to localStorage, sessionStorage or a cookie that script can read.
 */
export type TokenStore = { get(): string | null; set(token: string): void; clear(): void };

export function createTokenStore(): TokenStore {
  let token: string | null = null;
  return {
    get: () => token,
    set: (next) => {
      token = next;
    },
    clear: () => {
      token = null;
    },
  };
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: URLSearchParams;
};

export type ApiClient = {
  request<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  /** Trades the refresh cookie for a new access token. Null when there is no valid session. */
  refresh(): Promise<string | null>;
};

export type ApiClientOptions = {
  fetch?: typeof fetch;
  tokens: TokenStore;
  /** Called when a signed-in session can no longer be kept alive. */
  onSessionExpired?: () => void;
};

const REFRESH_PATH = '/api/auth/refresh';
// A 401 from these means "wrong credentials" or "no session", not "your token expired".
const NO_REFRESH_PATHS = new Set(['/api/auth/login', '/api/auth/register', REFRESH_PATH]);

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      code?: string;
      detail?: string;
      errors?: FieldError[];
      requestId?: string;
    };
    if (body.code && body.detail) {
      return new ApiError(response.status, body.code, body.detail, body.errors, body.requestId);
    }
  } catch {
    // Not JSON (for example a gateway error page): fall through to the generic message.
  }
  return new ApiError(
    response.status,
    `HTTP_${response.status}`,
    `The server answered with an unexpected response (${response.status}). Try again shortly.`,
  );
}

export function createApiClient({
  fetch: fetchImpl = (...args) => fetch(...args),
  tokens,
  onSessionExpired,
}: ApiClientOptions): ApiClient {
  async function send(path: string, options: RequestOptions, withToken = true): Promise<Response> {
    const headers = new Headers();
    // The refresh call authenticates with the cookie alone; a stale bearer token would only confuse it.
    const token = withToken ? tokens.get() : null;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    const query = options.query?.toString();
    try {
      return await fetchImpl(query ? `${path}?${query}` : path, {
        method: options.method ?? 'GET',
        headers,
        credentials: 'same-origin',
        ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
      });
    } catch {
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        'Cannot reach the server. Check your connection and try again.',
      );
    }
  }

  // Requests that fail at the same moment must share one refresh, because a refresh token works once.
  let refreshing: Promise<string | null> | null = null;

  function refresh(): Promise<string | null> {
    refreshing ??= (async () => {
      try {
        const response = await send(REFRESH_PATH, { method: 'POST' }, false);
        if (!response.ok) return null;
        const { accessToken } = (await response.json()) as RefreshResponse;
        tokens.set(accessToken);
        return accessToken;
      } catch {
        return null;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  function expireSession(): void {
    tokens.clear();
    onSessionExpired?.();
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let response = await send(path, options);

    if (response.status === 401 && !NO_REFRESH_PATHS.has(path)) {
      if ((await refresh()) === null) {
        expireSession();
        throw await toApiError(response);
      }
      response = await send(path, options);
      if (response.status === 401) {
        expireSession();
        throw await toApiError(response);
      }
    }

    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return { request, refresh };
}
