// Admin only. Read-only reconciliation of a published House batch, canonical
// member IDs and actual dated intervals; never a second House assignment writer.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { getCompleteHouseBatchCoverage } from '../../../data/repos/houseAssignmentCoverage';
import { houseMembershipsWriteRepository } from '../../../data/repos/houseMembershipWrites';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import { houseAssetsRepository } from '../../../data/repos/houseAssets';
import { reviewPublishedHouseBatchCoverage, countHouseCoverage } from '../../../lib/houseAssignmentCoverage';
import { formatAcademicYear, resolveCurrentAcademicYearStart } from '../../../lib/academicTerms';
import { getLosAngelesDateOnly } from '../../../utils/losAngelesDate';

export function HouseAssignmentCoveragePanel({ selectedYear }: { selectedYear: number | null }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [request, setRequest] = useState<{year:number;batchId:string}|null>(null);
  const [search, setSearch] = useState('');
  const { data: batches = [], isLoading: batchesLoading, error: batchesError } = useQuery({
    queryKey: ['admin', 'house-assignment-coverage', 'batches', selectedYear],
    queryFn: () => houseAssignmentsRepository.listBatches(selectedYear as number),
    enabled: selectedYear !== null,
    staleTime: 30_000,
    retry: false,
  });
  const published = batches.filter(b=>b.status==='published');
  const active = published.find(b=>b.id===chosen) ?? published[0] ?? null;
  const date = selectedYear != null && selectedYear < resolveCurrentAcademicYearStart(null,new Date())
    ? String(selectedYear+1) + '-06-30' : getLosAngelesDateOnly();
  const enabled = !!request && request.year===selectedYear && request.batchId===active?.id;
  const { data: snapshot, isFetching, error, refetch } = useQuery({
    queryKey: ['admin','house-assignment-coverage','snapshot',request?.year,request?.batchId,date],
    enabled,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const year=request!.year;
      const [rows, memberships, directory, profiles] = await Promise.all([
        getCompleteHouseBatchCoverage(request!.batchId),
        houseMembershipsWriteRepository.listMembershipsForYear(year),
        memberLookupRepository.listMemberDirectory(),
        houseAssetsRepository.getAdminAssets(year),
      ]);
      if (rows.length===0) throw new Error('Published batch has no assignment rows; cannot report zero missing members.');
      const reviewed=reviewPublishedHouseBatchCoverage(rows,
        profiles.map(p=>({id:p.id,house_key:p.house_key,display_name:p.display_name,is_active:p.is_active})),
        new Set(directory.map(m=>m.id)),memberships,date);
      return { reviewed, counts: countHouseCoverage(reviewed), checkedAt: new Date().toISOString() };
    },
  });
  const visible = useMemo(() => {
    const term=search.toLowerCase().trim();
    return (snapshot?.reviewed ?? []).filter(row=>
      row.state!=='linked' &&
      (!term || row.row.source_name.toLowerCase().includes(term) || row.state.includes(term) || row.row.id.includes(term))
    );
  },[snapshot,search]);
  return (
    <section className="scrapbook-paper mx-4 mb-6 p-5 sm:mx-6" aria-label="Current-year House assignment coverage">
      <h2 className="font-serif text-xl font-bold text-text-primary">Published assignment coverage review</h2>
      <p className="mt-2 max-w-3xl text-sm text-text-secondary">
        Admin-only comparison of the selected published batch against the complete canonical member directory
        and dated House membership intervals. This checks <strong>published batch rows</strong>, not every
        potentially eligible member. Draft names and last year's cached House do not count as assignments.
        No memberships are changed by this check.
      </p>
      {batchesError ? <p role="alert" className="mt-3 text-sm text-red-600">Cannot load published House batches. Coverage is unknown.</p>
        : batchesLoading ? <p role="status" className="mt-3 text-sm">Loading published batches…</p>
        : published.length===0 ? <p className="mt-3 text-sm text-text-secondary">No published batch for this academic year. Assignments are still unrevealed or no batch exists; no member coverage is claimed.</p>
        : (
          <>
            <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:max-w-md">
                <label htmlFor="house-coverage-batch" className="block text-xs font-semibold text-text-secondary">Published batch</label>
                <select id="house-coverage-batch" value={active?.id??''} onChange={e=>{setChosen(e.target.value);setRequest(null);}}
                  className="mt-1 min-h-11 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm">
                  {published.map(b=><option key={b.id} value={b.id}>{b.source_label||'Unnamed batch'} · {b.created_at.slice(0,10)}</option>)}
                </select>
              </div>
              <button type="button" className="vsa-btn-primary min-h-11" disabled={!active||isFetching}
                onClick={()=>{ if(!selectedYear||!active)return;
                  if(enabled) void refetch();
                  else setRequest({year:selectedYear,batchId:active.id});
                }}>
                {isFetching?'Checking…': snapshot && enabled?'Recheck coverage':'Check coverage'}
              </button>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              {selectedYear!=null?formatAcademicYear(selectedYear):'No year'} · membership comparison on {date}
            </p>
            {error && enabled && <p role="alert" className="mt-4 rounded border border-red-500/40 p-3 text-sm text-red-600">
              A batch, member, House profile or membership page failed. Coverage is <strong>unknown</strong>;
              no zero-unassigned or success counts are reported.
            </p>}
            {snapshot && enabled && !error && !isFetching && (
              <div className="mt-5" aria-live="polite">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Batch rows',snapshot.counts.total],
                    ['Verified linked',snapshot.counts.linked],
                    ['Scheduled',snapshot.counts.scheduled],
                    ['Needs review',snapshot.counts.needsReview],
                  ].map(([label,value])=><div key={label} className="rounded border border-[var(--color-border)] p-3">
                    <dt className="text-xs text-text-secondary">{label}</dt>
                    <dd className="mt-1 text-xl font-bold text-text-primary">{value}</dd>
                  </div>)}
                </dl>
                <p className="mt-3 text-xs text-text-secondary">
                  Checked {new Date(snapshot.checkedAt).toLocaleString()}. Scheduled intervals are not marked
                  as currently assigned. Overlaps, duplicate IDs and wrong-year/inactive House profiles need manual review.
                </p>
                <div className="mt-4">
                  <label htmlFor="house-coverage-filter" className="block text-xs font-semibold text-text-secondary">
                    Search exceptions ({visible.length} shown before list limit)
                  </label>
                  <input id="house-coverage-filter" type="search" value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Name or status" className="mt-1 min-h-11 w-full max-w-md rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm" />
                </div>
                {visible.length===0 ? <p className="mt-4 text-sm text-text-secondary">No exceptions in this published batch.</p> : (
                  <ul className="mt-3 space-y-2">
                    {visible.slice(0,100).map(item=><li key={item.row.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--color-border)] p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary">{item.row.source_name} · {item.state}</p>
                        <p className="text-xs text-text-secondary">{item.reason}</p>
                      </div>
                      <Link className="vsa-btn-secondary min-h-11 text-xs"
                        to={'/admin/houses?batch='+encodeURIComponent(active!.id)+'&row='+encodeURIComponent(item.row.id)}>
                        Review draft row
                      </Link>
                    </li>)}
                  </ul>
                )}
                {visible.length>100 && <p className="mt-3 text-sm text-text-secondary">
                  Showing first 100 of {visible.length} exceptions. Refine search to inspect the rest.
                </p>}
              </div>
            )}
          </>
        )}
    </section>
  );
}
