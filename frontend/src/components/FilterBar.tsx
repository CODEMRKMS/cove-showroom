import { useEffect, useId, useState } from 'react';
import { CATEGORIES, SORT_OPTIONS } from '../api/types';
import { hasActiveFilters, hasInvalidPriceRange, type Filters } from '../lib/filters';
import { CATEGORY_LABELS, SORT_LABELS } from '../lib/labels';
import { btnQuiet, field, label } from './styles';

const DEBOUNCE_MS = 300;

/**
 * A text box whose value is committed to the URL after a short pause. If the URL changes for another
 * reason (Clear filters, the back button) the box follows it. `pushed` remembers what this box last
 * sent, so its own commits are not mistaken for outside changes.
 */
function useDebouncedField(value: string, commit: (next: string) => void) {
  const [draft, setDraft] = useState(value);
  const [pushed, setPushed] = useState(value);
  if (value !== pushed) {
    setPushed(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === pushed) return;
    const timer = setTimeout(() => {
      setPushed(draft);
      commit(draft);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, pushed, commit]);
  return [draft, setDraft] as const;
}

type Props = {
  filters: Filters;
  /** `replace` keeps typing from filling the browser history with one entry per pause. */
  onChange: (change: Partial<Filters>, options?: { replace?: boolean }) => void;
  onClear: () => void;
  /** Hidden when the page already shows its own Clear filters button (the empty state). */
  showClear?: boolean;
};

export function FilterBar({ filters, onChange, onClear, showClear = true }: Props) {
  const sortId = useId();
  const searchId = useId();

  // Whole rupees only. Anything else is not sent; the field explains itself instead.
  function commitPrice(key: 'minRupees' | 'maxRupees', text: string) {
    const clean = text.replaceAll(',', '').trim();
    if (clean === '') onChange({ [key]: null }, { replace: true });
    else if (/^\d+$/.test(clean)) onChange({ [key]: Number(clean) }, { replace: true });
  }
  const [q, setQ] = useDebouncedField(filters.q, (next) =>
    onChange({ q: next.trim() }, { replace: true }),
  );
  const [min, setMin] = useDebouncedField(String(filters.minRupees ?? ''), (next) =>
    commitPrice('minRupees', next),
  );
  const [max, setMax] = useDebouncedField(String(filters.maxRupees ?? ''), (next) =>
    commitPrice('maxRupees', next),
  );

  const priceProblem = (text: string) =>
    text.trim() !== '' && !/^[\d,]+$/.test(text.trim())
      ? 'Enter whole rupees, like 500000.'
      : undefined;

  const invalidRange = hasInvalidPriceRange(filters);

  return (
    <search aria-label="Filter cars" className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={searchId} className={label}>
            Search make or model
          </label>
          <input
            id={searchId}
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Try Swift or Honda"
            className={field}
          />
        </div>
        <div>
          <label htmlFor={sortId} className={label}>
            Sort by
          </label>
          <select
            id={sortId}
            value={filters.sort}
            onChange={(event) => onChange({ sort: event.target.value as Filters['sort'] })}
            className={`${field} sm:w-56`}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
        {[null, ...CATEGORIES].map((category) => {
          const pressed = filters.category === category;
          return (
            <button
              key={category ?? 'all'}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange({ category })}
              className={`inline-flex min-h-11 items-center rounded-full px-4 font-semibold ring-1 ring-graphite ${
                pressed ? 'bg-ink text-white ring-ink' : 'bg-transparent text-ink hover:bg-floor'
              }`}
            >
              {category ? CATEGORY_LABELS[category] : 'All'}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <PriceInput
          label="Minimum price in rupees"
          value={min}
          onChange={setMin}
          error={priceProblem(min)}
        />
        <PriceInput
          label="Maximum price in rupees"
          value={max}
          onChange={setMax}
          error={priceProblem(max)}
        />
        <label className="flex min-h-11 items-center gap-3 font-semibold sm:mt-6">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(event) => onChange({ inStock: event.target.checked })}
            className="size-5 accent-accent"
          />
          In stock only
        </label>
        {showClear && hasActiveFilters(filters) && (
          <button type="button" className={`${btnQuiet} sm:mt-6`} onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>

      {invalidRange && (
        <p className="font-semibold text-sold">The minimum price is higher than the maximum.</p>
      )}
    </search>
  );
}

function PriceInput({
  label: text,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="No limit"
        className={`${field} sm:w-48`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-sold">
          {error}
        </p>
      )}
    </div>
  );
}
