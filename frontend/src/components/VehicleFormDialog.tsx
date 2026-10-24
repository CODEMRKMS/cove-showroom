import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import type { VehicleInput } from '../api/inventory';
import { CATEGORIES, type Category, type Vehicle } from '../api/types';
import { buildCarSpec } from '../lib/carSpec';
import { CATEGORY_LABELS } from '../lib/labels';
import { apiErrorMessage } from '../lib/messages';
import { rupeesToPaise } from '../lib/money';
import { CarIllustration } from './CarIllustration';
import { FormField, SelectField, TextAreaField } from './FormField';
import { Modal } from './Modal';
import { btnPrimary, btnQuiet } from './styles';

type Field = 'make' | 'model' | 'price' | 'quantity' | 'year' | 'colours' | 'description';
type Errors = Partial<Record<Field, string>>;

type Values = {
  make: string;
  model: string;
  category: Category;
  price: string;
  quantity: string;
  year: string;
  colours: string;
  description: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_COLOURS = 8;
const COLOUR_HELP = 'Use six-digit hex codes separated by commas, like #C0392B, #1B1B1B.';
const MAX_YEAR = new Date().getFullYear() + 1;

const splitColours = (text: string) =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

function initialValues(vehicle?: Vehicle): Values {
  return {
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    category: vehicle?.category ?? 'SEDAN',
    // Whole rupees when there are no paise, otherwise rupees with two decimals.
    price: vehicle ? String(vehicle.price / 100) : '',
    quantity: '',
    year: vehicle?.year ? String(vehicle.year) : '',
    colours: vehicle?.colorOptions.join(', ') ?? '',
    description: vehicle?.description ?? '',
  };
}

/** Checks the form. Returns messages per field, or the payload to send. */
function validate(values: Values, creating: boolean): { errors: Errors } | { input: VehicleInput } {
  const errors: Errors = {};
  if (!values.make.trim()) errors.make = 'Enter the make.';
  if (!values.model.trim()) errors.model = 'Enter the model.';

  const price = rupeesToPaise(values.price);
  if (price === null || price <= 0) errors.price = 'Enter the price in whole rupees, like 650000.';

  let quantity: number | undefined;
  if (creating) {
    if (/^\d+$/.test(values.quantity.trim())) quantity = Number(values.quantity.trim());
    else errors.quantity = 'Enter how many units are in stock (0 or more).';
  }

  const yearText = values.year.trim();
  let year: number | null = null;
  if (yearText) {
    year = Number(yearText);
    if (!/^\d{4}$/.test(yearText) || year < 1886 || year > MAX_YEAR) {
      errors.year = 'Enter a four-digit year, like 2025.';
    }
  }

  const colours = splitColours(values.colours);
  if (colours.length > MAX_COLOURS || colours.some((colour) => !HEX.test(colour))) {
    errors.colours = COLOUR_HELP;
  }
  if (values.description.length > 2000)
    errors.description = 'Keep the description under 2,000 characters.';

  if (Object.keys(errors).length > 0 || price === null) return { errors };
  const description = values.description.trim();
  return {
    input: {
      make: values.make.trim(),
      model: values.model.trim(),
      category: values.category,
      // The illustration is chosen by body style, which follows the category.
      bodyStyle: values.category,
      price,
      ...(quantity !== undefined && { quantity }),
      ...(creating
        ? { ...(year !== null && { year }), ...(description && { description }) }
        : { year, description: description || null }),
      colorOptions: colours,
    },
  };
}

const SERVER_FIELDS: Record<string, Field> = {
  make: 'make',
  model: 'model',
  price: 'price',
  quantity: 'quantity',
  year: 'year',
  colorOptions: 'colours',
  description: 'description',
};

type Props = {
  /** Present when editing; absent when adding. */
  vehicle?: Vehicle;
  onSubmit: (input: VehicleInput) => Promise<void>;
  onCancel: () => void;
};

/** Add-or-edit form in a dialog, with a live preview of the car. Quantity is set only when adding. */
export function VehicleFormDialog({ vehicle, onSubmit, onCancel }: Props) {
  const creating = !vehicle;
  const title = vehicle ? `Edit ${vehicle.make} ${vehicle.model}` : 'Add to inventory';
  const [values, setValues] = useState(() => initialValues(vehicle));
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof Values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setProblem(null);
    const result = validate(values, creating);
    if ('errors' in result) return setErrors(result.errors);
    setErrors({});

    setBusy(true);
    try {
      await onSubmit(result.input);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        const mapped: Errors = {};
        for (const { field, message } of error.errors) {
          const key = SERVER_FIELDS[field];
          if (key) mapped[key] = message;
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

  // The preview uses whatever part of the form is already valid.
  const previewYear = /^\d{4}$/.test(values.year.trim()) ? Number(values.year.trim()) : null;
  const spec = buildCarSpec({
    make: values.make.trim(),
    model: values.model.trim(),
    year: previewYear,
    bodyStyle: values.category,
    colorOptions: splitColours(values.colours).filter((colour) => HEX.test(colour)),
  });

  return (
    <Modal title={title} onClose={onCancel}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <CarIllustration spec={spec} className="mx-auto h-auto w-full max-w-xs" />
        {problem && (
          <p
            role="alert"
            className="rounded-control border border-sold bg-white/70 p-3 font-semibold text-sold"
          >
            {problem}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Make"
            value={values.make}
            error={errors.make}
            onChange={set('make')}
            required
          />
          <FormField
            label="Model"
            value={values.model}
            error={errors.model}
            onChange={set('model')}
            required
          />
          <SelectField label="Category" value={values.category} onChange={set('category')}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </SelectField>
          <FormField
            label="Price in rupees"
            inputMode="numeric"
            value={values.price}
            error={errors.price}
            onChange={set('price')}
            required
          />
          {creating ? (
            <FormField
              label="Quantity in stock"
              inputMode="numeric"
              value={values.quantity}
              error={errors.quantity}
              onChange={set('quantity')}
              required
            />
          ) : (
            <p className="self-end pb-2 text-sm text-graphite">
              Stock is {vehicle.quantity}. Change stock with Restock, so every change is recorded.
            </p>
          )}
          <FormField
            label="Year"
            inputMode="numeric"
            value={values.year}
            error={errors.year}
            onChange={set('year')}
          />
        </div>
        <FormField
          label="Paint colours"
          value={values.colours}
          error={errors.colours}
          hint="Optional. Hex codes separated by commas, like #C0392B, #1B1B1B."
          onChange={set('colours')}
        />
        <TextAreaField
          label="Description"
          value={values.description}
          error={errors.description}
          onChange={set('description')}
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className={btnQuiet} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? 'Saving…' : creating ? 'Add to inventory' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
