import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { ApiError } from './api/client';
import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin, RequireAuth } from './auth/guards';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrdersPage } from './pages/OrdersPage';
import { RegisterPage } from './pages/RegisterPage';
import { ShowroomPage } from './pages/ShowroomPage';

// Retry once for network trouble and server errors; a 4xx will not get better by asking again.
const shouldRetry = (count: number, error: unknown) =>
  count < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500);

/** Everything the pages share: server-state cache and the signed-in session. */
export function AppProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  /** Tests pass their own client so one test's cache never leaks into the next. */
  queryClient?: QueryClient;
}) {
  const [defaultClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient ?? defaultClient}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/showroom" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/showroom" element={<ShowroomPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
