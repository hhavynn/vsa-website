import { isPublicEditorialRoute, navLinkClass } from './publicEditorialTheme';

describe('public editorial theme routing', () => {
  it.each(['/', '/events', '/gallery', '/cabinet', '/get-involved', '/house', '/vcn', '/points', '/privacy'])('themes public route %s', (pathname) => {
    expect(isPublicEditorialRoute(pathname)).toBe(true);
  });

  it.each(['/admin', '/admin/', '/admin/login', '/admin/events', '/signin'])('preserves the existing non-public theme on %s', (pathname) => {
    expect(isPublicEditorialRoute(pathname)).toBe(false);
  });

  it('does not exclude unrelated paths that merely begin with admin', () => {
    expect(isPublicEditorialRoute('/administration-info')).toBe(true);
  });
});

describe('editorial nav link styling', () => {
  it('uses the Figma underline treatment on public routes and the pill elsewhere', () => {
    expect(navLinkClass(true, true)).toContain('border-ed-ink');
    expect(navLinkClass(true, false)).toContain('border-transparent');
    expect(navLinkClass(false, true)).toContain('rounded-lg');
    expect(navLinkClass(false, true)).not.toContain('ed-ink');
  });
});
