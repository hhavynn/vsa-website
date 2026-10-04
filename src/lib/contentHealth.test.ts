import {
  ACKNOWLEDGEMENT_DAYS,
  AcknowledgementStateRow,
  CheckRunStateRow,
  ContentHealthSources,
  HealthEventRow,
  LinkCheckStateRow,
  buildAcknowledgement,
  buildContentHealthReport,
  contentHealthHeadline,
  displayUrl,
  stalePriorYearSpan,
} from './contentHealth';

const NOW = new Date('2026-10-04T18:00:00Z');

const healthyEvent: HealthEventRow = {
  id: 'e-ok',
  name: 'Fall GBM',
  date: '2026-10-20T02:00:00Z',
  is_published: true,
  image_url: '/images/events/gbm.webp',
  location: 'PC East Ballroom',
  updated_at: '2026-09-01T00:00:00Z',
};

function sources(overrides: Partial<ContentHealthSources> = {}): ContentHealthSources {
  return {
    now: NOW,
    currentAcademicYearStart: 2026,
    events: [healthyEvent],
    gallery: [],
    programContent: [],
    ai: [],
    applications: [],
    state: [],
    ...overrides,
  };
}

const linkRow = (overrides: Partial<LinkCheckStateRow> = {}): LinkCheckStateRow => ({
  kind: 'link_check',
  subject_key: 'https://cdn.example.org/flyer.png?token=secret',
  check_status: 'failed',
  http_status: 404,
  failure_reason: 'http_404',
  checked_at: '2026-10-03T08:00:00Z',
  failing_since: '2026-10-03T08:00:00Z',
  consecutive_failures: 1,
  detail: [{ table: 'events', id: 'e1', field: 'image_url', label: 'Fall GBM', path: '/admin/events', kind: 'image' }],
  ...overrides,
});

describe('healthy content', () => {
  it('produces no findings at all', () => {
    const report = buildContentHealthReport(
      sources({
        gallery: [{ id: 'g1', name: 'Album', google_photos_url: 'https://photos.app.goo.gl/x', created_at: '2026-01-01T00:00:00Z' }],
        programContent: [{ id: 'p1', title: 'Get involved', body: 'Join us for 2026-2027.', status: 'open', is_published: true, primary_link_label: 'Apply', primary_link_url: 'https://forms.gle/x' }],
        ai: [{ id: 'k1', title: 'Evergreen', is_public: true, is_active: true, freshness: 'stable', last_verified_at: '2023-01-01T00:00:00Z' }],
      }),
    );
    expect(report.findings).toEqual([]);
    expect(report.counts).toEqual({ total: 0, high: 0, medium: 0, low: 0 });
    expect(report.unchecked).toEqual([]);
  });
});

describe('events', () => {
  it('flags a draft event whose date has passed, with a link to the drafts filter', () => {
    const report = buildContentHealthReport(
      sources({ events: [{ id: 'd1', name: 'Mixer', date: '2026-09-12T02:00:00Z', is_published: false, updated_at: '2026-08-01T00:00:00Z' }] }),
    );
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      key: 'draft-event-past:d1',
      check: 'draft-event-past',
      area: 'events',
      title: 'Mixer',
      fixPath: '/admin/events?filter=draft',
      checkedAt: NOW.toISOString(),
    });
    expect(report.findings[0].reason).toMatch(/Still a draft.*Sep 11, 2026/);
  });

  it('leaves alone a draft in the future, a draft from long ago, and a published past event', () => {
    const report = buildContentHealthReport(
      sources({
        events: [
          { id: 'future', name: 'Soon', date: '2026-10-20T02:00:00Z', is_published: false },
          { id: 'ancient', name: 'Old plan', date: '2025-11-01T02:00:00Z', is_published: false },
          { id: 'past', name: 'Done', date: '2026-09-01T02:00:00Z', is_published: true },
        ],
      }),
    );
    expect(report.findings).toEqual([]);
  });

  it('flags a published upcoming event that is missing public fields, and names them', () => {
    const report = buildContentHealthReport(
      sources({ events: [{ ...healthyEvent, id: 'e2', name: 'Mixer', location: '  ', image_url: null }] }),
    );
    expect(report.findings[0]).toMatchObject({ check: 'event-missing-fields', severity: 'medium' });
    expect(report.findings[0].reason).toBe('Public upcoming event has no location and cover image.');
  });

  it('does not flag fields on a past event or a draft', () => {
    const report = buildContentHealthReport(
      sources({ events: [{ id: 'p', name: 'Past', date: '2026-09-01T02:00:00Z', is_published: true, location: null }] }),
    );
    expect(report.findings).toEqual([]);
  });
});

describe('gallery and program content', () => {
  it('flags an empty album but not a brand-new one', () => {
    const report = buildContentHealthReport(
      sources({
        gallery: [
          { id: 'g1', name: 'Empty', google_photos_url: '', created_at: '2026-09-01T00:00:00Z' },
          { id: 'g2', name: 'New', google_photos_url: null, created_at: '2026-10-04T00:00:00Z' },
          { id: 'g3', name: 'Linked', google_photos_url: 'https://photos.app.goo.gl/x', created_at: '2026-09-01T00:00:00Z' },
        ],
      }),
    );
    expect(report.findings.map((f) => [f.key, f.fixPath])).toEqual([['gallery-empty:g1', '/admin/gallery']]);
  });

  it('flags incomplete or placeholder published content, never hidden or unpublished rows', () => {
    const report = buildContentHealthReport(
      sources({
        programContent: [
          { id: 'a', title: null, body: '', status: 'open', is_published: true },
          { id: 'b', title: 'Intern program', body: 'Lorem ipsum dolor sit amet', status: 'open', is_published: true },
          { id: 'c', title: 'Apply', body: 'Real text', status: 'open', is_published: true, primary_link_label: 'Apply now', primary_link_url: '' },
          { id: 'd', title: 'Hidden', body: 'TODO', status: 'hidden', is_published: true },
          { id: 'e', title: 'Draft', body: 'TODO', status: 'open', is_published: false },
          { id: 'f', title: 'Dates', body: 'Date TBD, coming soon', status: 'open', is_published: true },
        ],
      }),
    );
    expect(report.findings.map((f) => f.key).sort()).toEqual(['program-incomplete:a:empty', 'program-incomplete:b:placeholder', 'program-incomplete:c:button']);
  });

  it('flags text that only mentions a prior school year, but not history alongside the current year or plain dates', () => {
    const report = buildContentHealthReport(
      sources({
        programContent: [
          { id: 'old', title: 'Applications', body: 'Applications for 2025-2026 are open!', status: 'open', is_published: true },
          { id: 'both', title: 'History', body: 'Since 2024-2025 and now in 2026-2027.', status: 'open', is_published: true },
          { id: 'date', title: 'Deadline', body: 'Due 2025-10-04.', status: 'open', is_published: true },
        ],
      }),
    );
    expect(report.findings.map((f) => f.key)).toEqual(['program-stale-year:old']);
    expect(report.findings[0].reason).toBe('Mentions 2025-2026, but the current year is 2026-2027.');
    expect(report.findings[0].severity).toBe('low');
    expect(stalePriorYearSpan('2025-10', 2026)).toBeNull();
  });
});

describe('Ask VSA knowledge (#239)', () => {
  it('surfaces stale rows as findings that link to the review filter, and keeps evergreen rows out', () => {
    const report = buildContentHealthReport(
      sources({
        ai: [
          { id: 'k1', title: 'Time-bound', is_public: true, is_active: true, valid_until: '2026-10-01T00:00:00Z', last_verified_at: '2026-09-01T00:00:00Z' },
          { id: 'k2', title: 'Evergreen', is_public: true, is_active: true, freshness: 'stable', last_verified_at: '2022-01-01T00:00:00Z' },
          { id: 'k3', title: 'Last year', is_public: true, is_active: true, freshness: 'yearly', academic_year: '2025-2026', last_verified_at: '2026-05-01T00:00:00Z' },
        ],
      }),
    );
    expect(report.findings.map((f) => [f.title, f.severity])).toEqual([
      ['Last year', 'high'],
      ['Time-bound', 'medium'],
    ]);
    expect(report.findings[0].fixPath).toBe('/admin/ai-knowledge?filter=review');
    expect(report.findings.every((f) => !f.acknowledgeable)).toBe(true);
    expect(report.knowledge.get('k2')?.status).toBe('current');
  });

  it('checks a linked event against the same event rows, so an unpublished link is caught', () => {
    const report = buildContentHealthReport(
      sources({
        events: [{ id: 'draft-1', name: 'Secret', date: '2026-12-01T02:00:00Z', is_published: false, updated_at: '2026-09-01T00:00:00Z' }],
        ai: [{ id: 'k1', title: 'About the secret event', is_public: true, is_active: true, linked_entity_type: 'event', linked_entity_key: 'draft-1', last_verified_at: '2026-09-02T00:00:00Z' }],
      }),
    );
    const finding = report.findings.find((f) => f.check === 'ask-vsa-stale');
    expect(finding?.severity).toBe('high');
    expect(finding?.reason).toMatch(/not published/);
  });
});

describe('link failures from the weekly check', () => {
  it('reports a certain failure, naming the content and fixing page, without echoing the query string', () => {
    const report = buildContentHealthReport(sources({ state: [linkRow()] }));
    const finding = report.findings[0];
    expect(finding).toMatchObject({
      check: 'link-failed',
      severity: 'high',
      contentType: 'Event image',
      title: 'Fall GBM',
      fixPath: '/admin/events',
      checkedAt: '2026-10-03T08:00:00Z',
      detail: 'https://cdn.example.org/flyer.png',
    });
    expect(finding.reason).toBe('The image returns 404 (not found).');
    // What an admin reads never carries the token. (The identity key keeps the full URL; it is stored admin-only and never rendered.)
    expect([finding.title, finding.reason, finding.detail].join(' ')).not.toContain('secret');
  });

  it('waits for a second run before reporting an uncertain failure, and never reports ok or skipped results', () => {
    const report = buildContentHealthReport(
      sources({
        state: [
          linkRow({ subject_key: 'https://a.test/1', failure_reason: 'timeout', http_status: null, consecutive_failures: 1 }),
          linkRow({ subject_key: 'https://a.test/2', failure_reason: 'timeout', http_status: null, consecutive_failures: 2 }),
          linkRow({ subject_key: 'https://a.test/3', check_status: 'ok', failure_reason: null }),
          linkRow({ subject_key: 'https://a.test/4', check_status: 'skipped', failure_reason: 'blocked' }),
        ],
      }),
    );
    expect(report.findings.map((f) => f.detail)).toEqual(['https://a.test/2']);
  });

  it('treats dead links as medium and groups several uses of one URL', () => {
    const detail = [
      { table: 'program_content', id: 'p1', field: 'primary_link_url', label: 'Get involved', path: '/admin/content', kind: 'link' },
      { table: 'program_content', id: 'p2', field: 'primary_link_url', label: 'WNC', path: '/admin/content', kind: 'link' },
    ];
    const report = buildContentHealthReport(sources({ state: [linkRow({ subject_key: 'https://gone.test/form', detail })] }));
    expect(report.findings[0]).toMatchObject({ severity: 'medium', contentType: 'Program content link', title: 'Get involved and 1 more' });
  });

  it('reports when the weekly check last ran, and when it is overdue', () => {
    const run = (checkedAt: string): CheckRunStateRow => ({ kind: 'check_run', subject_key: 'weekly', checked_at: checkedAt, detail: { checked: 40, failed: 2, skipped: 5 } });
    expect(buildContentHealthReport(sources({ state: [run('2026-10-01T08:00:00Z')] })).links).toEqual({
      available: true,
      lastRunAt: '2026-10-01T08:00:00Z',
      lastRun: { checked: 40, failed: 2, skipped: 5 },
      overdue: false,
    });
    expect(buildContentHealthReport(sources({ state: [run('2026-09-01T08:00:00Z')] })).links.overdue).toBe(true);
    expect(buildContentHealthReport(sources({ state: null })).links.available).toBe(false);
  });
});

describe('acknowledging without hiding real failures forever', () => {
  const draftEvents = [{ id: 'd1', name: 'Mixer', date: '2026-09-12T02:00:00Z', is_published: false, updated_at: '2026-08-01T00:00:00Z' }];
  const ack = (overrides: Partial<AcknowledgementStateRow> = {}): AcknowledgementStateRow => ({
    kind: 'acknowledgement',
    subject_key: 'draft-event-past:d1',
    fingerprint: '2026-08-01T00:00:00Z',
    acknowledged_at: '2026-10-01T00:00:00Z',
    expires_at: '2026-11-30T00:00:00Z',
    ...overrides,
  });

  it('moves an acknowledged finding out of the count and into the accepted list', () => {
    const report = buildContentHealthReport(sources({ events: draftEvents, state: [ack()] }));
    expect(report.findings).toEqual([]);
    expect(report.counts.total).toBe(0);
    expect(report.acknowledged.map((a) => a.finding.key)).toEqual(['draft-event-past:d1']);
  });

  it('brings it back when the row changes (a different fingerprint)', () => {
    const edited = [{ ...draftEvents[0], updated_at: '2026-10-02T00:00:00Z' }];
    const report = buildContentHealthReport(sources({ events: edited, state: [ack()] }));
    expect(report.findings.map((f) => f.key)).toEqual(['draft-event-past:d1']);
    expect(report.acknowledged).toEqual([]);
  });

  it('brings it back when the acknowledgement expires', () => {
    const report = buildContentHealthReport(sources({ events: draftEvents, state: [ack({ expires_at: '2026-10-03T00:00:00Z' })] }));
    expect(report.counts.total).toBe(1);
  });

  it('does not let a recurring link failure hide behind an old acknowledgement', () => {
    const key = 'link-failed:https://cdn.example.org/flyer.png?token=secret';
    const oldEpisode = ack({ subject_key: key, fingerprint: 'https://cdn.example.org/flyer.png?token=secret|2026-09-01T00:00:00Z' });
    // The link recovered, then broke again on Oct 3: a new failing_since.
    const report = buildContentHealthReport(sources({ state: [linkRow(), oldEpisode] }));
    expect(report.counts.total).toBe(1);
    expect(report.acknowledged).toEqual([]);
  });

  it('holds while the same failure continues', () => {
    const key = 'link-failed:https://cdn.example.org/flyer.png?token=secret';
    const sameEpisode = ack({ subject_key: key, fingerprint: 'https://cdn.example.org/flyer.png?token=secret|2026-10-03T08:00:00Z' });
    const report = buildContentHealthReport(sources({ state: [linkRow(), sameEpisode] }));
    expect(report.counts.total).toBe(0);
    expect(report.acknowledged).toHaveLength(1);
  });

  it('ignores an acknowledgement for a finding that is fixed (it simply has nothing to match)', () => {
    const report = buildContentHealthReport(sources({ state: [ack()] }));
    expect(report.findings).toEqual([]);
    expect(report.acknowledged).toEqual([]);
  });

  it('builds an acknowledgement bound to the fingerprint that expires on its own', () => {
    const report = buildContentHealthReport(sources({ events: draftEvents }));
    const built = buildAcknowledgement(report.findings[0], NOW);
    expect(built).toEqual({
      subject_key: 'draft-event-past:d1',
      fingerprint: '2026-08-01T00:00:00Z',
      expires_at: new Date(NOW.getTime() + ACKNOWLEDGEMENT_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  it('cannot acknowledge Ask VSA findings: they are cleared by reviewing the row', () => {
    const report = buildContentHealthReport(
      sources({
        ai: [{ id: 'k1', title: 'Old', is_public: true, is_active: true, valid_until: '2026-10-01T00:00:00Z' }],
        state: [{ kind: 'acknowledgement', subject_key: 'ask-vsa-stale:k1', fingerprint: 'expired', acknowledged_at: null, expires_at: null }],
      }),
    );
    expect(report.counts.total).toBe(1);
  });
});

describe('degraded sources and ordering', () => {
  it('names what could not be checked instead of claiming a clean bill of health', () => {
    const report = buildContentHealthReport(sources({ events: null, gallery: null, ai: null }));
    expect(report.unchecked).toEqual(['events', 'gallery', 'Ask VSA knowledge']);
  });

  it('orders by severity, then area, and counts each severity', () => {
    const report = buildContentHealthReport(
      sources({
        events: [{ id: 'd1', name: 'Mixer', date: '2026-09-12T02:00:00Z', is_published: false }],
        programContent: [{ id: 'p', title: 'Apply', body: 'For 2025-2026', status: 'open', is_published: true }],
        state: [linkRow()],
      }),
    );
    expect(report.findings.map((f) => f.severity)).toEqual(['high', 'medium', 'low']);
    expect(report.counts).toEqual({ total: 3, high: 1, medium: 1, low: 1 });
  });

  it('writes the one-line headline the Overview shows', () => {
    expect(contentHealthHeadline({ total: 6 })).toBe('6 content health issues');
    expect(contentHealthHeadline({ total: 1 })).toBe('1 content health issue');
    expect(displayUrl('https://a.test/x.png?sig=abc#frag')).toBe('https://a.test/x.png');
  });
});
