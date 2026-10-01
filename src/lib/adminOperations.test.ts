/**
 * Admin Operations dashboard: counts and statuses derive correctly from raw
 * inputs, the cross-program preflight reads like the spec, and every link the
 * dashboard emits lands on a real admin route.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  OPS_LINKS,
  OperationsInputs,
  buildOperationsPreflight,
  buildOperationsSummary,
  countPreflightIssues,
  formatHouseBalance,
} from './adminOperations';

const healthy: OperationsInputs = {
  yearStart: 2026,
  members: 614,
  ace: { cycleStatus: 'draft', littles: 47, assigned: 42, nodesTotal: 73, nodesLinked: 68 },
  houses: { batchStatus: 'draft', assigned: 126, unresolved: 3, balance: [31, 32, 32, 31] },
  cabinet: { yearLabel: '2026–27', positions: 19, filled: 19, linked: 17, rollover: null },
  interns: { cycleStatus: 'draft', accepted: 12, linked: 10 },
  events: { next: { title: 'GBM 2', date: '2026-10-10T01:00:00Z' }, upcoming: 4, upcomingMissingLocation: 1, upcomingMissingInfo: 1 },
};

describe('buildOperationsSummary', () => {
  const summary = buildOperationsSummary(healthy);

  it('labels the year and counts members', () => {
    expect(summary.yearLabel).toBe('2026–27');
    expect(summary.members).toEqual({ total: 614 });
  });

  it('derives ACE assignment progress and what needs attention', () => {
    expect(summary.ace).toMatchObject({
      cycleStatus: 'draft',
      assigned: 42,
      littles: 47,
      unassigned: 5,
      nodesLinked: 68,
      nodesTotal: 73,
      nodesUnlinked: 5,
      needAttention: 10,
    });
  });

  it('passes House status, counts, and balance through', () => {
    expect(summary.houses).toMatchObject({ batchStatus: 'draft', assigned: 126, unresolved: 3 });
    expect(formatHouseBalance(summary.houses?.balance ?? [])).toBe('31 / 32 / 32 / 31');
  });

  it('derives Cabinet linked and need-review counts', () => {
    expect(summary.cabinet).toMatchObject({ positions: 19, filled: 19, linked: 17, needReview: 2 });
  });

  it('derives intern linked and need-review counts', () => {
    expect(summary.interns).toMatchObject({ accepted: 12, linked: 10, needReview: 2, cycleStatus: 'draft' });
  });

  it('never reports a negative count', () => {
    const odd = buildOperationsSummary({ ...healthy, ace: { cycleStatus: 'draft', littles: 3, assigned: 5, nodesTotal: 2, nodesLinked: 4 } });
    expect(odd.ace).toMatchObject({ unassigned: 0, nodesUnlinked: 0, needAttention: 0 });
  });

  it('keeps a domain that failed to load as unavailable instead of zero', () => {
    const partial = buildOperationsSummary({ ...healthy, ace: null, members: null });
    expect(partial.ace).toBeNull();
    expect(partial.members).toBeNull();
    const groups = buildOperationsPreflight(partial);
    expect(groups.find((g) => g.key === 'ace')?.lines[0]).toMatchObject({ severity: 'warning', message: 'ACE status could not be loaded' });
  });

  it('points the Cabinet card at the rollover while a draft roster is in progress', () => {
    const rolling = buildOperationsSummary({
      ...healthy,
      cabinet: { ...healthy.cabinet!, rollover: { yearLabel: '2027–28', status: 'draft', positions: 19, filled: 15 } },
    });
    expect(rolling.cabinet?.to).toBe(OPS_LINKS.cabinetRollover);
    expect(summary.cabinet?.to).toBe(OPS_LINKS.cabinet);
  });
});

describe('buildOperationsPreflight', () => {
  const groups = buildOperationsPreflight(buildOperationsSummary(healthy));
  const messages = (key: string) => groups.find((g) => g.key === key)?.lines.map((l) => `${l.severity}:${l.message}`);

  it('lists every program in order', () => {
    expect(groups.map((g) => g.key)).toEqual(['ace', 'houses', 'cabinet', 'interns', 'events']);
  });

  it('flags ACE unassigned and unlinked people', () => {
    expect(messages('ace')).toEqual(['warning:5 unassigned', 'warning:5 ACE people not linked to a member']);
  });

  it('reads a locked House batch as ready and unresolved rows as a warning', () => {
    const locked = buildOperationsPreflight(buildOperationsSummary({ ...healthy, houses: { ...healthy.houses!, batchStatus: 'locked', unresolved: 0 } }));
    expect(locked.find((g) => g.key === 'houses')?.lines.map((l) => `${l.severity}:${l.message}`)).toEqual(['ok:Assignment batch locked']);
    expect(messages('houses')).toEqual(['info:Assignment batch is still a draft', 'warning:3 unresolved']);
  });

  it('treats no House batch as intentional, not a problem', () => {
    const none = buildOperationsPreflight(buildOperationsSummary({ ...healthy, houses: { batchStatus: null, assigned: 0, unresolved: 0, balance: [] } }));
    expect(none.find((g) => g.key === 'houses')?.lines[0].severity).toBe('info');
  });

  it('flags Cabinet members who are not linked', () => {
    expect(messages('cabinet')).toEqual(['warning:2 unlinked members']);
  });

  it('is ready for interns once every accepted intern is linked', () => {
    const ready = buildOperationsPreflight(buildOperationsSummary({ ...healthy, interns: { cycleStatus: 'locked', accepted: 12, linked: 12 } }));
    expect(ready.find((g) => g.key === 'interns')?.lines.map((l) => `${l.severity}:${l.message}`)).toEqual(['ok:Ready']);
  });

  it('flags upcoming events missing a location', () => {
    expect(messages('events')).toEqual(['warning:1 upcoming event missing location']);
  });

  it('counts only warnings and blockers as issues', () => {
    // ACE 2, Houses 1, Cabinet 1, Interns 1, Events 1; info lines do not count.
    expect(countPreflightIssues(groups)).toBe(6);
  });

  it('shows an all-clear when nothing needs attention', () => {
    const clean = buildOperationsPreflight(
      buildOperationsSummary({
        ...healthy,
        ace: { cycleStatus: 'published', littles: 47, assigned: 47, nodesTotal: 73, nodesLinked: 73 },
        houses: { batchStatus: 'published', assigned: 126, unresolved: 0, balance: [32, 32, 31, 31] },
        cabinet: { yearLabel: '2026–27', positions: 19, filled: 19, linked: 19, rollover: null },
        interns: { cycleStatus: 'published', accepted: 12, linked: 12 },
        events: { next: null, upcoming: 3, upcomingMissingLocation: 0, upcomingMissingInfo: 0 },
      }),
    );
    expect(countPreflightIssues(clean)).toBe(0);
  });

  it('is diagnostic only: every issue carries a link, none carries a repair', () => {
    groups.flatMap((g) => g.lines).forEach((line) => {
      expect(Object.keys(line).sort()).toEqual(expect.arrayContaining(['id', 'message', 'severity']));
      expect(Object.keys(line).every((key) => ['id', 'severity', 'message', 'to'].includes(key))).toBe(true);
    });
  });
});

describe('preflight links route correctly', () => {
  const routes = readFileSync(join(process.cwd(), 'src/routes/index.tsx'), 'utf8');
  const registered = new Set(Array.from(routes.matchAll(/path="(\/admin[^"]*)"/g), (m) => m[1]));
  registered.add('/admin');

  it('sends every dashboard link to a registered admin route', () => {
    Object.entries(OPS_LINKS).forEach(([name, to]) => {
      const pathname = to.split('?')[0];
      expect({ name, registered: registered.has(pathname) }).toEqual({ name, registered: true });
    });
  });

  it('sends each issue to the tool that fixes it', () => {
    const lines = buildOperationsPreflight(buildOperationsSummary(healthy)).flatMap((g) => g.lines.map((l) => [g.key, l.id, l.to] as const));
    const route = (id: string) => lines.find(([, lineId]) => lineId === id)?.[2];
    expect(route('ace-unassigned')).toBe('/admin/ace?view=assignments');
    expect(route('ace-unlinked')).toBe('/admin/ace');
    expect(route('houses-unresolved')).toBe('/admin/houses');
    expect(route('cabinet-unlinked')).toBe('/admin/cabinet');
    expect(route('interns-unlinked')).toBe('/admin/interns');
    expect(route('events-location')).toBe('/admin/events');
  });

  it('only ever links inside the admin area', () => {
    Object.values(OPS_LINKS).forEach((to) => expect(to.startsWith('/admin')).toBe(true));
  });
});
