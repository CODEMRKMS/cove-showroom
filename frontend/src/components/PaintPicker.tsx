import type { KeyboardEvent } from 'react';
import { describeColour } from '../lib/carSpec';

/** "White", "Black", and "Grey 2" when two paints would share a name. */
export function paintNames(colours: string[]): string[] {
  const seen = new Map<string, number>();
  return colours.map((hex) => {
    const base = describeColour(hex);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const name = base.charAt(0).toUpperCase() + base.slice(1);
    return count === 1 ? name : `${name} ${count}`;
  });
}

type Props = {
  colours: string[];
  /** The paint in use, lower case, as in CarSpec.paint. */
  selected: string;
  onSelect: (hex: string) => void;
};

/** Paint swatches as a radio group: arrow keys move and choose, one swatch is in the tab order. */
export function PaintPicker({ colours, selected, onSelect }: Props) {
  const names = paintNames(colours);

  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + colours.length) % colours.length;
    onSelect(colours[next]!);
    (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Paint colour" className="flex flex-wrap gap-1">
      {colours.map((hex, index) => {
        const isSelected = selected === hex.toLowerCase();
        return (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={names[index]}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(hex)}
            onKeyDown={(event) => onKey(event, index)}
            className="inline-flex size-11 items-center justify-center rounded-full"
          >
            <span
              aria-hidden="true"
              style={{ background: hex }}
              className={`size-7 rounded-full ring-1 ring-ink/40 ${isSelected ? 'outline-2 outline-offset-2 outline-ink' : ''}`}
            />
          </button>
        );
      })}
    </div>
  );
}
