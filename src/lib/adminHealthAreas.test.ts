import { buildHealthAreas, buildHealthWarnings, summarizeHealth } from './adminHealthAreas';
import { DEFAULT_OVERVIEW_STATS, OverviewStats } from './adminOverviewStats';

const HEALTHY: OverviewStats = {
  ...DEFAULT_OVERVIEW_STATS,
  eventsDraft: 0,
  eventsUpcomingPublished: 3,
  housesCurrentCount: 4,
  housesCurrentYearStart: 2026,
  cabinetActiveYear: { id: 'y', label: '2026–27' },
  cabinetMembersActiveYear: 19,
  vcnCurrentPublishedExists: true,
  aiTableExists: true,
  aiLastVerifiedAt: '2026-10-01T00:00:00Z',
};
const NOW = new Date('2026-10-10T12:00:00Z');

describe('buildHealthAreas', () => {
  it('covers every area the dashboard has always reported', () => {
    expect(buildHealthAreas(HEALTHY, NOW).map((area) => area.title)).toEqual([
      'Events', 'Houses', 'Gallery', 'Cabinet', 'VCN', 'Program Content', 'Ask VSA AI', 'Applications', 'Storage / Egress',
    ]);
  });

  it('is good when nothing needs a look', () => {
    expect(buildHealthAreas(HEALTHY, NOW).every((area) => area.status === 'good')).toBe(true);
  });

  it('flags a warning with a count and an error for a missing Cabinet year', () => {
    const areas = buildHealthAreas({ ...HEALTHY, eventsMissingImage: 2, cabinetActiveYear: null }, NOW);
    expect(areas.find((a) => a.key === 'events')).toMatchObject({ status: 'warning', issues: 1 });
    expect(areas.find((a) => a.key === 'cabinet')).toMatchObject({ status: 'error' });
  });

  it('treats an unreadable active term as a warning, not zero Houses', () => {
    const houses = buildHealthAreas({ ...HEALTHY, activeTermUnavailable: true }, NOW).find((a) => a.key === 'houses');
    expect(houses?.lines[0]).toMatchObject({ value: '—', status: 'warning' });
  });

  it('points Ask VSA at Resources when its table is missing', () => {
    const ai = buildHealthAreas({ ...HEALTHY, aiTableExists: false }, NOW).find((a) => a.key === 'ask-vsa');
    expect(ai?.to).toBe('/admin/resources');
    expect(ai?.status).toBe('warning');
  });
});

describe('buildHealthWarnings', () => {
  it('lists only non-zero data-health warnings, linking each to its fixing page', () => {
    expect(buildHealthWarnings({ ...HEALTHY, eventsMissingTerms: 2, galleryAlbumsMissingCover: 1 })).toEqual([
      { id: 'events-missing-terms', count: 2, label: 'events missing terms', to: '/admin/events', critical: true },
      { id: 'albums-missing-covers', count: 1, label: 'albums missing covers', to: '/admin/gallery', critical: false },
    ]);
    expect(buildHealthWarnings(HEALTHY)).toEqual([]);
  });
});

describe('summarizeHealth', () => {
  const base = { loading: false, failed: false, unavailable: [] as string[], stats: HEALTHY, preflight: 0 as number | 'loading' | 'failed' };

  it('is clear only when everything loaded and nothing needs review', () => {
    expect(summarizeHealth(base)).toEqual({ state: 'clear' });
  });

  it('is never clear when the scan failed', () => {
    expect(summarizeHealth({ ...base, failed: true, stats: null })).toEqual({ state: 'failed' });
    expect(summarizeHealth({ ...base, failed: true })).toEqual({ state: 'failed' });
  });

  it('is loading, not clear, while loading or while operations load', () => {
    expect(summarizeHealth({ ...base, loading: true, stats: null })).toEqual({ state: 'loading' });
    expect(summarizeHealth({ ...base, preflight: 'loading' })).toEqual({ state: 'loading' });
  });

  it('is partial when counts or operations could not load', () => {
    expect(summarizeHealth({ ...base, unavailable: ['events'] })).toEqual({ state: 'partial', unavailable: ['events'], issues: 0 });
    expect(summarizeHealth({ ...base, preflight: 'failed' })).toEqual({ state: 'partial', unavailable: ['operations status'], issues: 0 });
  });

  it('stays partial, with the count, when something that did load also needs review', () => {
    const stats = { ...HEALTHY, eventsMissingTerms: 1 };
    expect(summarizeHealth({ ...base, stats, unavailable: ['cabinet'] })).toEqual({ state: 'partial', unavailable: ['cabinet'], issues: 1 });
  });

  it('counts issues from warnings, areas and the operations preflight', () => {
    const stats = { ...HEALTHY, eventsMissingTerms: 1, eventsMissingImage: 1 };
    expect(summarizeHealth({ ...base, stats, preflight: 2 })).toEqual({ state: 'issues', issues: 4 });
  });
});
