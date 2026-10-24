import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Toast = { id: number; kind: 'success' | 'error'; message: string };

type ToastApi = { success(message: string): void; error(message: string): void };

const ToastContext = createContext<ToastApi | null>(null);
const SUCCESS_MS = 6000;
let nextId = 1;

/** Short messages that report what really happened. Errors use role=alert so they are announced at once. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (kind: Toast['kind'], message: string) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, kind, message }]);
      // Errors stay until dismissed; a success message fades after a few seconds.
      if (kind === 'success') setTimeout(() => dismiss(id), SUCCESS_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : undefined}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-control border-l-4 bg-white p-3 shadow-lift ${
              toast.kind === 'error' ? 'border-sold' : 'border-stock'
            }`}
          >
            <p className="flex-1 font-semibold text-ink">{toast.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="inline-flex size-11 shrink-0 -my-2 -mr-2 items-center justify-center rounded-control hover:bg-floor"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>');
  return value;
}
