import { createContext, useContext } from 'react';

/**
 * Lets any admin page open the shell's Quick Search without owning a second
 * copy of it. Outside the admin shell (tests, previews) it is a no-op.
 */
export const AdminSearchContext = createContext<{ openSearch: () => void }>({ openSearch: () => undefined });

export function useAdminSearchOpener() {
  return useContext(AdminSearchContext).openSearch;
}
