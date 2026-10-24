import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { SessionCheck } from '../auth/guards';
import {
  fieldErrors,
  MIN_PASSWORD_LENGTH,
  registerSchema,
  type FieldErrors,
} from '../auth/schemas';
import { FormField } from '../components/FormField';
import { btnPrimary } from '../components/styles';
import { apiErrorMessage } from '../lib/messages';
import { useDocumentTitle } from '../lib/useDocumentTitle';

type Field = 'name' | 'email' | 'password';

export function RegisterPage() {
  useDocumentTitle('Create your account');
  const { state, register } = useAuth();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'loading') return <SessionCheck />;
  if (state.status === 'authenticated') return <Navigate to="/showroom" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = fieldErrors(registerSchema, values);
    setErrors(found);
    setProblem(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await register({ ...values, name: values.name.trim(), email: values.email.trim() });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setErrors({ email: 'An account with this email already exists. Sign in instead.' });
      } else if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        // Show the server's per-field messages next to the fields they belong to.
        const mapped: FieldErrors<Field> = {};
        for (const { field, message } of error.errors) {
          if (field === 'name' || field === 'email' || field === 'password')
            mapped[field] = message;
        }
        setErrors(mapped);
        if (Object.keys(mapped).length === 0) setProblem(apiErrorMessage(error));
      } else {
        setProblem(apiErrorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl">Create your account</h1>
      <p className="mt-2 text-graphite">
        All fields are required. New accounts can browse and buy; admins are set up separately.
      </p>
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
          label="Name"
          autoComplete="name"
          required
          value={values.name}
          error={errors.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
        />
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
          autoComplete="new-password"
          revealable
          required
          hint={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}
          value={values.password}
          error={errors.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-graphite">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-ink underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
