import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { SessionCheck } from '../auth/guards';
import { fieldErrors, loginSchema, type FieldErrors } from '../auth/schemas';
import { FormField } from '../components/FormField';
import { btnPrimary } from '../components/styles';
import { apiErrorMessage } from '../lib/messages';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { state, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/showroom';

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'loading') return <SessionCheck />;
  if (state.status === 'authenticated') return <Navigate to={from} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = fieldErrors(loginSchema, values);
    setErrors(found);
    setProblem(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await login(values.email.trim(), values.password);
    } catch (error) {
      setProblem(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl">Sign in</h1>
      <p className="mt-2 text-graphite">Sign in to browse the showroom and buy a car.</p>
      <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        {problem && (
          <p
            role="alert"
            className="rounded-control border border-sold bg-white/70 p-3 font-semibold text-sold"
          >
            {problem}
          </p>
        )}
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={values.email}
          error={errors.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          revealable
          required
          value={values.password}
          error={errors.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-graphite">
        New here?{' '}
        <Link to="/register" className="font-semibold text-ink underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
