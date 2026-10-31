// Admin-only read-only batch review. Never creates membership intervals.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { getCompleteHouseBatchCoverage, getRevealedHouseBatches } from '../../../data/repos/houseAssignmentCoverage';
import { housePaymentsRepository } from '../../../data/repos/housePayments';
import { houseMembershipsWriteRepository } from '../../../data/repos/houseMembershipWrites';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import { houseAssetsRepository } from '../../../data/repos/houseAssets';
import {
  countHouseCoverage, reviewPublishedHouseBatchCoverage, reviewHouseBatchPopulation,
} from '../../../lib/houseAssignmentCoverage';
import { formatAcademicYear, resolveCurrentAcademicYearStart } from '../../../lib/academicTerms';
import { getLosAngelesDateOnly } from '../../../utils/losAngelesDate';

export function HouseAssignmentCoveragePanel({ selectedYear }: { selectedYear: number | null }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [request, setRequest] = useState<{ year: number; batchId: string } | null>(null);
  const [search, setSearch] = useState('');
  const { data: batches = [], isLoading: batchesLoading, error: batchesError } = useQuery({
    queryKey: ['admin', 'house-assignment-coverage', 'batches', selectedYear],
    queryFn: async () => {
      const year = selectedYear as number;
      const [current, released] = await Promise.all([
        houseAssignmentsRepository.listBatches(year),
        getRevealedHouseBatches(year),
      ]);
      const byId = new Map([...current, ...released].map((batch) => [batch.id, batch]));
      return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    enabled: selectedYear !== null, staleTime: 30_000, retry: false,
  });

  const available = batches.filter((batch) => batch.status === 'locked' || !!batch.published_at);
  const active = available.find((batch) => batch.id === chosen) ?? available[0] ?? null;
  const date = selectedYear !== null && selectedYear < resolveCurrentAcademicYearStart(null, new Date())
    ? String(selectedYear + 1) + '-06-30'
    : getLosAngelesDateOnly();
  const enabled = !!request && request.year === selectedYear && request.batchId === active?.id;
  const { data: snapshot, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'house-assignment-coverage', 'population', request?.year, request?.batchId, date],
    enabled, staleTime: 0, retry: false,
    queryFn: async () => {
      const batch = active!;
      const [rows, memberships, directory, houseAssets, applicants] = await Promise.all([
        getCompleteHouseBatchCoverage(batch.id),
        houseMembershipsWriteRepository.listMembershipsForYear(request!.year),
        memberLookupRepository.listMemberDirectory(),
        houseAssetsRepository.getAdminAssets(request!.year),
        batch.payment_cycle_id ? housePaymentsRepository.listApplicants(batch.payment_cycle_id) : Promise.resolve(null),
      ]);
      if (rows.length === 0 && applicants === null) {
        throw new Error('No batch rows or eligible-population roster; coverage is unknown.');
      }
      const profiles = houseAssets.map((p) => ({
        id: p.id, house_key: p.house_key, display_name: p.display_name, is_active: p.is_active,
      }));
      const ids = new Set(directory.map((m) => m.id));
      const revealed = !!batch.published_at;
      const reviewed = revealed
        ? reviewPublishedHouseBatchCoverage(rows, profiles, ids, memberships, date)
        : [];
      const population = applicants === null ? null : reviewHouseBatchPopulation({
        applicants, rows, profiles, memberIds: ids, memberships,
        effectiveStartDate: batch.effective_start_date, onDate: date, revealed,
      });
      return {
        reviewed, population, revealed, counts: countHouseCoverage(reviewed),
        checkedAt: new Date().toISOString(),
      };
    },
  });

  const exceptions = useMemo(() => {
    const items = snapshot?.population
      ? snapshot.population.results.map((item) => ({
          id: item.applicantId, rowId: item.rowId, sourceName: item.sourceName,
          state: item.state, reason: item.reason,
        }))
      : (snapshot?.reviewed ?? []).map((item) => ({
          id: item.row.id, rowId: item.row.id, sourceName: item.row.source_name,
          state: item.state, reason: item.reason,
        }));
    const term = search.trim().toLowerCase();
    return items.filter((item) => !['linked', 'assigned', 'scheduled', 'unassigned'].includes(item.state)
      && (!term || item.sourceName.toLowerCase().includes(term)
        || item.state.includes(term) || item.id.includes(term)));
  }, [snapshot, search]);

  const counters: Array<[string, number]> = snapshot?.population ? [
    ['Eligible', snapshot.population.results.length],
    ['Assigned', snapshot.population.results.filter((x) => x.state === 'assigned').length],
    ['Scheduled', snapshot.population.results.filter((x) => x.state === 'scheduled').length],
    ['Unassigned', snapshot.population.results.filter((x) => x.state === 'unassigned').length],
    ['Ambiguous identity', snapshot.population.results.filter((x) =>
      x.state === 'ambiguous-identity' || x.state === 'duplicate-applicant').length],
    ['Conflicting', snapshot.population.results.filter((x) => x.state === 'conflicting-membership').length],
    ['Needs review', snapshot.population.results.filter((x) =>
      !['assigned', 'scheduled', 'unassigned'].includes(x.state)).length],
    ['Excluded', Object.values(snapshot.population.excluded).reduce((a, b) => a + b, 0)],
  ] : snapshot?.revealed ? [
    ['Batch rows', snapshot.counts.total],
    ['Verified linked', snapshot.counts.linked],
    ['Scheduled', snapshot.counts.scheduled],
    ['Unassigned', snapshot.counts.unassigned],
    ['Needs review', snapshot.counts.needsReview],
  ] : [];

  return (
    <section className="scrapbook-paper mx-4 mb-6 p-5 sm:mx-6" aria-label="Current-year House assignment coverage">
      <h2 className="font-serif text-xl font-bold text-text-primary">House assignment population coverage review</h2>
      <p className="mt-2 max-w-3xl text-sm text-text-secondary">
        Admin-only comparison of a locked or revealed batch with its final Paid/Waived roster,
        complete canonical directory and dated House intervals. No membership is changed and no
        private assignment becomes public from this review.
      </p>
      {batchesError ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
        Cannot load House batches. Coverage is unknown.
      </p> : batchesLoading ? <p role="status" className="mt-3 text-sm">Loading House batches…</p>
        : available.length === 0 ? <p className="mt-3 text-sm text-text-secondary">
          No locked or revealed batch for this academic year. No eligible-population count is claimed.
        </p> : (
          <>
            <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:max-w-md">
                <label htmlFor="house-coverage-batch" className="block text-xs font-semibold text-text-secondary">
                  Locked or revealed batch
                </label>
                <select id="house-coverage-batch" value={active?.id ?? ''}
                  onChange={(e) => { setChosen(e.target.value); setRequest(null); }}
                  className="mt-1 min-h-11 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm">
                  {available.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.source_label || 'Unnamed batch'} · {batch.published_at ? 'Revealed' : 'Private / locked'} · {batch.created_at.slice(0, 10)}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="vsa-btn-primary min-h-11" disabled={!active || isFetching}
                onClick={() => {
                  if (selectedYear === null || !active) return;
                  if (enabled) void refetch();
                  else setRequest({ year: selectedYear, batchId: active.id });
                }}>
                {isFetching ? 'Checking…' : snapshot && enabled ? 'Recheck coverage' : 'Check coverage'}
              </button>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              {selectedYear !== null ? formatAcademicYear(selectedYear) : 'No year'} · membership comparison on {date}
            </p>
            {error && enabled && <p role="alert" className="mt-4 rounded border border-red-500/40 p-3 text-sm text-red-700 dark:text-red-300">
              An applicant, member, batch, profile or membership page failed. Coverage is <strong>unknown</strong>;
              no success or zero-unassigned counts are reported.
            </p>}
            {snapshot && enabled && !error && !isFetching && (
              <div className="mt-5" aria-live="polite">
                {!snapshot.revealed && <p className="mb-3 text-sm text-text-secondary">
                  Private until Reveal. A valid assignment is not yet a published membership.
                </p>}
                {!snapshot.population && <p role="status" className="mb-3 text-sm text-text-secondary">
                  No payment roster for this batch. Eligible population is unknown;
                  {snapshot.revealed ? ' published rows only were reviewed.' : ' no population review is available.'}
                </p>}
                {snapshot.population && <p className="mb-3 text-xs text-text-secondary">
                  {snapshot.population.rowsNotEligible.length} assigned row(s) outside the eligible roster;
                  {' '}{snapshot.population.membershipsOutsideBatch.length} dated membership(s) outside this batch.
                </p>}
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {counters.map(([label, value]) => (
                    <div key={label} className="rounded border border-[var(--color-border)] p-3">
                      <dt className="text-xs text-text-secondary">{label}</dt>
                      <dd className="mt-1 text-xl font-bold text-text-primary">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-text-secondary">
                  Checked {new Date(snapshot.checkedAt).toLocaleString()}. Future intervals are scheduled,
                  not currently assigned. Review mismatches before Lock or any actual Reveal.
                </p>
                <label htmlFor="house-coverage-filter" className="mt-4 block text-xs font-semibold text-text-secondary">
                  Search exceptions ({exceptions.length} shown before list limit)
                </label>
                <input id="house-coverage-filter" type="search" value={search}
                  onChange={(e) => setSearch(e.target.value)} placeholder="Name or status"
                  className="mt-1 min-h-11 w-full max-w-md rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm" />
                {exceptions.length === 0 ? <p className="mt-4 text-sm text-text-secondary">
                  No exceptions in the available coverage inputs.
                </p> : (
                  <ul className="mt-3 space-y-2">
                    {exceptions.slice(0, 100).map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--color-border)] p-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary">{item.sourceName} · {item.state}</p>
                          <p className="text-xs text-text-secondary">{item.reason}</p>
                        </div>
                        <Link className="vsa-btn-secondary min-h-11 text-xs"
                          to={item.rowId
                            ? '/admin/houses?batch=' + encodeURIComponent(active!.id) + '&row=' + encodeURIComponent(item.rowId)
                            : '/admin/houses?tab=payments'}>
                          {item.rowId ? 'Review draft row' : 'Review payment roster'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {exceptions.length > 100 && <p className="mt-3 text-sm text-text-secondary">
                  Showing first 100 of {exceptions.length} exceptions. Refine search to see the remainder.
                </p>}
              </div>
            )}
          </>
        )}
    </section>
  );
}

