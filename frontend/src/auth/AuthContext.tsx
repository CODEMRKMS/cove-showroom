import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createApiClient, createTokenStore, type ApiClient } from '../api/client';
import type { LoginResponse, User } from '../api/types';

type AuthState =
  { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; user: User };

type RegisterInput = { name: string; email: string; password: string };

type AuthContextValue = {
  state: AuthState;
  /** The API client; it holds the in-memory access token and refreshes it once when it expires. */
  api: ApiClient;
  login(email: string, password: string): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // The client reports an expired session through this tiny signal, which the effect below listens to.
  const [{ api, tokens, sessionExpired }] = useState(() => {
    const tokens = createTokenStore();
    const listeners = new Set<() => void>();
    return {
      tokens,
      sessionExpired: {
        subscribe(listener: () => void) {
          listeners.add(listener);
          return () => void listeners.delete(listener);
        },
      },
      api: createApiClient({ tokens, onSessionExpired: () => listeners.forEach((fn) => fn()) }),
    };
  });

  useEffect(
    () =>
      sessionExpired.subscribe(() => {
        queryClient.clear();
        setState({ status: 'anonymous' });
      }),
    [sessionExpired, queryClient],
  );

  // On page load the access token is gone (it only lives in memory), so ask the cookie for a new one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await api.refresh();
      if (cancelled) return;
      if (!token) return setState({ status: 'anonymous' });
      try {
        const user = await api.request<User>('/api/auth/me');
        if (!cancelled) setState({ status: 'authenticated', user });
      } catch {
        if (!cancelled) setState({ status: 'anonymous' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api.request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      tokens.set(session.accessToken);
      setState({ status: 'authenticated', user: session.user });
    },
    [api, tokens],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await api.request('/api/auth/register', { method: 'POST', body: input });
      await login(input.email, input.password);
    },
    [api, login],
  );

  const logout = useCallback(async () => {
    try {
      await api.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the server cannot be reached, this browser forgets the session.
    }
    tokens.clear();
    queryClient.clear();
    setState({ status: 'anonymous' });
  }, [api, tokens, queryClient]);

  const value = useMemo(
    () => ({ state, api, login, register, logout }),
    [state, api, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** The signed-in user. Only call this below a route guard. */
export function useUser(): User {
  const { state } = useAuth();
  if (state.status !== 'authenticated') throw new Error('useUser needs a signed-in user');
  return state.user;
}
