import { useEffect } from 'react';

/** Gives each page its own browser tab title, which screen readers announce on navigation. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} | Cove`;
  }, [title]);
}
