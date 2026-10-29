import type { HouseEvent, HousePageAsset } from '../types';
import {
  HOUSE_PLANNING_QUARTERS,
  housePlanningCsv,
  planningQuarterForDate,
  summarizeHouseEventPlanning,
} from './houseEventPlanning';

const house = (id: string, year = 2026, name = id): HousePageAsset => ({
  id,
  house_key: name,
  house: name,
  display_name: name,
  academic_year_start: year,
}) as HousePageAsset;

const event = (
  id: string,
  date: string,
  hosts: HousePageAsset[],
  published = true,
  year = 2026,
): HouseEvent => ({
  id,
  academic_year_start: year,
  event_date: date,
  is_published: published,
  house_profile_id: hosts[0]?.id ?? '',
  houses: hosts,
}) as HouseEvent;

describe('House event quarterly planning (#638)', () => {
  const today = '2026-10-28';
  const alpha = house('alpha');
  const beta = house('beta');
  const old = house('last-year', 2025);
  const rowsFor = (events: HouseEvent[]) => summarizeHouseEventPlanning(events, [alpha, beta], 2026, today);

  it('uses Fall/Winter/Spring academic-year boundaries without timezone shifts', () => {
    expect(HOUSE_PLANNING_QUARTERS).toEqual(['fall', 'winter', 'spring']);
    expect(planningQuarterForDate('2026-09-01', 2026)).toBe('fall');
    expect(planningQuarterForDate('2026-12-31', 2026)).toBe('fall');
    expect(planningQuarterForDate('2027-01-01', 2026)).toBe('winter');
    expect(planningQuarterForDate('2027-03-31', 2026)).toBe('winter');
    expect(planningQuarterForDate('2027-04-01', 2026)).toBe('spring');
    expect(planningQuarterForDate('2027-06-30', 2026)).toBe('spring');
    expect(planningQuarterForDate('2027-07-01', 2026)).toBeNull();
    expect(planningQuarterForDate('2027-02-29', 2026)).toBeNull();
    expect(planningQuarterForDate('2026-10-01T00:00:00Z', 2026)).toBeNull();
    expect(planningQuarterForDate('', 2026)).toBeNull();
  });

  it('counts a collaboration once globally and once for each linked host, never for another year', () => {
    const summary = rowsFor([
      event('joint', '2026-10-11', [alpha, beta]),
      event('joint', '2026-10-11', [alpha, beta]), // duplicate returned row
      event('old', '2025-10-12', [old], true, 2025),
      event('wrong-host', '2026-11-02', [old]),
    ]);
    expect(summary.uniqueEventCount).toBe(2);
    expect(summary.rows.filter((row) => row.quarter === 'fall').map((row) => row.pastUnverified)).toEqual([1, 1]);
    expect(summary.hostNeedsReview).toBe(1);
    expect(summary.rows).toHaveLength(6);
  });

  it('keeps draft, scheduled and past-date-unverified separate without claiming completion', () => {
    const summary = rowsFor([
      event('draft-past', '2026-10-01', [alpha], false),
      event('draft-future', '2026-11-12', [alpha], false),
      event('today', '2026-10-28', [alpha]),
      event('scheduled', '2026-12-01', [alpha]),
      event('past', '2026-10-01', [alpha]),
    ]);
    expect(summary.rows[0]).toMatchObject({ quarter: 'fall', drafts: 2, scheduled: 2, pastUnverified: 1 });
    expect(summary.rows[1]).toMatchObject({ quarter: 'winter', drafts: 0, scheduled: 0, pastUnverified: 0 });
  });

  it('flags missing date and missing or stale hosts without silently crediting a House', () => {
    const summary = rowsFor([
      event('missing-date', '', [alpha]),
      event('missing-host', '2026-11-12', []),
      event('summer', '2027-08-01', [alpha]),
      event('stale-host', '2026-11-12', [old]),
    ]);
    expect(summary.dateNeedsReview).toBe(2);
    expect(summary.hostNeedsReview).toBe(2);
    expect(summary.rows.reduce((n, row) => n + row.scheduled + row.drafts + row.pastUnverified, 0)).toBe(0);
  });

  it('exports only aggregate House/quarter counts and escapes spreadsheet formulas', () => {
    const suspicious = house('alpha', 2026, '=bad,"name"');
    const summary = summarizeHouseEventPlanning([event('safe', '2026-11-01', [suspicious])], [suspicious], 2026, today);
    const csv = housePlanningCsv(summary);
    expect(csv).toContain('"\'=bad,""name"""');
    expect(csv).toContain('"2026-2027","fall","0","1","0","1"');
    expect(csv).not.toContain('safe');
    expect(csv).not.toContain('member_id');
    expect(csv).not.toContain('check_in_form_url');
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(4);
  });

  it('does not include a prior-year House in the current-year matrix', () => {
    const summary = summarizeHouseEventPlanning([event('legacy', '2026-10-02', [old])], [old, alpha], 2026, today);
    expect(summary.rows).toHaveLength(3);
    expect(summary.rows.every((row) => row.profileId === alpha.id)).toBe(true);
    expect(summary.hostNeedsReview).toBe(1);
  });
});
