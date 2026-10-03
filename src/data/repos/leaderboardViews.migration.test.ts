import * as fs from 'fs';
import * as path from 'path';

/**
 * STATIC TEXT GUARD for the leaderboard SQL views (#293).
 *
 * POINTS SYSTEM COVERED: the LEADERBOARD system (member_event_attendance ->
 * member_yearly_points / house_* views, member_event_history, public_members).
 * Nothing here concerns the check-in system (event_attendance + user_points);
 * the two are not unified. See docs/leaderboard-system.md.
 *
 * WHAT THIS IS NOT: this is NOT behavioural proof of the SQL. It never runs a
 * query. It only reads supabase/migrations/*.sql as text and asserts that the
 * LATEST migration defining each view still contains the key clauses that
 * encode the current point rules, so an accidental redefinition (a stray
 * `create or replace view`, a copy-paste that drops the cutoff, a swapped
 * sum/count) fails in CI. Whether the SQL actually computes the right totals
 * can only be verified against a database.
 *
 * Matching is case- and whitespace-insensitive: comments are stripped, the
 * `public.` schema prefix is dropped, and whitespace around punctuation is
 * collapsed on both the migration text and the expected substrings, so
 * reformatting a view does not break this test. Later migrations that add
 * unrelated SQL (or grants/comments for these views) do not affect it, because
 * only the single defining statement of each view is inspected.
 *
 * These assertions pin what the SQL says TODAY, including asymmetries (see the
 * member_yearly_points block). They are characterization, not endorsement.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', '..', 'supabase', 'migrations');

/** Lower-case, strip comments and `public.`, and collapse whitespace around punctuation. */
function normalize(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .toLowerCase()
    .replace(/\bpublic\./g, '')
    .replace(/\s+/g, ' ')
    .replace(/ ?(::|!=|<>|>=|<=|[(),=<>]) ?/g, '$1')
    .trim();
}

interface ViewDefinition {
  file: string;
  /** Normalized text of the single `create ... view <name> ...;` statement. */
  statement: string;
}

const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const migrationText = new Map(
  migrationFiles.map((file) => [file, fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')] as const)
);

function createViewPattern(view: string): RegExp {
  return new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?(?:(?:materialized|temp|temporary|recursive)\\s+)*view\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?"?${view}"?(?=[\\s(])`,
    'i'
  );
}

function dropViewPattern(view: string): RegExp {
  return new RegExp(`drop\\s+(?:materialized\\s+)?view\\s+(?:if\\s+exists\\s+)?(?:public\\.)?"?${view}"?(?![\\w])`, 'i');
}

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** The latest (by filename) migration that creates `view`, and its defining statement. */
function latestDefinition(view: string): ViewDefinition {
  const pattern = createViewPattern(view);
  for (let i = migrationFiles.length - 1; i >= 0; i -= 1) {
    const file = migrationFiles[i];
    const text = stripComments(migrationText.get(file) ?? '');
    const match = pattern.exec(text);
    if (!match) continue;

    const end = text.indexOf(';', match.index);
    const statement = text.slice(match.index, end === -1 ? undefined : end);
    return { file, statement: normalize(statement) };
  }
  throw new Error(`No migration in supabase/migrations defines view ${view}`);
}

/** Expectation helper: both sides pass through the same normalization. */
function expectDefinitionToContain(definition: ViewDefinition, ...fragments: string[]): void {
  for (const fragment of fragments) {
    expect({ file: definition.file, contains: definition.statement.includes(normalize(fragment)), fragment }).toEqual({
      file: definition.file,
      contains: true,
      fragment,
    });
  }
}

function expectDefinitionNotToContain(definition: ViewDefinition, ...fragments: string[]): void {
  for (const fragment of fragments) {
    expect({ file: definition.file, contains: definition.statement.includes(normalize(fragment)), fragment }).toEqual({
      file: definition.file,
      contains: false,
      fragment,
    });
  }
}

const VIEWS = [
  'member_yearly_points',
  'house_yearly_points',
  'house_all_time_points',
  'house_recent_activity',
  'house_member_yearly_points',
  'house_member_all_time_points',
  'member_event_history',
  'public_members',
] as const;

describe('leaderboard view migrations: harness sanity', () => {
  it('finds migrations on disk', () => {
    expect(migrationFiles.length).toBeGreaterThan(10);
  });

  it('normalization ignores case, comments, schema prefix and spacing', () => {
    expect(normalize('SELECT  Count( * )::int\n  AS Total_Points -- note\nFROM public.members')).toBe(
      normalize('select count(*)::int as total_points from members')
    );
  });

  it.each(VIEWS)('locates a defining migration for %s', (view) => {
    const definition = latestDefinition(view);
    expect(definition.file).toMatch(/^\d+_.+\.sql$/);
    expect(definition.statement.length).toBeGreaterThan(20);
  });

  it.each(VIEWS)('no migration after the latest definition of %s drops it without recreating it', (view) => {
    const defining = latestDefinition(view).file;
    const laterDrops = migrationFiles
      .filter((file) => file > defining)
      .filter((file) => dropViewPattern(view).test(stripComments(migrationText.get(file) ?? '')));
    expect(laterDrops).toEqual([]);
  });
});

describe('member_yearly_points (per-member, per-academic-year totals)', () => {
  const def = latestDefinition('member_yearly_points');

  it('sums points_earned from member_event_attendance, bucketed by academic_term year', () => {
    expectDefinitionToContain(
      def,
      'from members m',
      'join member_event_attendance mea on m.id = mea.member_id',
      'join events e on e.id = mea.event_id',
      'join academic_terms t on t.id = e.academic_term_id',
      'sum(mea.points_earned)::int as total_points',
      'count(distinct mea.event_id)::int as events_attended',
      't.academic_year_start',
      't.academic_year_end',
      'group by'
    );
  });

  it('groups by member and academic year (one row per member per year)', () => {
    const groupBy = def.statement.slice(def.statement.indexOf('group by'));
    expect(groupBy).toContain(normalize('m.id'));
    expect(groupBy).toContain(normalize('t.academic_year_start'));
    expect(groupBy).toContain(normalize('t.academic_year_end'));
  });

  it('does not expose auth user ids or email', () => {
    expectDefinitionNotToContain(def, 'user_id', 'email');
  });

  it('characterization: has no House join, no 2025-11-08 cutoff and no points_earned > 0 filter', () => {
    // Unlike the House views below, the individual yearly view sums every
    // attendance row with a term. Pinned as the current asymmetry.
    expectDefinitionNotToContain(def, 'house_memberships', '2025-11-08', 'points_earned > 0');
  });
});

describe.each([
  ['house_yearly_points'],
  ['house_all_time_points'],
  ['house_recent_activity'],
  ['house_member_yearly_points'],
  ['house_member_all_time_points'],
] as const)('%s (House views share one qualification rule)', (view) => {
  const def = latestDefinition(view);

  it('counts qualifying member-event rows rather than summing points_earned', () => {
    expectDefinitionToContain(def, 'count(*)::int as total_points');
    expectDefinitionNotToContain(def, 'sum(mea.points_earned)');
  });

  it('reads member_event_attendance and buckets by academic_terms via events', () => {
    expectDefinitionToContain(
      def,
      'from member_event_attendance mea',
      'join events e on e.id = mea.event_id',
      'join academic_terms t on t.id = e.academic_term_id',
      't.academic_year_start'
    );
  });

  it('drops members with no House: inner join to house_memberships on member and year, within the effective window', () => {
    expectDefinitionToContain(
      def,
      'join house_memberships hm on hm.member_id = mea.member_id',
      'and hm.academic_year_start = t.academic_year_start',
      'e.date::date >= hm.effective_start_date',
      '(hm.effective_end_date is null or e.date::date < hm.effective_end_date)',
      'join house_page_assets hp on hp.id = hm.house_profile_id'
    );
    expectDefinitionNotToContain(def, 'left join house_memberships', 'right join house_memberships', 'full join house_memberships');
  });

  it('counts only attendance that earned points, in active Houses, with a dated term-assigned event', () => {
    expectDefinitionToContain(
      def,
      'mea.points_earned > 0',
      'hp.is_active = true',
      'e.date is not null',
      'e.academic_term_id is not null'
    );
  });

  it("enforces the 2025-11-08 House Reveal cutoff for academic year 2025 only", () => {
    expectDefinitionToContain(def, "(t.academic_year_start != 2025 or e.date::date >= '2025-11-08')");
  });

  it('does not expose auth user ids or email', () => {
    expectDefinitionNotToContain(def, 'user_id', 'email');
  });
});

describe('house_yearly_points / house_all_time_points: House-level aggregation', () => {
  it.each(['house_yearly_points', 'house_all_time_points'] as const)('%s aggregates per House per academic year', (view) => {
    const def = latestDefinition(view);
    expectDefinitionToContain(
      def,
      'count(*)::int as events_attended',
      'count(distinct mea.event_id)::int as unique_events',
      'count(distinct mea.member_id)::int as unique_members',
      'round(count(*)::numeric / nullif(count(distinct mea.member_id), 0), 2) as average_points_per_member',
      'max(e.date) as latest_activity_at'
    );
    const groupBy = def.statement.slice(def.statement.indexOf('group by'));
    expect(groupBy).toContain(normalize('hp.house_key'));
    expect(groupBy).toContain(normalize('t.academic_year_start'));
    // House level: not grouped per member.
    expect(groupBy).not.toContain(normalize('m.id'));
  });
});

describe('house_recent_activity: per-House, per-event', () => {
  const def = latestDefinition('house_recent_activity');

  it('aggregates per House and event with contributing member count', () => {
    expectDefinitionToContain(def, 'count(distinct mea.member_id)::int as contributing_members', 'max(e.date) as latest_activity_at');
    const groupBy = def.statement.slice(def.statement.indexOf('group by'));
    expect(groupBy).toContain(normalize('e.id'));
    expect(groupBy).toContain(normalize('hp.house_key'));
  });
});

describe('house_member_yearly_points / house_member_all_time_points: per-member House rows', () => {
  it.each(['house_member_yearly_points', 'house_member_all_time_points'] as const)('%s groups per House, member and academic year', (view) => {
    const def = latestDefinition(view);
    expectDefinitionToContain(
      def,
      'join members m on m.id = mea.member_id',
      'm.id as member_id',
      'count(distinct mea.event_id)::int as unique_events',
      'max(e.date) as latest_activity_at'
    );
    const groupBy = def.statement.slice(def.statement.indexOf('group by'));
    expect(groupBy).toContain(normalize('hp.house_key'));
    expect(groupBy).toContain(normalize('m.id'));
    expect(groupBy).toContain(normalize('t.academic_year_start'));
  });
});

describe('member_event_history (public per-member attended events)', () => {
  const def = latestDefinition('member_event_history');

  it('lists only published events', () => {
    expectDefinitionToContain(def, 'where e.is_published = true');
  });

  it('reads member_event_attendance joined to events, with the term optional', () => {
    expectDefinitionToContain(
      def,
      'from member_event_attendance mea',
      'join events e on e.id = mea.event_id',
      'left join academic_terms t on t.id = e.academic_term_id',
      'mea.points_earned',
      't.academic_year_start',
      't.academic_year_end'
    );
  });

  it('exposes no auth ids, emails, check-in codes or import metadata', () => {
    expectDefinitionNotToContain(def, 'user_id', 'email', 'check_in', 'import');
  });
});

describe('public_members (public all-time projection of members)', () => {
  const def = latestDefinition('public_members');

  it('projects exactly the public display columns from members', () => {
    expectDefinitionToContain(def, 'select id, first_name, last_name, college, year, house, points, events_attended from members');
  });

  it('is a security-barrier view and exposes no auth ids or email', () => {
    expectDefinitionToContain(def, 'security_barrier = true');
    expectDefinitionNotToContain(def, 'user_id', 'email');
  });
});
