import {
  FALLBACK_APPLICATIONS,
  FALLBACK_CABINET,
  FALLBACK_EVENTS,
  FALLBACK_GET_INVOLVED_PROGRAMS,
  FALLBACK_HOUSE_MESSAGE,
  FALLBACK_HOUSE_STANDINGS_2025_2026,
  FALLBACK_LEADERBOARD,
  FALLBACK_LEGACY_HOUSE_YEARS,
  FALLBACK_POINTS,
  FALLBACK_UVSA_NETWORK,
  FALLBACK_VCN,
  FALLBACK_WNC,
} from './publicFallbackContent';

describe('public offline fallback content', () => {
  it('keeps live/unavailable messages free from stale year and date claims', () => {
    const messages = [
      FALLBACK_EVENTS.message,
      FALLBACK_HOUSE_MESSAGE,
      FALLBACK_LEADERBOARD.houseMessage,
      FALLBACK_LEADERBOARD.message,
      FALLBACK_POINTS.message,
      FALLBACK_APPLICATIONS.message,
      FALLBACK_CABINET.message,
      FALLBACK_UVSA_NETWORK.message,
      FALLBACK_VCN.description,
      FALLBACK_WNC.description,
    ];

    for (const message of messages) {
      expect(message).not.toMatch(/20\d{2}[-–/]20\d{2}|20\d{2}[-–/]\d{2}/);
      expect(message).not.toMatch(/(?:apply|register|opens|closes) (?:today|tomorrow|next week)/i);
    }
  });

  it('keeps public program summaries free from hardcoded current-season dates', () => {
    for (const program of FALLBACK_GET_INVOLVED_PROGRAMS) {
      expect(program.description).not.toMatch(/20\\d{2}[-–/]20\\d{2}/);
      expect(program.description).not.toMatch(/applications are open now/i);
    }
  });

  it('describes ACE as Anh Chị Em mentorship, not a different academic program', () => {
    const ace = FALLBACK_GET_INVOLVED_PROGRAMS.find(({ slug }) => slug === 'ace');

    expect(ace?.description).toMatch(/Anh Chị Em.*Big\/Little mentorship/);
    expect(ace?.description).not.toMatch(/Academic Community and Excellence/);
  });

  it('does not present historical House totals as a live current-year leaderboard', () => {
    expect(FALLBACK_HOUSE_MESSAGE).toMatch(/historical snapshots, not current results/i);
    expect(FALLBACK_LEADERBOARD.houseMessage).toBe(FALLBACK_HOUSE_MESSAGE);
    expect(FALLBACK_HOUSE_STANDINGS_2025_2026.map(({ name }) => name)).toEqual([
      'Bowser',
      'Donkey Kong',
      'Toad',
      'Boo',
    ]);
    expect(FALLBACK_LEGACY_HOUSE_YEARS.some(({ academicYear }) => academicYear === '2024-2025')).toBe(true);
  });

  it('does not promise an open form or published event when the source is offline', () => {
    expect(FALLBACK_APPLICATIONS.message).toMatch(/cannot be confirmed/i);
    expect(FALLBACK_EVENTS.message).toMatch(/trouble loading/i);
    expect(FALLBACK_VCN.description).toMatch(/official announcements/i);
  });
});
