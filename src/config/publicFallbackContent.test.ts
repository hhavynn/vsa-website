/**
 * Regression guard for the public degraded-mode fallback copy (#272).
 *
 * Fallback content ships in the client bundle and is what visitors read when
 * Supabase is unreachable, so it has to stay evergreen: no hardcoded academic
 * year, quarter, calendar date, or event/deadline promise it cannot guarantee,
 * and no copy that contradicts the canonical (tested) sources elsewhere in the repo.
 */
import {
  FALLBACK_APPLICATIONS,
  FALLBACK_ASK_VSA,
  FALLBACK_CABINET,
  FALLBACK_CABINET_ROLES,
  FALLBACK_EVENTS,
  FALLBACK_FEEDBACK,
  FALLBACK_GALLERY,
  FALLBACK_GET_INVOLVED_PROGRAMS,
  FALLBACK_HOUSE_MESSAGE,
  FALLBACK_HOUSE_STANDINGS,
  FALLBACK_HOUSE_STANDINGS_YEAR_START,
  FALLBACK_LEADERBOARD,
  FALLBACK_LEGACY_HOUSE_YEARS,
  FALLBACK_LINKS,
  FALLBACK_POINTS,
  FALLBACK_UVSA_NETWORK,
  FALLBACK_VCN,
  FALLBACK_WNC,
  getFallbackHouseStandings,
  getFallbackHouseStandingsLabel,
  getFallbackHouseStandingsNotice,
} from './publicFallbackContent';
import { HOUSE_COLORS, HOUSE_OPTIONS } from '../constants/houses';
import { LEGACY_HOUSE_ARCHIVE } from '../data/legacyHouseArchive';
import { formatAcademicYear } from '../lib/academicTerms';
import { getPublicHousePoints } from '../utils/housePublicPointOverrides';

const MESSAGES: Record<string, string> = {
  'FALLBACK_EVENTS.title': FALLBACK_EVENTS.title,
  'FALLBACK_EVENTS.message': FALLBACK_EVENTS.message,
  'FALLBACK_HOUSE_MESSAGE': FALLBACK_HOUSE_MESSAGE,
  'FALLBACK_CABINET.message': FALLBACK_CABINET.message,
  'FALLBACK_GALLERY.message': FALLBACK_GALLERY.message,
  'FALLBACK_APPLICATIONS.message': FALLBACK_APPLICATIONS.message,
  'FALLBACK_UVSA_NETWORK.message': FALLBACK_UVSA_NETWORK.message,
  'FALLBACK_UVSA_NETWORK.description': FALLBACK_UVSA_NETWORK.description,
  'FALLBACK_VCN.description': FALLBACK_VCN.description,
  'FALLBACK_WNC.description': FALLBACK_WNC.description,
  'FALLBACK_POINTS.message': FALLBACK_POINTS.message,
  'FALLBACK_LEADERBOARD.message': FALLBACK_LEADERBOARD.message,
  'FALLBACK_LEADERBOARD.houseMessage': FALLBACK_LEADERBOARD.houseMessage,
  'FALLBACK_FEEDBACK.message': FALLBACK_FEEDBACK.message,
  'FALLBACK_ASK_VSA.message': FALLBACK_ASK_VSA.message,
  ...Object.fromEntries(
    FALLBACK_GET_INVOLVED_PROGRAMS.map((program) => [
      `FALLBACK_GET_INVOLVED_PROGRAMS.${program.name}`,
      program.description,
    ])
  ),
  ...Object.fromEntries(
    FALLBACK_CABINET_ROLES.flatMap((role) => [
      [`FALLBACK_CABINET_ROLES.${role.role_slug}.description`, role.short_description],
      ...role.responsibilities.map((responsibility, index) => [
        `FALLBACK_CABINET_ROLES.${role.role_slug}.responsibilities.${index}`,
        responsibility,
      ]),
    ])
  ),
};

describe('fallback copy stays evergreen', () => {
  it.each(Object.entries(MESSAGES))('%s names no academic year', (_name, message) => {
    expect(message).not.toMatch(/\b(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}\b/);
  });

  it.each(Object.entries(MESSAGES))('%s names no quarter or calendar date', (_name, message) => {
    expect(message).not.toMatch(/\b(fall|winter|spring|summer)\s+(quarter|term)\b/i);
    expect(message).not.toMatch(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i
    );
    expect(message).not.toMatch(/\b(19|20)\d{2}-\d{2}-\d{2}\b/);
  });

  it.each(Object.entries(MESSAGES))('%s promises no deadline or standing it cannot guarantee', (_name, message) => {
    expect(message).not.toMatch(/\b(apply by|applications? (open|close)[^.]{0,20}\b(on|by)\b|deadline)\b/i);
    expect(message).not.toMatch(/\bwill (be|open|close|happen|start)\b/i);
  });

  it.each(Object.entries(MESSAGES))('%s leaks no contact detail', (_name, message) => {
    expect(message).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });

  it('keeps every fallback surface populated', () => {
    Object.entries(MESSAGES).forEach(([name, message]) => {
      expect(message.trim().length).toBeGreaterThan(0);
      expect(name).toBeTruthy();
    });
    expect(FALLBACK_LINKS.instagram).toMatch(/^https:\/\//);
    expect(FALLBACK_LINKS.linktree).toMatch(/^https:\/\//);
  });
});

describe('fallback House standings', () => {
  it('mirrors the official public House totals, never a second set of numbers', () => {
    FALLBACK_HOUSE_STANDINGS.forEach((standing) => {
      const official = getPublicHousePoints({
        houseName: standing.name,
        academicYearStart: FALLBACK_HOUSE_STANDINGS_YEAR_START,
        calculatedPoints: 0,
      });
      expect(standing.points).toBe(official);
    });
  });

  it('uses the canonical House names and accent colours', () => {
    expect([...FALLBACK_HOUSE_STANDINGS].map((standing) => standing.name).sort()).toEqual(
      [...HOUSE_OPTIONS].sort()
    );
    FALLBACK_HOUSE_STANDINGS.forEach((standing) => {
      expect(standing.accentColor).toBe(HOUSE_COLORS[standing.name as keyof typeof HOUSE_COLORS]);
    });
  });

  it('derives the academic-year label instead of typing it', () => {
    expect(getFallbackHouseStandingsLabel()).toBe(
      formatAcademicYear(FALLBACK_HOUSE_STANDINGS_YEAR_START)
    );
    expect(getFallbackHouseStandingsNotice()).toContain(
      getFallbackHouseStandingsLabel()
    );
  });

  it('only answers for a year with published totals', () => {
    expect(getFallbackHouseStandings(FALLBACK_HOUSE_STANDINGS_YEAR_START)).toBe(
      FALLBACK_HOUSE_STANDINGS
    );
    expect(getFallbackHouseStandings(FALLBACK_HOUSE_STANDINGS_YEAR_START + 1)).toBeNull();
    expect(getFallbackHouseStandings(FALLBACK_HOUSE_STANDINGS_YEAR_START - 1)).toBeNull();
    expect(getFallbackHouseStandings(null)).toBeNull();
  });
});

describe('fallback House archive', () => {
  it('derives its years from the canonical archive', () => {
    expect(FALLBACK_LEGACY_HOUSE_YEARS.map((entry) => entry.academicYear)).toEqual(
      LEGACY_HOUSE_ARCHIVE.map((entry) => entry.academicYear)
    );
    expect(FALLBACK_LEGACY_HOUSE_YEARS).toContainEqual(
      expect.objectContaining({ academicYear: '2025-2026', houses: ['Bowser', 'Donkey Kong', 'Boo', 'Toad'] })
    );
  });
});

describe('fallback program copy stays culturally accurate', () => {
  it('describes ACE as Anh Chị Em, the Big/Little program', () => {
    const ace = FALLBACK_GET_INVOLVED_PROGRAMS.find((program) => program.slug === 'ace');
    expect(ace?.name).toContain('Anh Chi Em');
    expect(ace?.description).toMatch(/Big\/Little/i);
    expect(ace?.description).not.toMatch(/Academic Community and Excellence/i);
  });

  it('describes WNC as the intercollegiate comedy competition', () => {
    const wnc = FALLBACK_GET_INVOLVED_PROGRAMS.find((program) => program.slug === 'wild-n-culture');
    expect(wnc?.description).toMatch(/comedy/i);
    expect(FALLBACK_WNC.description).toMatch(/comedy/i);
    expect(FALLBACK_WNC.description).not.toMatch(/dance, music/i);
  });

  it('describes VCN as the annual culture show', () => {
    const vcn = FALLBACK_GET_INVOLVED_PROGRAMS.find((program) => program.slug === 'vcn');
    expect(vcn?.description).toMatch(/culture show/i);
    expect(FALLBACK_VCN.description).toMatch(/annual/i);
  });
});
