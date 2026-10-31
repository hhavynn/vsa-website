// Protected domain — House membership / points. Admin → Houses → Overview
// (#651): the private live House scoreboard for CRC. One card per House of the
// year (roster, participation, private standing, what needs a look) plus a
// comparison table. Read-only; every number comes from admin_house_overview or
// the attendance status read (#653). Never shown publicly (#692).
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HOUSE_OVERVIEW_UNAVAILABLE, HouseOverviewHouse, houseOverviewRepository } from '../../../data/repos/houseOverview';
import { HouseRosterPanel } from './HouseRosterPanel';
import { attendanceReadinessRepository } from '../../../data/repos/attendanceReadiness';
import { useAcademicTerms } from '../../../hooks/useAcademicTerms';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { isQualifying, summarize } from '../../../lib/attendanceReadiness';
import { cn } from '../../../lib/utils';

const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted';
const linkCls = 'font-semibold text-[var(--brand)] underline-offset-2 hover:underline';

function laDate(value: string | null | undefined) {
  if (!value) return 'none yet';
  return new Date(value).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' });
}

/** Never rounds up to 100% or down to 0% while that is not exactly true. */
function percent(part: number, whole: number) {
  if (whole <= 0) return '—';
  if (part === whole) return '100%';
  const value = Math.floor((part / whole) * 100);
  return part > 0 && value === 0 ? '<1%' : `${value}%`;
}

function attention(house: HouseOverviewHouse): string[] {
  const items: string[] = [];
  if (!house.is_active && house.roster_members > 0) items.push(`Profile not public yet, so its ${house.roster_members} members earn no House points.`);
  const idle = house.roster_members - house.participating_members;
  if (house.is_active && idle > 0) items.push(`${idle} member${idle === 1 ? ' has' : 's have'} no House-credited attendance in this period.`);
  if (house.parents_listed === 0) items.push('No House Parents listed.');
  else if (house.parents_linked < house.parents_listed) items.push(`${house.parents_listed - house.parents_linked} House Parent${house.parents_listed - house.parents_linked === 1 ? ' is' : 's are'} not linked to a member.`);
  if (house.overlapping_members > 0) items.push(`${house.overlapping_members} member${house.overlapping_members === 1 ? ' has' : 's have'} overlapping House memberships this year (two Houses, or the same House twice).`);
  if (house.matches_view === false) items.push('Its credits disagree with the standings view.');
  return items;
}

export function HouseOverviewPanel({ selectedYear }: { selectedYear: number | null }) {
  const { terms } = useAcademicTerms();
  const yearTerms = useMemo(() => terms.filter((term) => term.academic_year_start === selectedYear), [terms, selectedYear]);
  const [termId, setTermId] = useState<string | null>(null);
  // The open roster is an id in the URL (never a name), so it can be linked.
  const [searchParams, setSearchParams] = useSearchParams();
  const openHouseId = searchParams.get('house');
  const setOpenHouse = (id: string | null) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (id) next.set('house', id); else next.delete('house');
    return next;
  });

  const overview = useQuery({
    queryKey: ['admin', 'house-overview', selectedYear, termId],
    queryFn: () => houseOverviewRepository.getOverview(selectedYear as number, termId),
    enabled: selectedYear !== null,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  // Shares the Attendance status tab's cache (same key).
  const readiness = useQuery({
    queryKey: ['admin', 'attendance-readiness', selectedYear, termId],
    queryFn: () => attendanceReadinessRepository.getReadiness(selectedYear as number, termId),
    enabled: selectedYear !== null,
    retry: false,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const outstanding = useMemo(() => {
    // A cut-off read cannot vouch for every event.
    if (!readiness.data || readiness.data.truncated) return null;
    const qualifying = readiness.data.events.filter(isQualifying);
    return summarize(qualifying, new Date(readiness.data.checkedAt)).outstanding;
  }, [readiness.data]);

  if (selectedYear === null) return <p className="p-6 text-sm text-text-muted">Choose an academic year.</p>;
  const houses = overview.data?.houses ?? [];
  const period = overview.data?.window.termLabel ?? formatAcademicYear(selectedYear);

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <section className="scrapbook-paper space-y-3 p-5 border-[var(--color-border)] bg-surface" aria-label="House overview">
        <div>
          <h2 className="font-serif text-xl font-bold text-text-primary">House overview · {formatAcademicYear(selectedYear)}</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Private live scoreboard for CRC and admins. House standings are embargoed: never share these numbers publicly or as an announced result. House points count only qualifying attendance after each member&rsquo;s House start date.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="overview-term" className={labelCls}>Period</label>
            <select id="overview-term" value={termId ?? ''} onChange={(event) => setTermId(event.target.value || null)} className="mt-1 min-h-[36px] rounded border px-2 py-1 text-sm bg-[var(--color-surface2)] border-[var(--color-border)] text-text-primary">
              <option value="">Whole year</option>
              {yearTerms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => { overview.refetch(); readiness.refetch(); }} disabled={overview.isFetching} className="min-h-[36px] rounded border bg-transparent px-3 py-1 text-xs font-semibold border-[var(--color-border)] text-text-primary hover:bg-[var(--color-surface2)] disabled:opacity-50">
            {overview.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </section>

      <div role="status" className={cn('rounded border p-3 text-sm', outstanding ? 'border-amber-400 dark:border-amber-700' : 'border-[var(--color-border)]', 'bg-surface2')}>
        {readiness.isLoading ? 'Checking event imports…'
          : readiness.isError || outstanding === null ? <>Event import status could not be checked, so these numbers may be missing recent events. <Link to="/admin/houses?tab=attendance" className={linkCls}>Open Attendance status</Link>.</>
          : outstanding > 0 ? <>{outstanding} past point-earning event{outstanding === 1 ? ' is' : 's are'} not fully imported or checked, so the numbers below may be low. <Link to="/admin/houses?tab=attendance" className={linkCls}>Open Attendance status</Link>.</>
          : 'Every past point-earning event in this period is imported or accounted for.'}
      </div>

      {overview.isLoading ? (
        <p className="px-1 text-xs text-text-muted" role="status">Loading the overview…</p>
      ) : overview.isError || !overview.data ? (
        <p role="alert" className="rounded border p-3 text-sm border-red-300 text-red-700 dark:border-red-800 dark:text-red-300">
          {overview.error instanceof Error && overview.error.message === HOUSE_OVERVIEW_UNAVAILABLE
            ? HOUSE_OVERVIEW_UNAVAILABLE
            : 'The overview could not be loaded. Nothing is shown rather than zeros that are not real. Refresh to try again.'}
        </p>
      ) : houses.length === 0 ? (
        <p className="rounded border p-4 text-sm text-text-secondary border-[var(--color-border)]">
          No House profiles for {formatAcademicYear(selectedYear)} yet. Create them in <Link to="/admin/houses?tab=images" className={linkCls}>Profiles &amp; Images</Link>.
        </p>
      ) : (
        <>
          {!overview.data.window.dated && (
            <p role="note" className="rounded border p-3 text-xs border-amber-400 text-amber-800 dark:border-amber-700 dark:text-amber-300">
              {overview.data.window.termLabel} has no start and end dates, so members and House events below cover the whole year; credits count only that term&rsquo;s events. Add the dates in Years &amp; Terms for a true term view.
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Houses">
            {houses.map((house) => {
              const items = attention(house);
              return (
                <li key={house.house_profile_id} className="scrapbook-paper space-y-2 p-4 border-[var(--color-border)] bg-surface">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-serif text-lg font-bold text-text-primary">{house.display_name}</h3>
                    <span className="font-mono text-xs text-text-muted">
                      {house.is_active ? (house.rank ? `Rank ${house.rank} · ${house.year_total_points} pts this year` : 'No House points this year') : 'Profile not public'}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-text-muted">Members ({period})</dt>
                    <dd className="text-right font-mono text-text-primary">{house.roster_members}{house.joined_in_window ? ` (${house.joined_in_window} new)` : ''}</dd>
                    <dt className="text-text-muted">Attended at least once</dt>
                    <dd className="text-right font-mono text-text-primary">{house.participating_members} · {percent(house.participating_members, house.roster_members)}</dd>
                    <dt className="text-text-muted">House-credited attendance</dt>
                    <dd className="text-right font-mono text-text-primary">{house.credited_attendance}</dd>
                    <dt className="text-text-muted">Latest credited activity</dt>
                    <dd className="text-right font-mono text-text-primary">{laDate(house.window_latest_activity_at)}</dd>
                    <dt className="text-text-muted">House Parents linked</dt>
                    <dd className="text-right font-mono text-text-primary">{house.parents_linked} of {house.parents_listed}</dd>
                    <dt className="text-text-muted">House events hosted</dt>
                    <dd className="text-right font-mono text-text-primary">{house.hosted_events}</dd>
                  </dl>
                  <button
                    type="button"
                    aria-expanded={openHouseId === house.house_profile_id}
                    aria-controls={`house-roster-${house.house_profile_id}`}
                    onClick={() => setOpenHouse(openHouseId === house.house_profile_id ? null : house.house_profile_id)}
                    className="min-h-[36px] touch:min-h-11 rounded border bg-transparent px-2.5 py-1 text-xs font-semibold border-[var(--color-border)] text-text-primary hover:bg-[var(--color-surface2)]"
                  >
                    {openHouseId === house.house_profile_id ? 'Hide roster' : 'Open roster'}<span className="sr-only"> for {house.display_name}</span>
                  </button>
                  {items.length > 0 ? (
                    <ul className="space-y-0.5 text-xs text-amber-800 dark:text-amber-300" aria-label={`Needs attention: ${house.display_name}`}>
                      {items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p className="text-xs text-text-muted">Nothing needs attention.</p>
                  )}
                </li>
              );
            })}
          </ul>

          {openHouseId && (houses.some((house) => house.house_profile_id === openHouseId) ? (
            // A new House or period starts a fresh roster (filters, open rows, invitation list).
            <HouseRosterPanel key={`${openHouseId}:${termId ?? 'year'}`} houseProfileId={openHouseId} termId={termId} onClose={() => setOpenHouse(null)} />
          ) : (
            <p role="status" className="text-xs text-text-muted">The linked House is not one of this year&rsquo;s Houses. <button type="button" className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline" onClick={() => setOpenHouse(null)}>Clear it</button>.</p>
          ))}

          <div className="overflow-x-auto rounded border border-[var(--color-border)] bg-surface">
            <table className="w-full min-w-[560px] text-left text-xs">
              <caption className="px-3 pt-3 text-left text-xs text-text-secondary">
                Compared for {period}. &ldquo;Attended&rdquo; is out of the House&rsquo;s members in that period. Rank and points are the whole year, from the standings view.
              </caption>
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['House', 'Members', 'Attended', 'Credits', 'Year points', 'Rank', 'Events hosted'].map((head) => (
                    <th key={head} scope="col" className={cn(labelCls, 'px-3 py-2')}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {houses.map((house) => (
                  <tr key={house.house_profile_id} className="border-b border-[var(--color-border)] last:border-0">
                    <th scope="row" className="px-3 py-2 font-semibold text-text-primary">{house.display_name}{house.is_active ? '' : ' (not public)'}</th>
                    <td className="px-3 py-2 font-mono">{house.roster_members}</td>
                    <td className="px-3 py-2 font-mono">{house.participating_members} ({percent(house.participating_members, house.roster_members)})</td>
                    <td className="px-3 py-2 font-mono">{house.credited_attendance}</td>
                    <td className="px-3 py-2 font-mono">{house.year_total_points ?? 0}</td>
                    <td className="px-3 py-2 font-mono">{house.rank ?? '—'}</td>
                    <td className="px-3 py-2 font-mono">{house.hosted_events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-text-muted">
            {overview.data.distinctHouseEvents} published House event{overview.data.distinctHouseEvents === 1 ? '' : 's'} in this period (a collab counts once here, and once for each host above). Attendance at House events is not tracked and earns no points.
            {' '}Checked {new Date(overview.data.checkedAt).toLocaleString()}.
          </p>
          <nav aria-label="House tools" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link to="/admin/houses?tab=attendance" className={linkCls}>Attendance status</Link>
            <Link to="/admin/houses?tab=points" className={linkCls}>Points check</Link>
            <Link to="/admin/houses?tab=events" className={linkCls}>House events</Link>
            <Link to="/admin/houses" className={linkCls}>House assignments</Link>
          </nav>
        </>
      )}
    </div>
  );
}
