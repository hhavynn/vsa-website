/** Keep the Figma-inspired public palette out of sign-in and admin workflows. */
export function isPublicEditorialRoute(pathname: string): boolean {
  return pathname !== '/signin' && pathname !== '/admin' && !pathname.startsWith('/admin/');
}
