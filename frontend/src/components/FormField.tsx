import { useId, useState, type InputHTMLAttributes } from 'react';
import { field, label as labelClass } from './styles';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'aria-describedby' | 'aria-invalid'
> & {
  label: string;
  /** Always-visible help, such as a password rule. */
  hint?: string;
  /** Problem with this field. Shown in text, linked with aria-describedby, and sets aria-invalid. */
  error?: string | undefined;
  /** Adds a show/hide button; only meaningful for type="password". */
  revealable?: boolean;
};

/** A labelled input with hint and error text wired up for assistive technology. */
export function FormField({
  label,
  hint,
  error,
  revealable = false,
  type = 'text',
  required,
  ...rest
}: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          {...rest}
          id={id}
          type={revealable && revealed ? 'text' : type}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${field} ${revealable ? 'pr-24' : ''}`}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="absolute top-0 right-0 inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-ink underline"
          >
            {revealed ? 'Hide password' : 'Show password'}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-graphite">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm font-semibold text-sold">
          {error}
        </p>
      )}
    </div>
  );
}
