import type { ApplicationProfile } from './aceApplicationProfiles';
import { namesPerson } from './aceApplicationProfiles';

export interface ReciprocalPreferenceSignal {
  bigId: string;
  littleId: string;
  bigName: string;
  littleName: string;
  /** A first-name-only mention always requires extra identity confirmation. */
  needsNameReview: boolean;
}

type MatchStrength = 'full' | 'unique-first';

/** A name must uniquely identify a person *within the relevant applicant role*. */
function mentionedByPreference(
  answer: string | null,
  candidate: ApplicationProfile,
  roleCandidates: readonly ApplicationProfile[],
): MatchStrength | null {
  if (!answer) return null;
  const uniqueNames = candidate.nameKeys.filter(
    (name) => roleCandidates.filter((person) => person.nameKeys.includes(name)).length === 1,
  );
  if (namesPerson(answer, { nameKeys: uniqueNames, firstNames: [] }) === 'full') return 'full';

  const uniqueFirstNames = candidate.firstNames.filter(
    (name) => roleCandidates.filter((person) => person.firstNames.includes(name)).length === 1,
  );
  return namesPerson(answer, { nameKeys: [], firstNames: uniqueFirstNames }) === 'first'
    ? 'unique-first'
    : null;
}

/**
 * Finds *potential* two-way named preferences in the general application.
 * These are not the separate mutual form, proof of consent, approved guarantees,
 * or assigned Bigs. No automatic writes or matching decisions are made.
 */
export function findReciprocalPreferences(profiles: readonly ApplicationProfile[]): ReciprocalPreferenceSignal[] {
  const bigs = profiles.filter((profile) => profile.role === 'big');
  const littles = profiles.filter((profile) => profile.role === 'little');
  const results: ReciprocalPreferenceSignal[] = [];

  for (const little of littles) {
    for (const big of bigs) {
      const littleNamedBig = mentionedByPreference(little.otherPreferences, big, bigs);
      if (!littleNamedBig) continue;
      const bigNamedLittle = mentionedByPreference(big.otherPreferences, little, littles);
      if (!bigNamedLittle) continue;

      // Don't present an apparent preference as a positive pairing signal when
      // either applicant's separate do-not-pair field mentions the other.
      if (namesPerson(little.doNotPair, { nameKeys: big.nameKeys, firstNames: big.firstNames }) ||
          namesPerson(big.doNotPair, { nameKeys: little.nameKeys, firstNames: little.firstNames })) continue;

      results.push({
        bigId: big.id,
        littleId: little.id,
        bigName: big.displayName,
        littleName: little.displayName,
        needsNameReview: littleNamedBig !== 'full' || bigNamedLittle !== 'full',
      });
    }
  }

  return results.sort((a, b) =>
    a.littleName.localeCompare(b.littleName) || a.bigName.localeCompare(b.bigName),
  );
}
