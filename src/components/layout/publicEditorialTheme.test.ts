import { createElement } from 'react';
import { render } from '@testing-library/react';
import { EDITORIAL_SHELL_CLASS, isPublicEditorialRoute, navLinkClass, useEditorialBodyScope } from './publicEditorialTheme';

describe('public editorial theme routing', () => {
  it.each(['/', '/events', '/gallery', '/cabinet', '/get-involved', '/house', '/vcn', '/points', '/privacy'])('themes public route %s', (pathname) => {
    expect(isPublicEditorialRoute(pathname)).toBe(true);
  });

  it.each(['/admin', '/admin/', '/admin/login', '/admin/events', '/signin', '/ADMIN', '/Admin/Events', '/SignIn'])('preserves the existing non-public theme on %s', (pathname) => {
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

describe('editorial token scope for body-level portals', () => {
  const Probe = ({ enabled }: { enabled: boolean }) => {
    useEditorialBodyScope(enabled);
    return null;
  };

  it('scopes the editorial tokens to document.body on public routes and clears them afterwards', () => {
    const { rerender, unmount } = render(createElement(Probe, { enabled: true }));
    expect(document.body).toHaveClass(EDITORIAL_SHELL_CLASS);
    rerender(createElement(Probe, { enabled: false }));
    expect(document.body).not.toHaveClass(EDITORIAL_SHELL_CLASS);
    rerender(createElement(Probe, { enabled: true }));
    expect(document.body).toHaveClass(EDITORIAL_SHELL_CLASS);
    unmount();
    expect(document.body).not.toHaveClass(EDITORIAL_SHELL_CLASS);
  });

  it('never themes the body on admin or sign-in routes', () => {
    render(createElement(Probe, { enabled: isPublicEditorialRoute('/admin/events') }));
    expect(document.body).not.toHaveClass(EDITORIAL_SHELL_CLASS);
  });
});
