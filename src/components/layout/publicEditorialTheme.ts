import { useLocation } from 'react-router-dom';

/** Keep the Figma-inspired public palette out of sign-in and admin workflows. */
export function isPublicEditorialRoute(pathname: string): boolean {
  // React Router matches case-insensitively, so /ADMIN still renders admin.
  const path = pathname.toLowerCase();
  return path !== '/signin' && path !== '/admin' && !path.startsWith('/admin/');
}

/** Shell chrome (nav, footer) switches to the editorial treatment on public routes. */
export function usePublicEditorialRoute(): boolean {
  return isPublicEditorialRoute(useLocation().pathname);
}

/** Desktop nav link styles shared by NavLinks and the Explore trigger. */
export function navLinkClass(editorial: boolean, active: boolean): string {
  if (editorial) {
    return `flex items-center gap-1 border-b px-0.5 py-[19px] font-sans text-[12.5px] font-semibold tracking-[0.06em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ed-ink ${
      active ? 'border-ed-ink text-ed-ink' : 'border-transparent text-ed-muted hover:border-ed-ink hover:text-ed-ink'
    }`;
  }
  return `flex items-center gap-1 rounded-lg border px-3 py-1.5 font-sans text-[13px] font-semibold transition-colors duration-150 ${
    active
      ? 'text-[var(--brand)] bg-[var(--surface2)] border-[var(--border2)]'
      : 'text-[var(--text2)] border-transparent hover:text-[var(--text)] hover:bg-[var(--surface2)] hover:border-[var(--border)]'
  }`;
}
