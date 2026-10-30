import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Public routes get the editorial page treatment (cream paper, page heroes,
 * scrapbook accents). Sign-in and admin keep the operational expression of
 * the same palette from :root, so dense workflows stay calm.
 */
export function isPublicEditorialRoute(pathname: string): boolean {
  // React Router matches case-insensitively, so /ADMIN still renders admin.
  const path = pathname.toLowerCase();
  return path !== '/signin' && path !== '/admin' && !path.startsWith('/admin/');
}

/** Shell chrome (nav, footer) switches to the editorial treatment on public routes. */
export function usePublicEditorialRoute(): boolean {
  return isPublicEditorialRoute(useLocation().pathname);
}

export const EDITORIAL_SHELL_CLASS = 'vsa-editorial-shell';

/**
 * The mobile menu, search dialog and bottom sheets portal to document.body,
 * outside Layout's wrapper, so the editorial tokens must also be in scope on
 * body or those overlays would keep the old teal palette over the new page.
 * Removed on admin/sign-in routes and on unmount.
 */
export function useEditorialBodyScope(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    document.body.classList.add(EDITORIAL_SHELL_CLASS);
    return () => document.body.classList.remove(EDITORIAL_SHELL_CLASS);
  }, [enabled]);
}

/**
 * Desktop nav link styles shared by NavLinks and the Explore trigger. The nav
 * chrome wears the editorial treatment on every route, admin included; only
 * page-level decoration is scoped by isPublicEditorialRoute.
 */
export function navLinkClass(active: boolean): string {
  return `flex items-center gap-1 border-b px-0.5 py-[19px] font-sans text-[12.5px] font-semibold tracking-[0.06em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ed-ink ${
    active ? 'border-ed-ink text-ed-ink' : 'border-transparent text-ed-muted hover:border-ed-ink hover:text-ed-ink'
  }`;
}
