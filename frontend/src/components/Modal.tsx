import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = { title: string; onClose: () => void; children: ReactNode };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * An accessible modal dialog: named by its title, focus moves in and is trapped, Escape and the
 * backdrop close it, and focus returns to whatever opened it. The Close button is last in the DOM so
 * the form fields come first in the tab order; CSS places it in the top corner.
 */
export function Modal({ title, onClose, children }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Everything behind the dialog is hidden from assistive technology and cannot take focus.
    const behind = [...document.body.children].filter((el) => el !== backdrop.current);
    const saved = behind.map(
      (el) => [el, el.getAttribute('aria-hidden'), el.hasAttribute('inert')] as const,
    );
    behind.forEach((el) => {
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
    });
    const first = body.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      saved.forEach(([el, hidden, wasInert]) => {
        if (hidden === null) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', hidden);
        if (!wasInert) el.removeAttribute('inert');
      });
      opener?.focus();
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      ref={backdrop}
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-wall p-6 shadow-lift sm:rounded-card"
      >
        <h2 id={titleId} className="font-display pr-12 text-xl">
          {title}
        </h2>
        <div ref={body} className="mt-4">
          {children}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => onClose()}
          className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-floor"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  );
}
