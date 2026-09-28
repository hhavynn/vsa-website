/**
 * Repository-layer guard for the applications invariant (#273): a closed,
 * future or disabled application URL must never reach a public caller.
 *
 * The primary control is server-side: public reads go through the
 * public_application_links view, which nulls target_url unless the window is
 * open, and the base table has no anon/non-admin read policy. These tests pin
 * the client half: public methods read only the view, and even if the view
 * ever returned a URL for a non-open row, the repository would drop it.
 */

import { applicationLinksRepository } from './applicationLinks';
import { supabaseMock } from '../../test-utils/supabaseMock';
import { ApplicationKey, ApplicationStatus, PublicApplicationLink } from '../../types';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const ALL_KEYS: ApplicationKey[] = [
  'ace_application',
  'house_fall',
  'house_winter',
  'house_spring',
  'intern_application',
  'cabinet_application',
  'vcn_stage_ninja_interest',
  'vcn_props_team_interest',
  'wnc_team_form',
];

const STATUSES: ApplicationStatus[] = ['disabled', 'not_open', 'open', 'closed'];

// Obviously fake: never put a real form link in a fixture.
const fakeUrl = (key: string) => `https://example.invalid/${key}`;

function row(application_key: ApplicationKey, status: ApplicationStatus): PublicApplicationLink {
  return {
    id: `${application_key}-${status}`,
    application_key,
    title: application_key,
    description: null,
    button_label: 'Apply',
    // Simulates a server-side masking regression: every row carries a URL.
    target_url: fakeUrl(application_key),
    status,
    open_at: '2026-09-01T00:00:00Z',
    due_at: '2026-09-30T00:00:00Z',
    is_enabled: status !== 'disabled',
    before_open_message: null,
    after_close_message: null,
    sort_order: 0,
    updated_at: '2026-09-01T00:00:00Z',
  };
}

const everyKeyInEveryStatus = ALL_KEYS.flatMap((key) => STATUSES.map((status) => row(key, status)));

beforeEach(() => {
  supabaseMock.reset();
});

describe('ApplicationLinksRepository — non-open URLs never reach public callers (#273)', () => {
  it('masks the URL for every managed window unless it is open', async () => {
    supabaseMock.queueResult('public_application_links', { data: everyKeyInEveryStatus, error: null });

    const links = await applicationLinksRepository.getPublicApplicationLinks();

    expect(links.map((link) => [link.application_key, link.status, link.target_url])).toEqual(
      everyKeyInEveryStatus.map((link) => [
        link.application_key,
        link.status,
        link.status === 'open' ? fakeUrl(link.application_key) : null,
      ]),
    );
  });

  it('masks the URL on the by-key path too', async () => {
    supabaseMock.queueResult('public_application_links', {
      data: [row('house_fall', 'not_open'), row('house_winter', 'closed'), row('house_spring', 'disabled')],
      error: null,
    });

    const links = await applicationLinksRepository.getPublicApplicationLinksByKeys([
      'house_fall',
      'house_winter',
      'house_spring',
    ]);

    expect(links.map((link) => link.target_url)).toEqual([null, null, null]);
  });

  it('keeps the URL out of the serialized payload, not just the field', async () => {
    supabaseMock.queueResult('public_application_links', {
      data: everyKeyInEveryStatus.filter((link) => link.status !== 'open'),
      error: null,
    });

    const links = await applicationLinksRepository.getPublicApplicationLinks();

    expect(JSON.stringify(links)).not.toContain('example.invalid');
  });

  it('reads public data only from the masking view, never the base table', async () => {
    supabaseMock.queueResult('public_application_links', { data: [], error: null });
    supabaseMock.queueResult('public_application_links', { data: [], error: null });

    await applicationLinksRepository.getPublicApplicationLinks();
    await applicationLinksRepository.getPublicApplicationLink('ace_application');

    expect(supabaseMock.queriesFor('application_links')).toHaveLength(0);
    expect(supabaseMock.queriesFor('public_application_links')).toHaveLength(2);
  });

  it('every public method is covered by the view-only rule', () => {
    const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(applicationLinksRepository)).filter(
      (name) => name.startsWith('getPublic'),
    );

    // If this list changes, add the new method to the tests above so its
    // masking and table choice are asserted, then update the expectation.
    expect(publicMethods.sort()).toEqual([
      'getPublicApplicationLink',
      'getPublicApplicationLinks',
      'getPublicApplicationLinksByKeys',
    ]);
  });
});
