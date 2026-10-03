/**
 * Shared application-window logic: the admin status vocabulary, Pacific-time
 * display, publish guardrails, the public projection used by the admin preview,
 * and the closing-soon rules shared by the homepage and the Admin Overview.
 *
 * Like applicationWindowBoundaries.test.ts this runs under several TZ values
 * (npm run test:timezones): nothing here may depend on the machine's timezone.
 */
import {
  CLOSING_SOON_DAYS,
  closingHeadline,
  closingSoonStartsAt,
  formatPacificDateTime,
  getAdminWindowState,
  getClosingSoon,
  getClosingSoonNotices,
  getOpeningSoon,
  isValidFormUrl,
  opensInThePast,
  pacificDaysBetween,
  projectPublicApplicationLink,
  validateApplicationWindow,
} from './applicationWindows';
import { ApplicationKey } from '../types';

// Thu Oct 1 2026, 9:00 AM PDT.
const NOW = new Date('2026-10-01T16:00:00Z');
const URL = 'https://forms.gle/real-form';

function facts(overrides: Partial<{ open_at: string; due_at: string; is_enabled: boolean; target_url: string }> = {}) {
  return {
    open_at: '2026-09-25T07:00:00Z',
    due_at: '2026-10-09T06:59:00Z',
    is_enabled: true,
    target_url: URL,
    ...overrides,
  };
}

describe('window state (what an admin sees at a glance)', () => {
  it('is Open inside the window', () => {
    expect(getAdminWindowState(facts(), NOW)).toMatchObject({ state: 'open', status: 'open', isPublic: true, issues: [] });
  });

  it('is Scheduled before it opens, and not public yet', () => {
    const result = getAdminWindowState(facts({ open_at: '2026-10-05T07:00:00Z' }), NOW);
    expect(result).toMatchObject({ state: 'scheduled', status: 'not_open', isPublic: false });
  });

  it('is Closed after the due time', () => {
    const result = getAdminWindowState(facts({ open_at: '2026-09-01T07:00:00Z', due_at: '2026-09-15T06:59:00Z' }), NOW);
    expect(result).toMatchObject({ state: 'closed', status: 'closed', isPublic: false });
  });

  it('is Disabled when switched off, even inside its dates', () => {
    expect(getAdminWindowState(facts({ is_enabled: false }), NOW)).toMatchObject({ state: 'disabled', isPublic: false });
  });

  it('is Needs fixing, and never public, when the close time is not after the open time', () => {
    const result = getAdminWindowState(facts({ open_at: '2026-10-05T07:00:00Z', due_at: '2026-10-04T07:00:00Z' }), NOW);
    expect(result.state).toBe('misconfigured');
    expect(result.isPublic).toBe(false);
    expect(result.issues).toEqual([expect.objectContaining({ code: 'close_before_open', severity: 'error' })]);
  });

  it('fails closed on a missing or malformed schedule', () => {
    for (const bad of [{ open_at: '' }, { due_at: 'not a date' }]) {
      const result = getAdminWindowState(facts(bad), NOW);
      expect(result.state).toBe('misconfigured');
      expect(result.isPublic).toBe(false);
      expect(result.issues[0]).toMatchObject({ code: 'invalid_schedule', severity: 'error' });
    }
  });

  it('treats an enabled window without a valid https URL as broken, but only warns when it is disabled', () => {
    // The public view only checks enabled + dates, so a live row with a bad link
    // IS reachable by students: the admin must be told so, not "not public".
    const enabled = getAdminWindowState(facts({ target_url: 'http://insecure.example/form' }), NOW);
    expect(enabled.state).toBe('misconfigured');
    expect(enabled.isPublic).toBe(true);
    expect(enabled.issues[0]).toMatchObject({ code: 'invalid_url', severity: 'error', message: expect.stringContaining('live') });

    const noUrl = getAdminWindowState(facts({ target_url: '' }), NOW);
    expect(noUrl.state).toBe('misconfigured');
    expect(noUrl.isPublic).toBe(false);

    const disabled = getAdminWindowState(facts({ target_url: '', is_enabled: false }), NOW);
    expect(disabled.state).toBe('disabled');
    expect(disabled.issues).toEqual([expect.objectContaining({ code: 'invalid_url', severity: 'warning' })]);
  });

  it('warns about a seeded placeholder URL without blocking', () => {
    const issues = validateApplicationWindow(facts({ target_url: 'https://example.com/placeholder' }));
    expect(issues).toEqual([expect.objectContaining({ code: 'placeholder_url', severity: 'warning' })]);
  });

  it('only accepts complete https URLs', () => {
    expect(isValidFormUrl(URL)).toBe(true);
    // Built by concatenation so the linter's no-script-url rule doesn't flag the fixture.
    for (const bad of ['', '  ', 'forms.gle/x', 'http://forms.gle/x', 'https://', `${'java'}script:alert(1)`]) {
      expect(isValidFormUrl(bad)).toBe(false);
    }
  });

  it('flags an open time that is already in the past', () => {
    expect(opensInThePast('2026-09-25T07:00:00Z', NOW)).toBe(true);
    expect(opensInThePast('2026-10-05T07:00:00Z', NOW)).toBe(false);
    expect(opensInThePast('', NOW)).toBe(false);
  });
});

describe(`Pacific Time display (TZ=${process.env.TZ ?? 'unset'})`, () => {
  it('always names the zone as PT and reads the same on any machine', () => {
    expect(formatPacificDateTime('2026-10-09T06:59:00.000Z')).toBe('Oct 8, 2026, 11:59 PM PT');
    expect(formatPacificDateTime('2026-10-01T16:00:00Z')).toBe('Oct 1, 2026, 9:00 AM PT');
    // Winter (PST) is still "PT", and the instant is shifted by the right offset.
    expect(formatPacificDateTime('2027-01-09T07:59:00Z')).toBe('Jan 8, 2027, 11:59 PM PT');
    expect(formatPacificDateTime('2026-10-09T06:59:00.000Z', { withYear: false })).toBe('Oct 8, 11:59 PM PT');
  });

  it('returns nothing for a missing or invalid value', () => {
    expect(formatPacificDateTime(null)).toBe('');
    expect(formatPacificDateTime('nonsense')).toBe('');
  });

  it('counts days on the San Diego calendar, not 24-hour blocks', () => {
    // 11 PM PDT Oct 8 -> a deadline at 11:59 PM PDT Oct 9 is "tomorrow", even though it is 25 hours away.
    const lateNight = new Date('2026-10-09T06:00:00Z');
    const due = new Date('2026-10-10T06:59:00Z');
    expect(pacificDaysBetween(lateNight, due)).toBe(1);
    expect(closingHeadline('house_fall', due, lateNight)).toBe('House Applications close tomorrow');
    expect(pacificDaysBetween(due, due)).toBe(0);
  });
});

describe('public projection (admin preview uses the same gate as the site)', () => {
  const row = (overrides: Partial<ReturnType<typeof facts>> = {}) => ({
    application_key: 'house_fall' as ApplicationKey,
    title: 'House Fall',
    description: null,
    button_label: 'Apply',
    before_open_message: 'Soon',
    after_close_message: 'Done',
    sort_order: 1,
    ...facts(overrides),
  });

  it('exposes the URL only while the window is open', () => {
    expect(projectPublicApplicationLink(row(), NOW)).toMatchObject({ status: 'open', target_url: URL });
  });

  it('hides the URL for a scheduled, closed, or disabled window', () => {
    expect(projectPublicApplicationLink(row({ open_at: '2026-10-05T07:00:00Z' }), NOW)).toMatchObject({ status: 'not_open', target_url: null });
    expect(projectPublicApplicationLink(row({ open_at: '2026-09-01T07:00:00Z', due_at: '2026-09-15T06:59:00Z' }), NOW)).toMatchObject({ status: 'closed', target_url: null });
    expect(projectPublicApplicationLink(row({ is_enabled: false }), NOW)).toMatchObject({ status: 'disabled', target_url: null });
  });

  it('previews a disabled window as if switched on, still masking outside its dates', () => {
    expect(projectPublicApplicationLink(row({ is_enabled: false }), NOW, { assumeEnabled: true })).toMatchObject({ status: 'open', target_url: URL });
    expect(projectPublicApplicationLink(row({ is_enabled: false, open_at: '2026-10-05T07:00:00Z' }), NOW, { assumeEnabled: true })).toMatchObject({ status: 'not_open', target_url: null });
  });

  it('fails closed on a malformed schedule', () => {
    expect(projectPublicApplicationLink(row({ open_at: '' }), NOW)).toMatchObject({ status: 'disabled', target_url: null });
  });
});

describe('closing soon (shared by the homepage and the Admin Overview)', () => {
  const window = (key: ApplicationKey, due_at: string, overrides: Record<string, unknown> = {}) => ({
    application_key: key,
    open_at: '2026-09-01T07:00:00Z',
    due_at,
    is_enabled: true,
    ...overrides,
  });

  it('uses one documented horizon', () => {
    expect(CLOSING_SOON_DAYS).toBe(7);
  });

  it('keeps open windows due within the horizon, soonest first, with natural headlines', () => {
    const result = getClosingSoon(
      [
        window('cabinet_application', '2026-10-04T06:59:00Z'), // Oct 3 11:59 PM PDT -> in 2 days
        window('ace_application', '2026-10-02T06:59:00Z'), // Oct 1 11:59 PM PDT -> today
        window('house_fall', '2026-10-03T06:59:00Z'), // Oct 2 -> tomorrow
        window('intern_application', '2026-10-30T06:59:00Z'), // beyond the horizon
      ],
      NOW,
    );
    expect(result.map((entry) => entry.headline)).toEqual([
      'ACE Applications close today',
      'House Applications close tomorrow',
      'Cabinet Applications close in 2 days',
    ]);
  });

  it('drops windows that are not open right now', () => {
    const result = getClosingSoon(
      [
        window('ace_application', '2026-10-03T06:59:00Z', { is_enabled: false }),
        window('house_fall', '2026-10-03T06:59:00Z', { open_at: '2026-10-02T07:00:00Z' }), // not open yet
        window('house_winter', '2026-09-30T06:59:00Z'), // already closed
      ],
      NOW,
    );
    expect(result).toEqual([]);
  });

  it('can count every window instead of one per program name (the admin queue)', () => {
    const rows = [window('house_winter', '2026-10-05T06:59:00Z'), window('house_fall', '2026-10-03T06:59:00Z')];
    expect(getClosingSoon(rows, NOW)).toHaveLength(1);
    expect(getClosingSoon(rows, NOW, CLOSING_SOON_DAYS, { dedupeByName: false })).toHaveLength(2);
  });

  it('shows one entry per program name, the soonest', () => {
    const result = getClosingSoon([window('house_winter', '2026-10-05T06:59:00Z'), window('house_fall', '2026-10-03T06:59:00Z')], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].row.application_key).toBe('house_fall');
  });

  it('starts the notice at San Diego midnight, a whole number of calendar days before the deadline', () => {
    // Due Oct 8 11:59 PM PDT -> shows from Oct 1 12:00 AM PDT.
    expect(closingSoonStartsAt('2026-10-09T06:59:00Z').toISOString()).toBe('2026-10-01T07:00:00.000Z');
    // Due Nov 3 11:59 PM PST, after clocks fell back: the start is still midnight Pacific (Oct 27, PDT).
    expect(closingSoonStartsAt('2026-11-04T07:59:00Z').toISOString()).toBe('2026-10-27T07:00:00.000Z');
  });

  it('includes a deadline seven San Diego days out for the whole day, not only the last 168 hours', () => {
    const morning = new Date('2026-10-01T15:00:00Z'); // 8:00 AM PDT
    const rows = [window('house_fall', '2026-10-09T06:59:00Z'), window('ace_application', '2026-10-10T06:59:00Z')]; // Oct 8 / Oct 9, 11:59 PM PDT
    expect(getClosingSoon(rows, morning).map((entry) => entry.row.application_key)).toEqual(['house_fall']);
    const opening = [window('house_fall', '2026-12-01T07:59:00Z', { open_at: '2026-10-08T07:00:00Z' })];
    expect(getOpeningSoon(opening, morning)).toHaveLength(1);
  });

  it('only offers a link when the row carries a usable URL', () => {
    const rows = [
      { ...window('ace_application', '2026-10-03T06:59:00Z'), target_url: URL },
      { ...window('house_fall', '2026-10-03T06:59:00Z'), target_url: null },
      { ...window('intern_application', '2026-10-03T06:59:00Z'), target_url: 'http://not-https.example/x' },
    ];
    expect(getClosingSoonNotices(rows, NOW).map((entry) => [entry.row.application_key, entry.url])).toEqual([['ace_application', URL]]);
  });

  it('lists enabled windows about to open, soonest first', () => {
    const result = getOpeningSoon(
      [
        window('cabinet_application', '2026-11-30T07:59:00Z', { open_at: '2026-10-05T07:00:00Z' }),
        window('ace_application', '2026-11-30T07:59:00Z', { open_at: '2026-10-02T07:00:00Z' }),
        window('intern_application', '2026-11-30T07:59:00Z', { open_at: '2026-12-01T08:00:00Z' }),
        window('house_fall', '2026-11-30T07:59:00Z', { open_at: '2026-10-02T07:00:00Z', is_enabled: false }),
      ],
      NOW,
    );
    expect(result.map((entry) => entry.headline)).toEqual(['ACE Applications open tomorrow', 'Cabinet Applications open in 4 days']);
  });
});
