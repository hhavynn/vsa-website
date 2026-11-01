/** Synthetic applicants only. No form responses or personal records. */
import type { ApplicationProfile, ApplicantRole } from './aceApplicationProfiles';
import { findReciprocalPreferences } from './aceReciprocalPreferences';
import { normalizeMemberName } from './memberLinkMatching';

const profile = (
  id: string,
  role: ApplicantRole,
  name: string,
  preferences: string | null,
  overrides: Partial<ApplicationProfile> = {},
): ApplicationProfile => ({
  id,
  role,
  fullName: name,
  displayName: name,
  nameKeys: [normalizeMemberName(name)],
  firstNames: [normalizeMemberName(name.split(' ')[0])],
  email: null,
  year: null,
  college: null,
  pronouns: null,
  genderIdentity: null,
  activity: null,
  scales: { introExtro: null, routine: null, workEthic: null, indoorOutdoor: null },
  morningNight: null,
  fridayNight: null,
  favorites: [],
  personality: [],
  doNotPair: null,
  lookingFor: null,
  genderPreference: null,
  yearPreference: null,
  hours: null,
  okWithPartaking: null,
  partakingDetails: null,
  intendsToPartake: null,
  wantedActivity: null,
  otherPreferences: preferences,
  family: null,
  capacity: null,
  capacityText: null,
  sibling: null,
  ...overrides,
});

describe('findReciprocalPreferences', () => {
  const big = profile('big-1', 'big', 'Mina Tran', 'I would love to pick up Ari Lee');
  const little = profile('little-1', 'little', 'Ari Lee', 'I want Mina Tran as my Big');

  it('surfaces a reciprocal full-name signal without approving or assigning anyone', () => {
    expect(findReciprocalPreferences([big, little])).toEqual([{
      bigId: big.id,
      littleId: little.id,
      bigName: 'Mina Tran',
      littleName: 'Ari Lee',
      needsNameReview: false,
    }]);
  });

  it('does not turn one-sided or generic preferences into reciprocal matches', () => {
    expect(findReciprocalPreferences([big, { ...little, otherPreferences: null }])).toEqual([]);
    expect(findReciprocalPreferences([
      { ...big, otherPreferences: 'Someone funny and kind' },
      { ...little, otherPreferences: 'A caring Big' },
    ])).toEqual([]);
    expect(findReciprocalPreferences([])).toEqual([]);
  });

  it('allows unique first-name mentions but explicitly flags them for review', () => {
    expect(findReciprocalPreferences([
      { ...big, otherPreferences: 'Ari' },
      { ...little, otherPreferences: 'Mina' },
    ])).toEqual([expect.objectContaining({ needsNameReview: true })]);
  });

  it('never guesses which duplicate first or full name the answer refers to', () => {
    const otherLittle = profile('little-2', 'little', 'Ari Zhao', 'Mina');
    const otherBig = profile('big-2', 'big', 'Mina Tran', 'Ari Lee');
    expect(findReciprocalPreferences([
      { ...big, otherPreferences: 'Ari' }, little, otherLittle,
    ])).toEqual([]);
    expect(findReciprocalPreferences([big, otherBig, little])).toEqual([]);
  });

  it('blocks a positive signal if either separate do-not-pair answer names the other', () => {
    expect(findReciprocalPreferences([{ ...big, doNotPair: 'Ari Lee' }, little])).toEqual([]);
    expect(findReciprocalPreferences([big, { ...little, doNotPair: 'Mina Tran' }])).toEqual([]);
  });

  it('supports preferred full-name aliases without making a fuzzy identity guess', () => {
    const nicknameBig = { ...big, nameKeys: [...big.nameKeys, 'mimi tran'], firstNames: ['mina', 'mimi'] };
    const prefLittle = { ...little, otherPreferences: 'Mimi Tran' };
    expect(findReciprocalPreferences([nicknameBig, prefLittle])).toEqual([
      expect.objectContaining({ bigName: 'Mina Tran', needsNameReview: false }),
    ]);
  });
});
