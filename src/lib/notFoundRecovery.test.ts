import {
  isAdminPath,
  legacyDestinationFor,
  likelyDestinations,
  normalizePathname,
  primaryRecoveryLinks,
} from './notFoundRecovery';

describe('legacyDestinationFor: known legacy URLs only', () => {
  it('maps the retired member profile to the public points lookup', () => {
    expect(legacyDestinationFor('/profile')).toMatchObject({ to: '/points', label: 'Find My Points' });
  });

  it('maps the retired points explainer to its in-page anchor', () => {
    expect(legacyDestinationFor('/points-explainer')?.to).toBe('/points#how-points-work');
  });

  it('tolerates case and trailing slashes, like the router', () => {
    expect(legacyDestinationFor('/Profile/')?.to).toBe('/points');
    expect(legacyDestinationFor('/POINTS-EXPLAINER')?.to).toBe('/points#how-points-work');
  });

  it('does not fuzzy-match: near-misses, unknown URLs and deeper paths get nothing', () => {
    for (const path of ['/profiles', '/profile/settings', '/point', '/houses', '/vcn/2019', '/vcn-archive', '/house/archive/2019-2020/x', '/anything-else']) {
      expect(legacyDestinationFor(path)).toBeNull();
    }
  });

  it('never maps retired sign-up URLs (they stay plain missing pages)', () => {
    for (const path of ['/signup', '/register', '/sign-up']) expect(legacyDestinationFor(path)).toBeNull();
  });

  it('never reveals anything for admin paths', () => {
    expect(legacyDestinationFor('/admin/profile')).toBeNull();
    expect(legacyDestinationFor('/ADMIN/members/')).toBeNull();
  });
});

describe('likelyDestinations', () => {
  const titles = (path: string) => likelyDestinations(path).map((entry) => entry.title);

  it('offers the VCN pages for an unknown VCN URL, from the same index search uses', () => {
    const found = likelyDestinations('/vcn/2019');
    expect(found.map((entry) => entry.to)).toEqual(expect.arrayContaining(['/vcn', '/vcn/archive']));
    expect(found.length).toBeLessThanOrEqual(4);
  });

  it('matches a program by a synonym in the path ("houses" -> House)', () => {
    expect(likelyDestinations('/houses').map((entry) => entry.to)).toContain('/house');
  });

  it('splits hyphenated words and ignores years and short fragments', () => {
    expect(likelyDestinations('/2019-gallery-of-us').map((entry) => entry.to)).toContain('/gallery');
    expect(titles('/2019/12')).toEqual([]);
  });

  it('returns nothing when no public page shares a word with the URL', () => {
    expect(titles('/zzzz-qqqq')).toEqual([]);
  });

  it('only ever returns public pages, never admin routes', () => {
    for (const path of ['/members', '/import', '/applications', '/login', '/anything']) {
      expect(likelyDestinations(path).filter((entry) => entry.to.startsWith('/admin'))).toEqual([]);
    }
  });

  it('returns nothing for admin paths, so a 404 cannot reveal which admin routes exist', () => {
    expect(likelyDestinations('/admin/members')).toEqual([]);
    expect(likelyDestinations('/admin/not-a-real-admin-page')).toEqual([]);
    expect(likelyDestinations('/admin')).toEqual([]);
  });
});

describe('helpers', () => {
  it('normalizes pathnames', () => {
    expect(normalizePathname('/A/B///')).toBe('/a/b');
    expect(normalizePathname('/')).toBe('/');
  });

  it('recognizes admin paths only at the segment boundary', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/Admin/x')).toBe(true);
    expect(isAdminPath('/administration')).toBe(false);
  });

  it('always offers Home, Events and Get Involved from the nav config', () => {
    expect(primaryRecoveryLinks()).toEqual([
      { to: '/', label: 'Home' },
      { to: '/events', label: 'Events' },
      { to: '/get-involved', label: 'Get Involved' },
    ]);
  });
});
