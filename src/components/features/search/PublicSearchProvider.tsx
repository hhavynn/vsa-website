import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

// Owns "is the search dialog open" for the public shell, and the global
// shortcuts that open it (Cmd/Ctrl+K, and "/" outside text fields). The dialog
// itself is lazy-loaded the first time it opens.

const PublicSearchDialog = lazy(() => import('./PublicSearchDialog'));

interface PublicSearchContextValue {
  open: () => void;
  isOpen: boolean;
}

const PublicSearchContext = createContext<PublicSearchContextValue | null>(null);

/** Null outside a provider (e.g. a component rendered on its own), so triggers can hide themselves. */
export function usePublicSearch(): PublicSearchContextValue | null {
  return useContext(PublicSearchContext);
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function PublicSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Browser back/forward while open should not leave the dialog hovering over a new page.
  useEffect(() => setIsOpen(false), [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((current) => !current);
      } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditable(event.target)) {
        event.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo(() => ({ open, isOpen }), [open, isOpen]);

  return (
    <PublicSearchContext.Provider value={value}>
      {children}
      {isOpen && (
        <Suspense fallback={null}>
          <PublicSearchDialog onClose={close} />
        </Suspense>
      )}
    </PublicSearchContext.Provider>
  );
}
