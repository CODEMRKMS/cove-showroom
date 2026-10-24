import { Navigate, Outlet, useLocation } from 'react-router';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { useAuth } from './AuthContext';

export function SessionCheck() {
  return (
    <p role="status" className="p-8 text-graphite">
      Checking your session…
    </p>
  );
}

/** Pages that need a signed-in user. Sends everyone else to /login and remembers where they were going. */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <SessionCheck />;
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Pages only admins use. The API enforces this too; this keeps the UI honest. */
export function RequireAdmin() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  return state.user.role === 'ADMIN' ? <Outlet /> : <ForbiddenPage />;
}
