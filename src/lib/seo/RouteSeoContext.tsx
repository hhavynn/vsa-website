import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { findPublicRouteSeo, type PublicRouteSeo } from '../../routes/publicRouteSeo';

export interface RouteSeoContextValue {
  /** The manifest entry for the current path, or null when the manifest does not own it. */
  route: PublicRouteSeo | null;
  /** The current path, used for the canonical URL and the noindex decision. */
  pathname: string;
}

const DEFAULT_CONTEXT: RouteSeoContextValue = { route: null, pathname: '' };

const RouteSeoContext = createContext<RouteSeoContextValue>(DEFAULT_CONTEXT);

/**
 * Makes the current route's manifest entry available to `PageTitle`.
 *
 * `PageTitle` is rendered by every page, including admin pages that some tests
 * mount without a router. Reading the route from context (instead of calling
 * `useLocation()` inside `PageTitle`) keeps the component usable outside a
 * router: without a provider it simply falls back to the title it is given.
 */
export function RouteSeoProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const value = useMemo<RouteSeoContextValue>(
    () => ({ route: findPublicRouteSeo(pathname), pathname }),
    [pathname]
  );

  return <RouteSeoContext.Provider value={value}>{children}</RouteSeoContext.Provider>;
}

export function useRouteSeo(): RouteSeoContextValue {
  return useContext(RouteSeoContext);
}
