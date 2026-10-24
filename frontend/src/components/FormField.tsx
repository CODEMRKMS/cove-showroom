import {
  useId,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
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

type ShellProps = {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
};

/** Hint and error ids, and the aria props that link them to a control. */
function useDescribed({ hint, error }: Pick<ShellProps, 'hint' | 'error'>) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return {
    id,
    control: {
      id,
      'aria-invalid': error ? (true as const) : undefined,
      'aria-describedby': describedBy || undefined,
    },
    notes: (
      <>
        {hint && (
          <p id={`${id}-hint`} className="mt-1 text-sm text-graphite">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-sold">
            {error}
          </p>
        )}
      </>
    ),
  };
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...rest
}: ShellProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>) {
  const { id, control, notes } = useDescribed({ hint, error });
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select {...rest} {...control} className={field}>
        {children}
      </select>
      {notes}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  ...rest
}: ShellProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>) {
  const { id, control, notes } = useDescribed({ hint, error });
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea {...rest} {...control} rows={3} className={`${field} py-2`} />
      {notes}
    </div>
  );
}
