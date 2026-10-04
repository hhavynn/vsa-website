import {
  KnowledgeFreshnessContext,
  KnowledgeFreshnessRow,
  compareByUrgency,
  evaluateAllKnowledge,
  evaluateKnowledgeFreshness,
  parseKnowledgeYear,
  summarizeKnowledgeFreshness,
} from './aiKnowledgeFreshness';

const NOW = new Date('2026-10-04T18:00:00Z');

const context = (overrides: Partial<KnowledgeFreshnessContext> = {}): KnowledgeFreshnessContext => ({
  now: NOW,
  currentAcademicYearStart: 2026,
  applications: [],
  events: [],
  ...overrides,
});

const row = (overrides: Partial<KnowledgeFreshnessRow> = {}): KnowledgeFreshnessRow => ({
  id: 'k1',
  title: 'Row',
  source_type: 'manual',
  is_public: true,
  is_active: true,
  freshness: 'stable',
  academic_year: null,
  valid_until: null,
  last_verified_at: '2026-09-20T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  linked_entity_type: null,
  linked_entity_key: null,
  ...overrides,
});

describe('evergreen content', () => {
  it('is never flagged for being old', () => {
    const result = evaluateKnowledgeFreshness(row({ last_verified_at: '2023-01-01T00:00:00Z', created_at: '2022-01-01T00:00:00Z' }), context());
    expect(result.status).toBe('current');
    expect(result.issues).toEqual([]);
  });

  it('is current even if it was never verified', () => {
    expect(evaluateKnowledgeFreshness(row({ last_verified_at: null }), context()).status).toBe('current');
  });

  it('ignores inactive and private rows: they are not an answer source', () => {
    const expired = { valid_until: '2026-01-01T00:00:00Z' };
    expect(evaluateKnowledgeFreshness(row({ ...expired, is_active: false }), context()).status).toBe('current');
    expect(evaluateKnowledgeFreshness(row({ ...expired, is_public: false }), context()).status).toBe('current');
  });
});

describe('time-bound facts', () => {
  it('flags a fact whose date has passed, and says it cannot be cleared by review alone', () => {
    const result = evaluateKnowledgeFreshness(row({ valid_until: '2026-10-02T00:00:00Z' }), context());
    expect(result.status).toBe('stale');
    expect(result.issues[0].code).toBe('expired');
    expect(result.headline).toMatch(/expired Oct 1, 2026/);
    expect(result.clearedByReview).toBe(false);
  });

  it('does not flag a fact that is still valid and far from expiring', () => {
    expect(evaluateKnowledgeFreshness(row({ valid_until: '2026-12-01T00:00:00Z' }), context()).status).toBe('current');
  });

  it('asks for a look when expiry is within two weeks, until someone reviews it inside that window', () => {
    const soon = row({ valid_until: '2026-10-10T00:00:00Z', last_verified_at: '2026-09-01T00:00:00Z' });
    const flagged = evaluateKnowledgeFreshness(soon, context());
    expect(flagged.status).toBe('review_due');
    expect(flagged.issues[0].code).toBe('expiring_soon');

    const reviewed = evaluateKnowledgeFreshness({ ...soon, last_verified_at: '2026-10-03T00:00:00Z' }, context());
    expect(reviewed.status).toBe('current');
  });
});

describe('year-specific content', () => {
  const yearly = { freshness: 'yearly', academic_year: '2025-2026' };

  it('flags a prior-cycle row that has not been reviewed since the new year began', () => {
    const result = evaluateKnowledgeFreshness(row({ ...yearly, last_verified_at: '2026-06-15T00:00:00Z' }), context());
    expect(result.status).toBe('stale');
    expect(result.severity).toBe('high');
    expect(result.issues[0].code).toBe('prior_year');
    expect(result.headline).toMatch(/2025-2026.*2026-2027/);
  });

  it('is cleared once someone reviews it after the new year began', () => {
    expect(evaluateKnowledgeFreshness(row({ ...yearly, last_verified_at: '2026-09-15T00:00:00Z' }), context()).status).toBe('current');
  });

  it('leaves the current and a future year alone', () => {
    expect(evaluateKnowledgeFreshness(row({ ...yearly, academic_year: '2026-2027', last_verified_at: '2026-09-15T00:00:00Z' }), context()).status).toBe('current');
    expect(evaluateKnowledgeFreshness(row({ ...yearly, academic_year: '2027-2028' }), context()).status).toBe('current');
  });

  it('treats historical archive and stable rows as being about the past on purpose', () => {
    expect(evaluateKnowledgeFreshness(row({ ...yearly, source_type: 'historical_archive', last_verified_at: '2025-01-01T00:00:00Z' }), context()).status).toBe('current');
    expect(evaluateKnowledgeFreshness(row({ freshness: 'stable', academic_year: '2022-2023' }), context()).status).toBe('current');
  });

  it('does not let a review before September 1 clear a prior-year row when the term was switched early', () => {
    const early = { ...context(), now: new Date('2026-08-20T18:00:00Z') };
    const result = evaluateKnowledgeFreshness(row({ ...yearly, last_verified_at: '2026-08-19T00:00:00Z' }), early);
    expect(result.status).toBe('stale');
    expect(result.clearedByReview).toBe(false);
    expect(result.headline).toMatch(/Update the year label/);
  });

  it('counts a review on the evening of August 31 Pacific as before the new year, and one on Sept 1 as after', () => {
    // 2026-09-01T07:00Z is midnight Pacific.
    expect(evaluateKnowledgeFreshness(row({ ...yearly, last_verified_at: '2026-09-01T06:59:00Z' }), context()).status).toBe('stale');
    expect(evaluateKnowledgeFreshness(row({ ...yearly, last_verified_at: '2026-09-01T07:00:00Z' }), context()).status).toBe('current');
  });

  it('says so when the year label is not one it can read, instead of silently skipping the rule', () => {
    const result = evaluateKnowledgeFreshness(row({ freshness: 'yearly', academic_year: 'Fall 2025' }), context());
    expect(result.issues[0]).toMatchObject({ code: 'year_unrecognised', severity: 'low' });
    expect(result.clearedByReview).toBe(false);
    // Evergreen and archive rows may carry any label.
    expect(evaluateKnowledgeFreshness(row({ freshness: 'stable', academic_year: 'Fall 2025' }), context()).status).toBe('current');
    expect(evaluateKnowledgeFreshness(row({ freshness: 'yearly', source_type: 'historical_archive', academic_year: 'Fall 2025' }), context()).status).toBe('current');
  });

  it('skips the year rule when the current year is unknown', () => {
    expect(evaluateKnowledgeFreshness(row({ ...yearly, last_verified_at: '2026-06-15T00:00:00Z' }), context({ currentAcademicYearStart: null })).status).toBe('current');
  });
});

describe('review cadence', () => {
  it('flags quarterly content after 90 days and event-live content after 14', () => {
    expect(evaluateKnowledgeFreshness(row({ freshness: 'quarterly', last_verified_at: '2026-06-01T00:00:00Z' }), context()).issues[0].code).toBe('review_overdue');
    expect(evaluateKnowledgeFreshness(row({ freshness: 'quarterly', last_verified_at: '2026-08-15T00:00:00Z' }), context()).status).toBe('current');
    expect(evaluateKnowledgeFreshness(row({ freshness: 'event_live', last_verified_at: '2026-09-10T00:00:00Z' }), context()).status).toBe('review_due');
    expect(evaluateKnowledgeFreshness(row({ freshness: 'event_live', last_verified_at: '2026-09-28T00:00:00Z' }), context()).status).toBe('current');
  });

  it('falls back to the creation date when a changing row was never verified', () => {
    expect(evaluateKnowledgeFreshness(row({ freshness: 'quarterly', last_verified_at: null, created_at: '2026-01-01T00:00:00Z' }), context()).status).toBe('review_due');
  });

  it('is low priority and cleared by a review', () => {
    const result = evaluateKnowledgeFreshness(row({ freshness: 'quarterly', last_verified_at: '2026-06-01T00:00:00Z' }), context());
    expect(result.severity).toBe('low');
    expect(result.clearedByReview).toBe(true);
  });
});

describe('linked application windows', () => {
  const linked = { linked_entity_type: 'application', linked_entity_key: 'house_fall', last_verified_at: '2026-09-01T00:00:00Z' };
  const window = (overrides = {}) => ({ application_key: 'house_fall', due_at: '2026-11-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', ...overrides });

  it('is current when the window has not changed since the review', () => {
    expect(evaluateKnowledgeFreshness(row(linked), context({ applications: [window()] })).status).toBe('current');
  });

  it('flags a window edited after the review', () => {
    const result = evaluateKnowledgeFreshness(row(linked), context({ applications: [window({ updated_at: '2026-09-25T00:00:00Z' })] }));
    expect(result.status).toBe('stale');
    expect(result.issues[0].code).toBe('linked_changed');
  });

  it('flags a window that closed after the review, but not one reviewed after it closed', () => {
    const closed = window({ due_at: '2026-09-20T00:00:00Z' });
    expect(evaluateKnowledgeFreshness(row(linked), context({ applications: [closed] })).issues[0].code).toBe('linked_window_closed');
    expect(evaluateKnowledgeFreshness(row({ ...linked, last_verified_at: '2026-09-25T00:00:00Z' }), context({ applications: [closed] })).status).toBe('current');
  });

  it('judges a key by its newest window when several years share it', () => {
    const lastYear = window({ due_at: '2025-11-01T00:00:00Z', updated_at: '2025-08-01T00:00:00Z' });
    const thisYear = window({ due_at: '2026-11-01T00:00:00Z' });
    expect(evaluateKnowledgeFreshness(row(linked), context({ applications: [lastYear, thisYear] })).status).toBe('current');
    // Only the old window is left: it closed before the review, so that alone is not stale either.
    expect(evaluateKnowledgeFreshness(row(linked), context({ applications: [lastYear] })).status).toBe('current');
  });

  it('flags a window that was removed, and review cannot clear that', () => {
    const result = evaluateKnowledgeFreshness(row(linked), context({ applications: [] }));
    expect(result.severity).toBe('high');
    expect(result.issues[0].code).toBe('linked_missing');
    expect(result.clearedByReview).toBe(false);
  });

  it('says nothing when the windows could not be loaded, rather than guessing', () => {
    expect(evaluateKnowledgeFreshness(row(linked), context({ applications: null })).status).toBe('current');
  });
});

describe('linked events', () => {
  const linked = { linked_entity_type: 'event', linked_entity_key: 'e1', last_verified_at: '2026-09-01T00:00:00Z' };
  const event = (overrides = {}) => ({ id: 'e1', date: '2026-11-05T02:00:00Z', end_date: null, is_published: true, updated_at: '2026-08-20T00:00:00Z', ...overrides });

  it('never lets a public snippet keep describing an unpublished event', () => {
    const result = evaluateKnowledgeFreshness(row(linked), context({ events: [event({ is_published: false })] }));
    expect(result.severity).toBe('high');
    expect(result.issues[0].code).toBe('linked_unpublished_event');
    expect(result.clearedByReview).toBe(false);
  });

  it('flags an event that already happened after the last review', () => {
    const result = evaluateKnowledgeFreshness(row(linked), context({ events: [event({ date: '2026-09-20T02:00:00Z' })] }));
    expect(result.issues[0].code).toBe('linked_event_past');
  });

  it('does not let a review made while the event was still on clear the "already happened" flag', () => {
    // Reviewed two hours after it started, flagged the next day anyway.
    const ongoing = event({ date: '2026-10-01T02:00:00Z' });
    const result = evaluateKnowledgeFreshness(row({ ...linked, last_verified_at: '2026-10-01T04:00:00Z' }), context({ events: [ongoing] }));
    expect(result.issues.map((issue) => issue.code)).toContain('linked_event_past');
  });

  it('flags a missing event and an edited event', () => {
    expect(evaluateKnowledgeFreshness(row(linked), context({ events: [] })).issues[0].code).toBe('linked_missing');
    expect(evaluateKnowledgeFreshness(row(linked), context({ events: [event({ updated_at: '2026-09-30T00:00:00Z' })] })).issues[0].code).toBe('linked_changed');
  });
});

describe('summaries and ordering', () => {
  it('lists the worst reason first and counts the rest', () => {
    const result = evaluateKnowledgeFreshness(
      row({ freshness: 'yearly', academic_year: '2025-2026', valid_until: '2026-10-01T00:00:00Z', last_verified_at: '2025-06-01T00:00:00Z' }),
      context(),
    );
    expect(result.issues.map((issue) => issue.code)).toEqual(['prior_year', 'expired', 'review_overdue']);
    expect(result.headline).toMatch(/\(\+2 more\)$/);
  });

  it('counts stale and review-due rows and orders the most urgent, longest-unreviewed first', () => {
    const rows = [
      row({ id: 'fine' }),
      row({ id: 'due', freshness: 'quarterly', last_verified_at: '2026-05-01T00:00:00Z' }),
      row({ id: 'old-high', freshness: 'yearly', academic_year: '2025-2026', last_verified_at: '2026-03-01T00:00:00Z' }),
      row({ id: 'new-high', freshness: 'yearly', academic_year: '2025-2026', last_verified_at: '2026-07-01T00:00:00Z' }),
    ];
    const results = evaluateAllKnowledge(rows, context());
    expect(summarizeKnowledgeFreshness(results.values())).toEqual({ total: 3, stale: 2, reviewDue: 1, high: 2 });

    const ordered = rows
      .map((r) => ({ id: r.id, result: results.get(r.id)!, reviewedAt: r.last_verified_at ?? null }))
      .sort(compareByUrgency)
      .map((entry) => entry.id);
    expect(ordered).toEqual(['old-high', 'new-high', 'due', 'fine']);
  });
});

describe('parseKnowledgeYear', () => {
  it('reads year labels and rejects other text', () => {
    expect(parseKnowledgeYear('2026-2027')).toBe(2026);
    expect(parseKnowledgeYear('2026')).toBe(2026);
    expect(parseKnowledgeYear('2026-27')).toBe(2026);
    expect(parseKnowledgeYear('Fall 2026')).toBeNull();
    expect(parseKnowledgeYear(null)).toBeNull();
  });
});
