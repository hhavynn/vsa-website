import {
  ATTENTION_LINKS,
  AttentionSignals,
  DRAFT_EVENT_HORIZON_DAYS,
  EMPTY_ATTENTION_SIGNALS,
  attentionSummary,
  attentionTotal,
  buildAttentionQueue,
  warnsWhenNoUpcomingEvents,
} from './adminAttention';

// Thu Oct 1 2026, 9:00 AM PDT.
const NOW = new Date('2026-10-01T16:00:00Z');
const URL = 'https://forms.gle/x';

/** Every source loaded and nothing waiting. */
const CLEAR: AttentionSignals = {
  applications: [],
  draftEventDates: [],
  photoRequestsPending: 0,
  dataRightsOpen: 0,
  aiFeedbackUnresolved: 0,
  feedbackPending: 0,
};

const signals = (overrides: Partial<AttentionSignals> = {}): AttentionSignals => ({ ...CLEAR, ...overrides });
const byId = (queue: ReturnType<typeof buildAttentionQueue>, id: string) => queue.items.find((item) => item.id === id);

describe('attention queue', () => {
  it('has nothing to say when every source loaded and nothing is waiting', () => {
    const queue = buildAttentionQueue(signals(), NOW);
    expect(queue).toEqual({ items: [], unchecked: [] });
    expect(attentionSummary(queue)).toBe('Nothing needs attention');
  });

  it('links each count to the page and filter that resolves it', () => {
    const queue = buildAttentionQueue(
      signals({
        photoRequestsPending: 3,
        dataRightsOpen: 2,
        aiFeedbackUnresolved: 5,
        feedbackPending: 4,
        draftEventDates: ['2026-10-08T01:00:00Z'],
        applications: [
          { application_key: 'house_fall', open_at: '2026-09-01T07:00:00Z', due_at: '2026-10-03T06:59:00Z', is_enabled: true, target_url: URL },
          { application_key: 'ace_application', open_at: '2026-10-04T07:00:00Z', due_at: '2026-11-30T07:59:00Z', is_enabled: true, target_url: URL },
        ],
      }),
      NOW,
    );

    const destinations = Object.fromEntries(queue.items.map((item) => [item.id, [item.count, item.to]]));
    expect(destinations).toEqual({
      'applications-closing': [1, '/admin/applications?filter=open'],
      'applications-opening': [1, '/admin/applications?filter=scheduled'],
      'photo-requests': [3, '/admin/photo-requests?filter=pending'],
      'data-rights': [2, '/admin/data-rights?filter=open'],
      'ai-feedback': [5, '/admin/ai-feedback?filter=unresolved'],
      feedback: [4, '/admin/feedback?filter=pending'],
      'draft-events': [1, '/admin/events?filter=draft'],
    });
    // The destinations are the documented constants, never the generic admin home.
    for (const item of queue.items) expect(item.to).not.toBe('/admin');
    expect(Object.values(ATTENTION_LINKS)).toEqual(expect.arrayContaining(queue.items.map((item) => item.to)));
    expect(attentionTotal(queue)).toBe(1 + 1 + 3 + 2 + 5 + 4 + 1);
  });

  it('puts the urgent items first', () => {
    const queue = buildAttentionQueue(signals({ photoRequestsPending: 1, dataRightsOpen: 1 }), NOW);
    expect(queue.items.map((item) => item.id)).toEqual(['data-rights', 'photo-requests']);
  });

  it('words an application deadline with the same helper the homepage notice uses', () => {
    const queue = buildAttentionQueue(
      signals({ applications: [{ application_key: 'house_fall', open_at: '2026-09-01T07:00:00Z', due_at: '2026-10-03T06:59:00Z', is_enabled: true, target_url: URL }] }),
      NOW,
    );
    expect(byId(queue, 'applications-closing')).toMatchObject({ detail: 'House Applications close tomorrow', tone: 'urgent' });
  });

  it('counts every window closing soon, even two that share a program name', () => {
    const queue = buildAttentionQueue(
      signals({
        applications: [
          { application_key: 'house_fall', open_at: '2026-09-01T07:00:00Z', due_at: '2026-10-05T06:59:00Z', is_enabled: true, target_url: URL },
          { application_key: 'house_winter', open_at: '2026-09-01T07:00:00Z', due_at: '2026-10-06T06:59:00Z', is_enabled: true, target_url: URL },
        ],
      }),
      NOW,
    );
    expect(byId(queue, 'applications-closing')?.count).toBe(2);
  });

  it('classifies windows like /admin/applications, so each count matches the rows its link shows', () => {
    const queue = buildAttentionQueue(
      signals({
        applications: [
          // Live and closing tomorrow, but the link is not https: the admin page files it under "needs fixing".
          { application_key: 'house_fall', open_at: '2026-09-01T07:00:00Z', due_at: '2026-10-03T06:59:00Z', is_enabled: true, target_url: 'http://insecure.example/x' },
          // Healthy, closing in two days.
          { application_key: 'ace_application', open_at: '2026-09-01T07:00:00Z', due_at: '2026-10-04T06:59:00Z', is_enabled: true, target_url: URL },
        ],
      }),
      NOW,
    );

    expect(byId(queue, 'applications-closing')).toMatchObject({ count: 1, detail: 'ACE Applications close in 2 days' });
    expect(byId(queue, 'applications-broken')).toMatchObject({ count: 1, to: '/admin/applications?filter=misconfigured', tone: 'urgent' });
  });

  it('measures the horizon in San Diego calendar days, not 168 hours', () => {
    // 8 AM PT Oct 1: a deadline at 11:59 PM PT on Oct 8 is "in 7 days" and must be listed.
    const morning = new Date('2026-10-01T15:00:00Z');
    const queue = buildAttentionQueue(
      signals({
        applications: [
          { application_key: 'house_fall', open_at: '2026-09-01T07:00:00Z', due_at: '2026-10-09T06:59:00Z', is_enabled: true, target_url: URL },
          { application_key: 'ace_application', open_at: '2026-09-01T07:00:00Z', due_at: '2026-10-10T06:59:00Z', is_enabled: true, target_url: URL },
        ],
      }),
      morning,
    );
    expect(byId(queue, 'applications-closing')).toMatchObject({ count: 1, detail: 'House Applications close in 7 days' });
  });

  it('ignores application windows that are disabled, already closed, or far away', () => {
    const queue = buildAttentionQueue(
      signals({
        applications: [
          { application_key: 'ace_application', open_at: '2026-09-01T07:00:00Z', due_at: '2026-10-03T06:59:00Z', is_enabled: false, target_url: URL },
          { application_key: 'house_fall', open_at: '2026-08-01T07:00:00Z', due_at: '2026-09-01T06:59:00Z', is_enabled: true, target_url: URL },
          { application_key: 'cabinet_application', open_at: '2026-09-01T07:00:00Z', due_at: '2026-12-01T07:59:00Z', is_enabled: true, target_url: URL },
        ],
      }),
      NOW,
    );
    expect(queue.items).toEqual([]);
  });

  it('only counts unpublished events that are coming up within the horizon', () => {
    const day = 24 * 60 * 60 * 1000;
    const inside = new Date(NOW.getTime() + 3 * day).toISOString();
    const edge = new Date(NOW.getTime() + DRAFT_EVENT_HORIZON_DAYS * day).toISOString();
    const beyond = new Date(NOW.getTime() + (DRAFT_EVENT_HORIZON_DAYS + 1) * day).toISOString();
    const past = new Date(NOW.getTime() - 3 * day).toISOString();
    const queue = buildAttentionQueue(signals({ draftEventDates: [inside, edge, beyond, past, 'garbage'] }), NOW);
    expect(byId(queue, 'draft-events')?.count).toBe(2);
  });

  it('says which sources could not be read instead of reading them as zero', () => {
    const queue = buildAttentionQueue({ ...EMPTY_ATTENTION_SIGNALS, photoRequestsPending: 2 }, NOW);
    expect(queue.items.map((item) => item.id)).toEqual(['photo-requests']);
    expect(queue.unchecked).toEqual(['application windows', 'data-rights requests', 'Ask VSA feedback', 'feedback', 'events']);
  });

  it('is count-only: items carry generic labels, never record details', () => {
    const queue = buildAttentionQueue(signals({ photoRequestsPending: 3, dataRightsOpen: 1, aiFeedbackUnresolved: 2, feedbackPending: 1 }), NOW);
    for (const item of queue.items) {
      expect(Object.keys(item).sort()).toEqual(expect.arrayContaining(['count', 'id', 'label', 'to', 'tone']));
      expect(item.label).not.toMatch(/@|\d{3}-\d{4}/);
    }
  });
});

describe('seasonal suppression', () => {
  it('warns about no upcoming events during the school year but not over summer break', () => {
    expect(warnsWhenNoUpcomingEvents(new Date('2026-10-01T16:00:00Z'))).toBe(true);
    expect(warnsWhenNoUpcomingEvents(new Date('2026-07-20T19:00:00Z'))).toBe(false);
  });

  describe('content health', () => {
    it('adds one count that links to the Health page, urgent only when something is high priority', () => {
      const calm = byId(buildAttentionQueue(signals({ contentHealth: { issues: 6, urgent: 0 } }), NOW), 'content-health');
      expect(calm).toMatchObject({ count: 6, label: 'content health issues', to: '/admin/content-health', tone: 'attention' });
      const urgent = byId(buildAttentionQueue(signals({ contentHealth: { issues: 1, urgent: 1 } }), NOW), 'content-health');
      expect(urgent).toMatchObject({ count: 1, label: 'content health issue', tone: 'urgent' });
    });

    it('stays out of the way when there are no issues or the signal is not part of the check', () => {
      expect(byId(buildAttentionQueue(signals({ contentHealth: { issues: 0, urgent: 0 } }), NOW), 'content-health')).toBeUndefined();
      expect(buildAttentionQueue(signals(), NOW)).toEqual({ items: [], unchecked: [] });
    });

    it('says it could not check, instead of implying all is well', () => {
      expect(buildAttentionQueue(signals({ contentHealth: null }), NOW).unchecked).toEqual(['content health']);
    });

    it('carries counts only', () => {
      const queue = buildAttentionQueue(signals({ contentHealth: { issues: 6, urgent: 2 } }), NOW);
      expect(Object.keys(byId(queue, 'content-health') ?? {}).sort()).toEqual(['count', 'id', 'label', 'to', 'tone']);
    });
  });
});
