/**
 * PageTitle owns the document's title, description, canonical URL and share
 * tags (#573). These checks cover the browser side of the manifest: a public
 * route gets its manifest metadata, a route the manifest does not own gets no
 * canonical URL, and the explicitly non-indexable paths are marked noindex.
 */
/* eslint-disable testing-library/no-node-access -- head tags are not rendered content; they are asserted through document.head */
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PageTitle } from './PageTitle';
import { RouteSeoProvider } from '../../lib/seo/RouteSeoContext';

function renderAt(pathname: string, title?: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <RouteSeoProvider>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <PageTitle title={title} />
                <div>page</div>
              </>
            }
          />
        </Routes>
      </RouteSeoProvider>
    </MemoryRouter>
  );
}

const metaContent = (selector: string) =>
  document.head.querySelector(selector)?.getAttribute('content') ?? null;

const canonicalHref = () =>
  document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
});

describe('PageTitle', () => {
  it('gives a public route its manifest title, description, canonical URL and share tags', () => {
    renderAt('/events');

    expect(document.title).toBe('Events | VSA at UCSD');
    expect(metaContent('meta[name="description"]')).toBe(
      'Upcoming VSA events at UC San Diego: general body meetings, socials, cultural shows, fundraisers, retreats, and the events members make together.'
    );
    expect(canonicalHref()).toBe('https://www.vsaatucsd.com/events');
    expect(metaContent('meta[property="og:title"]')).toBe('Events | VSA at UCSD');
    expect(metaContent('meta[property="og:url"]')).toBe('https://www.vsaatucsd.com/events');
    expect(metaContent('meta[name="twitter:title"]')).toBe('Events | VSA at UCSD');
    expect(metaContent('meta[name="twitter:card"]')).toBe('summary');
  });

  it('gives every manifest route a title of its own', () => {
    renderAt('/gallery');
    expect(document.title).toBe('Gallery | VSA at UCSD');
    expect(canonicalHref()).toBe('https://www.vsaatucsd.com/gallery');

    cleanup();
    document.head.innerHTML = '';

    renderAt('/vcn');
    expect(document.title).toBe('Vietnamese Culture Night | VSA at UCSD');
    expect(canonicalHref()).toBe('https://www.vsaatucsd.com/vcn');
  });

  it('lets a page override the title when its own title is dynamic', () => {
    renderAt('/house', 'House Program 2026-2027');

    expect(document.title).toBe('House Program 2026-2027 | VSA at UCSD');
    expect(canonicalHref()).toBe('https://www.vsaatucsd.com/house');
  });

  it('leaves a route the manifest does not own without a canonical URL', () => {
    renderAt('/house/twilight-sparkle', 'Twilight Sparkle House');

    expect(document.title).toBe('Twilight Sparkle House | VSA at UCSD');
    expect(canonicalHref()).toBeNull();
    expect(metaContent('meta[name="robots"]')).toBeNull();
  });

  it('marks private and non-indexable routes noindex', () => {
    renderAt('/admin/members', 'Admin Members');
    expect(metaContent('meta[name="robots"]')).toBe('noindex, nofollow');
    expect(canonicalHref()).toBeNull();

    cleanup();
    document.head.innerHTML = '';

    renderAt('/points', 'Points Lookup');
    expect(metaContent('meta[name="robots"]')).toBe('noindex, nofollow');

    cleanup();
    document.head.innerHTML = '';

    renderAt('/feedback', 'Feedback');
    expect(metaContent('meta[name="robots"]')).toBe('noindex, nofollow');
  });

  it('drops the canonical URL when moving from a public route to a private one', () => {
    renderAt('/events');
    expect(canonicalHref()).toBe('https://www.vsaatucsd.com/events');

    cleanup();
    document.head.innerHTML = '';

    renderAt('/admin', 'Admin Dashboard');
    expect(canonicalHref()).toBeNull();
  });

  it('still sets a title when mounted without a router (admin pages mounted in isolation)', () => {
    render(
      <>
        <PageTitle title="Admin Dashboard" />
        <div>page</div>
      </>
    );

    expect(document.title).toBe('Admin Dashboard | VSA at UCSD');
  });
});
