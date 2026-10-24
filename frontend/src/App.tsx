import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin, RequireAuth } from './auth/guards';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrdersPage } from './pages/OrdersPage';
import { RegisterPage } from './pages/RegisterPage';
import { ShowroomPage } from './pages/ShowroomPage';

/** Everything the pages share: server-state cache and the signed-in session. */
export function AppProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  /** Tests pass their own client so one test's cache never leaks into the next. */
  queryClient?: QueryClient;
}) {
  const [defaultClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient ?? defaultClient}>
      <AuthProvider>{children}</AuthProvider>
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
