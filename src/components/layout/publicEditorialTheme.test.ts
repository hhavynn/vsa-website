import { isPublicEditorialRoute } from './publicEditorialTheme';

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
