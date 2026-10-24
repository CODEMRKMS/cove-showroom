import { useEffect } from 'react';

/**
 * Makes the whole page (header, focus rings, buttons) use `accent` while the calling page is mounted. The
 * colours go on the document root as custom properties, which index.css animates. Two effects on purpose:
 * changing the colour must not clear it in between, or every change would transition from the default
 * blue instead of from the previous paint.
 */
export function usePageAccent(accent: string, ink: string): void {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-ink', ink);
  }, [accent, ink]);

  useEffect(
    () => () => {
      const root = document.documentElement;
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-ink');
    },
    [],
  );
}
