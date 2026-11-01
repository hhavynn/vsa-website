/**
 * Application answers belong to the cycle they were loaded for. Synthetic data only.
 */
import { act, renderHook } from '@testing-library/react';
import { memberLookupRepository } from '../data/repos/memberLookup';
import type { AceAssignmentDraft } from '../types';
import { useAceApplicationProfiles } from './useAceApplicationProfiles';

jest.mock('../data/repos/memberLookup', () => ({
  memberLookupRepository: { matchMembersByEmail: jest.fn() },
}));

const matchMembersByEmail = memberLookupRepository.matchMembersByEmail as jest.Mock;

const PASTE = [
  ['Name (First, Middle Initial, Last)', 'UCSD Email', 'Are You Applying to be an Anh/Chi (Big) or Em (Little)? ', 'Year?'],
  ['Ben Ho', 'bho', 'Em (Little)', '1st'],
]
  .map((row) => row.join('\t'))
  .join('\n');

const drafts: AceAssignmentDraft[] = [
  {
    id: 'd-ben',
    cycle_id: 'cycle-a',
    little_name: 'Ben Ho',
    little_member_id: null,
    big_ace_member_id: null,
    published_ace_member_id: null,
    notes: null,
    display_order: 0,
    created_at: '',
    updated_at: '',
  },
];

const loadFor = () => ({ current: 0, incoming: 0 });

function setup() {
  return renderHook(({ cycleId }) => useAceApplicationProfiles(cycleId, drafts, [], loadFor), {
    initialProps: { cycleId: 'cycle-a' as string | null },
  });
}

beforeEach(() => matchMembersByEmail.mockReset().mockResolvedValue(new Map()));

it('drops loaded answers when the chair switches cycles', async () => {
  const { result, rerender } = setup();
  await act(async () => {
    await result.current.load(PASTE);
  });
  expect(result.current.loaded).toBe(true);
  expect(result.current.rowFor(drafts[0])?.little?.year?.text).toBe('1st');

  rerender({ cycleId: 'cycle-b' });
  expect(result.current.loaded).toBe(false);
  expect(result.current.rowFor(drafts[0])).toBeUndefined();

  rerender({ cycleId: 'cycle-a' });
  expect(result.current.loaded).toBe(false);
});

it('ignores an email lookup that finishes after the cycle changed', async () => {
  let resolveLookup: (value: Map<string, never[]>) => void = () => undefined;
  matchMembersByEmail.mockReturnValue(new Promise((resolve) => (resolveLookup = resolve)));
  const { result, rerender } = setup();

  let pending: Promise<unknown> = Promise.resolve();
  act(() => {
    pending = result.current.load(PASTE);
  });
  rerender({ cycleId: 'cycle-b' });
  await act(async () => {
    resolveLookup(new Map());
    await pending;
  });
  expect(result.current.loaded).toBe(false);
});

it('refuses to replace a loaded application with a missing-header or all-skipped form', async () => {
  const { result } = setup();
  await act(async () => { await result.current.load(PASTE); });
  expect(result.current.summary?.littleCount).toBe(1);

  await expect(result.current.load('Name,Email\nUnrelated Person,nobody')).rejects.toThrow(/No valid Big or Little applications/);
  expect(result.current.summary?.littleCount).toBe(1);
  expect(result.current.rowFor(drafts[0])?.little?.displayName).toBe('Ben Ho');

  const headerOnly = PASTE.split('\n')[0];
  await expect(result.current.load(headerOnly)).rejects.toThrow(/No valid Big or Little applications/);
  expect(result.current.summary?.littleCount).toBe(1);
  expect(matchMembersByEmail).toHaveBeenCalledTimes(1);
});
