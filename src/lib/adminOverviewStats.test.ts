import { DEFAULT_OVERVIEW_STATS, OverviewSources, buildOverviewSnapshot } from './adminOverviewStats';

const NOW = new Date('2026-10-02T12:00:00Z');
const STORAGE = 'https://sxephkrekdztmkptyzca.supabase.co/storage/v1/object/public/event-images/a.jpg';

function sources(overrides: Partial<OverviewSources> = {}): OverviewSources {
  return {
    members: 820,
    academicTermCount: 12,
    photoRequestsPending: 3,
    dataRightsOpen: 1,
    aiFeedbackUnresolved: 4,
    events: [
      // upcoming, published, complete
      { date: '2026-10-10T01:00:00+00:00', is_published: true, image_url: '/images/events/a.jpg', location: 'PC East', check_in_form_url: 'https://forms.gle/a', academic_term_id: 't1' },
      // upcoming, published, empty-string location + no image + no term, legacy storage image elsewhere
      { date: '2026-10-12T01:00:00Z', is_published: true, image_url: null, location: '', check_in_form_url: 'https://forms.gle/b', academic_term_id: null },
      // upcoming draft with an empty check-in URL and a Storage image
      { date: '2026-11-01T01:00:00Z', is_published: false, image_url: STORAGE, location: null, check_in_form_url: '', academic_term_id: 't1' },
      // past (more than a day ago)
      { date: '2026-09-20T01:00:00Z', is_published: true, image_url: '/images/events/old.jpg', location: 'Zoom', check_in_form_url: null, academic_term_id: 't1' },
      // yesterday evening: still inside the one-day grace window
      { date: '2026-10-01T20:00:00Z', is_published: true, image_url: '/images/events/y.jpg', location: 'Hub', check_in_form_url: 'https://forms.gle/y', academic_term_id: 't1' },
    ],
    gallery: [
      { cover_image_url: '/images/gallery/a.jpg', google_photos_url: 'https://photos.app.goo.gl/a' },
      { cover_image_url: null, google_photos_url: '' },
      { cover_image_url: STORAGE, google_photos_url: null },
    ],
    cabinetMembers: [
      { cabinet_year_id: 'cy2', image_url: '/a.jpg', role: 'President' },
      { cabinet_year_id: 'cy2', image_url: null, role: '' },
      { cabinet_year_id: 'cy1', image_url: STORAGE, role: null },
      { cabinet_year_id: 'cy1', image_url: '/b.jpg', role: 'VP' },
    ],
    cabinetYears: [
      { id: 'cy1', label: '2025-26', is_active: false },
      { id: 'cy2', label: '2026-27', is_active: true },
    ],
    houseAssets: [
      { academic_year_start: 2026, image_url: '/h1.jpg', house_parent_heading: 'Parents', house_parent_image_url: '/p.jpg' },
      { academic_year_start: 2026, image_url: null, house_parent_heading: null, house_parent_image_url: '/p.jpg' },
      { academic_year_start: 2025, image_url: STORAGE, house_parent_heading: 'x', house_parent_image_url: null },
    ],
    houseEventImages: [{ image_url: STORAGE }, { image_url: '/local.jpg' }],
    siteSettings: [{ logo_url: STORAGE }],
    vcn: [
      { is_current: true, is_published: true, cover_image_url: '/v.jpg' },
      { is_current: false, is_published: true, cover_image_url: null },
    ],
    programContent: [
      { is_published: true, status: 'live' },
      { is_published: false, status: 'live' },
      { is_published: true, status: 'hidden' },
    ],
    feedback: [{ status: 'pending' }, { status: 'in_progress' }, { status: 'resolved' }, { status: 'resolved' }, { status: null }],
    activeTerm: { loaded: true, academicYearStart: 2026 },
    ai: [
      { is_public: true, is_active: true, last_verified_at: '2026-09-01T00:00:00Z' },
      { is_public: true, is_active: true, last_verified_at: '2026-09-15T00:00:00Z' },
      { is_public: true, is_active: false, last_verified_at: null },
      { is_public: false, is_active: true, last_verified_at: '2026-10-01T00:00:00Z' },
    ],
    applications: [
      { application_key: 'ace_application', open_at: '2026-09-01T00:00:00Z', due_at: '2026-11-01T00:00:00Z', is_enabled: true, target_url: 'https://forms.gle/x' },
      { application_key: 'house_winter', open_at: '2026-12-01T00:00:00Z', due_at: '2027-01-01T00:00:00Z', is_enabled: true, target_url: 'https://forms.gle/x' },
      { application_key: 'house_fall', open_at: '2026-08-01T00:00:00Z', due_at: '2026-09-01T00:00:00Z', is_enabled: true, target_url: 'https://forms.gle/x' },
      { application_key: 'intern_application', open_at: '2026-09-01T00:00:00Z', due_at: '2026-11-01T00:00:00Z', is_enabled: false, target_url: 'https://forms.gle/x' },
    ],
    ...overrides,
  };
}

describe('buildOverviewSnapshot', () => {
  it('derives every dashboard number from the row reads', () => {
    const { stats, unavailable } = buildOverviewSnapshot(sources(), NOW, 2026);

    expect(unavailable).toEqual([]);
    expect(stats).toMatchObject({
      members: 820,
      events: 5,
      upcomingEvents: 4, // 10/10, 10/12, 11/01 and yesterday evening (grace window); not 9/20
      eventsPublished: 4,
      eventsDraft: 1,
      eventsUpcomingPublished: 3,
      eventsMissingTerms: 1,
      eventsMissingImage: 1,
      eventsMissingLocation: 2, // '' and NULL both count
      // Overview's long-standing predicate: empty-string location/check-in URL, or no image (NULL location alone does not count).
      upcomingEventsMissingInfo: 2,
      galleryAlbums: 3,
      galleryCount: 3,
      galleryAlbumsMissingCover: 1,
      galleryMissingCover: 1,
      galleryMissingPhotosUrl: 2,
      cabinetMembers: 4,
      cabinetYears: 2,
      cabinetActiveYear: { id: 'cy2', label: '2026-27' },
      cabinetMembersActiveYear: 2,
      cabinetMissingImage: 1,
      cabinetMissingRole: 2,
      academicTerms: 12,
      feedback: 5,
      pendingFeedback: 2,
      housesCurrentYearStart: 2026,
      housesCurrentCount: 2,
      housesMissingImage: 1,
      housesMissingParents: 2,
      vcnCurrentPublishedExists: true,
      vcnArchiveCount: 2,
      vcnMissingMedia: 1,
      programContentMissing: 2,
      aiTableExists: true,
      aiSnippetsActive: 2,
      aiSnippetsInactive: 1,
      aiLastVerifiedAt: '2026-09-15T00:00:00Z',
      // events(1) + house events(1) + houses(1) + gallery(1) + cabinet(1) + site settings(1)
      storageUrlsCount: 6,
      applicationsTotal: 4,
      applicationsOpen: 1,
      applicationsUpcoming: 1,
      applicationsClosed: 1,
    });
  });

  it('matches the case-insensitive Storage URL probe the page used to run', () => {
    const { stats } = buildOverviewSnapshot(
      sources({ siteSettings: [{ logo_url: 'https://X.SUPABASE.CO/Storage/v1/object/public/a.png' }], houseEventImages: [], events: [], gallery: [], cabinetMembers: [], houseAssets: [] }),
      NOW,
      2026,
    );
    expect(stats.storageUrlsCount).toBe(1);
  });

  it('reports a source that failed to load instead of counting it as zero', () => {
    const { stats, unavailable } = buildOverviewSnapshot(sources({ events: null, members: null, cabinetMembers: null }), NOW, 2026);

    expect(unavailable).toEqual(expect.arrayContaining(['events', 'members', 'cabinet']));
    expect(stats.events).toBe(0);
    // The Storage count skips the failed sources but still counts the rest.
    expect(stats.storageUrlsCount).toBe(4);
  });

  it('does not fall back to the browser year when the active term lookup failed', () => {
    const { stats } = buildOverviewSnapshot(sources({ activeTerm: { loaded: false, academicYearStart: null } }), NOW, 2026);
    expect(stats.activeTermUnavailable).toBe(true);
    expect(stats.housesCurrentYearStart).toBeNull();
    expect(stats.housesCurrentCount).toBe(0);
  });

  it('uses the browser year only when the lookup succeeded but no term is active', () => {
    const { stats } = buildOverviewSnapshot(sources({ activeTerm: { loaded: true, academicYearStart: null } }), NOW, 2025);
    expect(stats.activeTermUnavailable).toBe(false);
    expect(stats.housesCurrentYearStart).toBe(2025);
    expect(stats.housesCurrentCount).toBe(1);
  });

  it('treats a missing AI or applications table as a state, not a failure', () => {
    const { stats, unavailable } = buildOverviewSnapshot(sources({ ai: null, applications: null }), NOW, 2026);
    expect(stats.aiTableExists).toBe(false);
    expect(stats.applicationsTotal).toBe(0);
    expect(unavailable).toEqual([]);
  });

  it('has no active Cabinet year when none is flagged', () => {
    const { stats } = buildOverviewSnapshot(sources({ cabinetYears: [{ id: 'cy1', label: '2025-26', is_active: false }] }), NOW, 2026);
    expect(stats.cabinetActiveYear).toBeNull();
    expect(stats.cabinetMembersActiveYear).toBe(0);
  });

  it('starts from the documented defaults', () => {
    expect(DEFAULT_OVERVIEW_STATS.members).toBe(0);
    expect(DEFAULT_OVERVIEW_STATS.cabinetActiveYear).toBeNull();
  });

  describe('attention signals', () => {
    it('reuses the rows already read and the three head counts, with counts only', () => {
      const { attention } = buildOverviewSnapshot(sources(), NOW, 2026);

      expect(attention).toEqual({
        applications: sources().applications,
        draftEventDates: ['2026-11-01T01:00:00Z'],
        photoRequestsPending: 3,
        dataRightsOpen: 1,
        aiFeedbackUnresolved: 4,
        feedbackPending: 1,
      });
    });

    it('reports a failed head count as unavailable instead of zero', () => {
      const { attention, unavailable } = buildOverviewSnapshot(
        sources({ photoRequestsPending: null, dataRightsOpen: null, aiFeedbackUnresolved: null, events: null, feedback: null }),
        NOW,
        2026,
      );

      expect(unavailable).toEqual(expect.arrayContaining(['photo requests', 'data rights requests', 'Ask VSA feedback']));
      expect(attention).toMatchObject({ photoRequestsPending: null, dataRightsOpen: null, aiFeedbackUnresolved: null, draftEventDates: null, feedbackPending: null });
    });
  });
});
