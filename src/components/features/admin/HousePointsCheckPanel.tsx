// Protected domain — points / House membership. Admin → Houses → Points check
// (#622). Shows the read-only reconciliation: how this year's attendance
// credits reach the House standings, which outcomes are expected by rule and
// which need investigating, with links to the page that fixes each. It never
// writes and never recalculates points; a failed read is never shown as clean.
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { POINTS_CHECK_UNAVAILABLE, HousePointsCheckSummary, housePointsCheckRepository } from '../../../data/repos/housePointsCheck';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { cn } from '../../../lib/utils';

type Kind = 'expected' | 'investigate';

interface Row {
  key: keyof HousePointsCheckSummary;
  label: string;
  kind: Kind;
  explain: string;
  fix?: { to: string; label: string };
}

const ROWS: Row[] = [
  { key: 'credits_member_has_no_house_this_year', label: 'Credits from members with no House this year', kind: 'expected', explain: 'Individual points count; no House earns them. Expected before the Reveal and for members who did not join a House.', fix: { to: '/admin/houses', label: 'House Assignments' } },
  { key: 'credits_before_house_start', label: 'Credits before the member’s House start date', kind: 'expected', explain: 'Attendance before someone joins a House keeps its individual points and never earns House points retroactively.' },
  { key: 'credits_outside_membership_interval', label: 'Credits outside any House interval (all causes)', kind: 'expected', explain: 'Includes the row above and attendance after a membership ended.' },
  { key: 'credits_event_without_term_near_year', label: 'Credits on events with no academic term', kind: 'investigate', explain: 'They count all-time only, never for a year or a House. Give the event a term.', fix: { to: '/admin/events', label: 'Events' } },
  { key: 'credits_on_inactive_house_profile', label: 'Credits in a House profile that is not active', kind: 'investigate', explain: 'Hidden from standings. Activate the profile or move the membership.', fix: { to: '/admin/houses?tab=images', label: 'Profiles & Images' } },
  { key: 'credits_attributed_to_two_houses', label: 'Credits counted for two Houses', kind: 'investigate', explain: 'Overlapping memberships for one member. Should be impossible; fix the intervals.', fix: { to: '/admin/houses', label: 'House Assignments' } },
  { key: 'overlapping_memberships', label: 'Overlapping memberships', kind: 'investigate', explain: 'One member in two Houses at once.', fix: { to: '/admin/houses', label: 'House Assignments' } },
  { key: 'pacific_vs_utc_boundary_credits', label: 'Evening events on a House start/end date', kind: 'investigate', explain: 'Standings date events in UTC, so an event after about 4–5 PM Pacific counts as the next day. These credits land on the other side of a membership boundary. Changing the rule is a separate owner decision.' },
  { key: 'house_member_vs_house_total_mismatch', label: 'House totals that disagree with their members', kind: 'investigate', explain: 'The two standings views disagree. Report it to the Webmaster; never correct totals by hand.' },
  { key: 'recomputed_vs_view_mismatch', label: 'House totals that disagree with the ledger', kind: 'investigate', explain: 'The standings view disagrees with the check’s own attribution. Report it to the Webmaster.' },
  { key: 'members_transferred_this_year', label: 'Members who changed House this year', kind: 'expected', explain: 'Each House keeps the credits earned while the member was in it.' },
  { key: 'future_dated_memberships', label: 'Memberships that start later', kind: 'expected', explain: 'Their credits count once the start date arrives.' },
];

const labelCls = 'font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted';

export function HousePointsCheckPanel({ selectedYear }: { selectedYear: number | null }) {
  const check = useQuery(
    ['admin', 'house-points-check', selectedYear],
    () => housePointsCheckRepository.getCheck(selectedYear as number),
    { enabled: selectedYear !== null, retry: false, staleTime: 0 },
  );

  if (selectedYear === null) return <p className="p-6 text-sm text-text-muted">Choose an academic year.</p>;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="scrapbook-paper space-y-2 p-5 border-[var(--color-border)] bg-surface" aria-label="House points check">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-text-primary">House points check · {formatAcademicYear(selectedYear)}</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Read-only. Measures how this year&rsquo;s attendance credits reach the House standings. It never changes points; fix the source (an event, a membership) and the standings follow. Private: House standings stay embargoed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => check.refetch()}
            disabled={check.isFetching}
            className="rounded border bg-transparent px-3 py-1.5 text-xs font-semibold hover:bg-[var(--color-surface2)] disabled:opacity-50 border-[var(--color-border)] text-text-primary"
          >
            {check.isFetching ? 'Checking…' : 'Run again'}
          </button>
        </div>
        {check.data && <p className="text-xs text-text-muted" role="status">Checked {new Date(check.data.checkedAt).toLocaleString()}.</p>}
      </section>

      {check.isLoading ? (
        <p className="px-1 text-xs text-text-muted" role="status">Running the check…</p>
      ) : check.isError || !check.data ? (
        <p role="alert" className="rounded border p-3 text-sm border-red-300 text-red-700 dark:border-red-800 dark:text-red-300">
          {check.error instanceof Error && check.error.message === POINTS_CHECK_UNAVAILABLE
            ? POINTS_CHECK_UNAVAILABLE
            : 'The check could not be completed, so nothing is shown rather than a false all-clear. Run it again.'}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Credit totals">
            <div className="rounded border px-3 py-2 border-[var(--color-border)] bg-surface2">
              <dt className={labelCls}>Credits this year</dt>
              <dd className="font-serif text-xl font-bold text-text-primary">{check.data.summary.year_credits}</dd>
            </div>
            <div className="rounded border px-3 py-2 border-[var(--color-border)] bg-surface2">
              <dt className={labelCls}>Earning House points</dt>
              <dd className="font-serif text-xl font-bold text-text-primary">{check.data.summary.credits_earning_house_points}</dd>
            </div>
          </dl>

          <ul className="space-y-2" aria-label="Reconciliation findings">
            {ROWS.map((row) => {
              const value = check.data.summary[row.key];
              const flagged = row.kind === 'investigate' && value > 0;
              return (
                <li key={row.key} className={cn('rounded border p-3 bg-surface2', flagged ? 'border-amber-400 dark:border-amber-700' : 'border-[var(--color-border)]')}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary">{row.label}</p>
                    <p className="font-mono text-sm font-bold text-text-primary">
                      {value}
                      <span className={cn('ml-2 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em]', flagged ? 'border-amber-400 text-amber-800 dark:text-amber-300' : 'border-[var(--color-border)] text-text-muted')}>
                        {flagged ? 'Investigate' : row.kind === 'expected' ? 'Expected' : 'OK'}
                      </span>
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {row.explain}
                    {flagged && row.fix && <> <Link to={row.fix.to} className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline">Open {row.fix.label}</Link>.</>}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <caption className="sr-only">Per-House standings totals and membership rows</caption>
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th scope="col" className={cn(labelCls, 'py-2 pr-3')}>House</th>
                  <th scope="col" className={cn(labelCls, 'py-2 pr-3')}>House total</th>
                  <th scope="col" className={cn(labelCls, 'py-2 pr-3')}>Sum of members</th>
                  <th scope="col" className={cn(labelCls, 'py-2')}>Memberships</th>
                </tr>
              </thead>
              <tbody>
                {check.data.houses.map((house) => (
                  <tr key={house.house_profile_id} className="border-b border-[var(--color-border)] last:border-0">
                    <th scope="row" className="py-2 pr-3 font-semibold text-text-primary">{house.display_name ?? 'House'}</th>
                    <td className="py-2 pr-3 font-mono text-text-secondary">{house.view_house_points ?? 0}</td>
                    <td className={cn('py-2 pr-3 font-mono', (house.view_house_points ?? 0) !== house.view_member_points_sum ? 'font-bold text-amber-800 dark:text-amber-300' : 'text-text-secondary')}>{house.view_member_points_sum}</td>
                    <td className="py-2 font-mono text-text-secondary">{house.membership_rows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
