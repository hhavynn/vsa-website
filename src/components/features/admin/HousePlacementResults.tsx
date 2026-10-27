// Protected domain — House membership. Stage D of automatic House placement:
// a read-only preview of what the allocator decided and why. Nothing here
// writes anywhere; exports download to the admin's device only.
import { useMemo, useState } from 'react';
import { ordinal } from '../../../lib/housePlacement';
import type { PlacementHouse } from '../../../lib/housePlacement';
import type { ApplicantMemberMatch } from '../../../lib/housePlacementImport';
import type { PlacementExportRow } from '../../../lib/housePlacementExport';
import { HousePlacementExportPanel } from './HousePlacementExportPanel';

export interface PlacementPreviewRow {
  id: string;
  priority: number;
  name: string;
  /** Row in the Google Form responses sheet. */
  sourceRow: number;
  submitted: string;
  /** UTC ISO submission instant. */
  submittedIso: string | null;
  /** House labels, first choice first. */
  preferences: string[];
  houseId: string;
  houseLabel: string;
  achievedRank: number;
  explanation: string;
  corrected: boolean;
  match: ApplicantMemberMatch;
}

export interface HousePlacementResultsProps {
  rows: PlacementPreviewRow[];
  houses: PlacementHouse[];
  capacities: Readonly<Record<string, number>>;
  rankCounts: number[];
  academicYearStart: number;
  memberName?: (memberId: string) => string | null;
}

const selectCls =
  'rounded border bg-[var(--color-surface2)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]';
const headCls = 'px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em]';

function matchLabel(match: ApplicantMemberMatch) {
  if (match.status === 'match') return 'Matched';
  if (match.status === 'review') return 'Needs review';
  return 'Unmatched';
}

function matchTone(match: ApplicantMemberMatch) {
  if (match.status === 'match') return 'text-emerald-700 dark:text-emerald-400';
  if (match.status === 'review') return 'text-amber-700 dark:text-amber-400';
  return 'text-zinc-500 dark:text-zinc-400';
}

export function previewExportRows(rows: readonly PlacementPreviewRow[], memberName: (memberId: string) => string | null = () => null): PlacementExportRow[] {
  return rows.map((row) => ({
    priority: row.priority,
    sheetRow: row.sourceRow,
    applicantName: row.name,
    linkedMember: row.match.memberId ? memberName(row.match.memberId) ?? '' : '',
    submittedPacific: row.submitted,
    submittedUtc: row.submittedIso ?? '',
    preferences: row.preferences,
    generatedHouseId: row.houseId,
    generatedHouse: row.houseLabel,
    houseId: row.houseId,
    house: row.houseLabel,
    achievedRank: row.achievedRank,
    placement: 'Automatic',
    overrideReason: '',
    memberMatch: matchLabel(row.match),
    reviewReasons: [
      row.match.status === 'review' ? 'Member match needs review' : null,
      row.match.status === 'unmatched' ? 'No linked member' : null,
      row.corrected ? 'Ranking corrected by an admin' : null,
    ].filter((reason): reason is string => !!reason),
    draftRowId: '',
  }));
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border px-3 py-2 border-[var(--color-border)] bg-surface2">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className="mt-0.5 font-serif text-xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

export function HousePlacementResults({ rows, houses, capacities, rankCounts, academicYearStart, memberName }: HousePlacementResultsProps) {
  const [search, setSearch] = useState('');
  const [houseFilter, setHouseFilter] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('');

  const counts = useMemo(() => {
    const perHouse = new Map<string, number>();
    rows.forEach((row) => perHouse.set(row.houseId, (perHouse.get(row.houseId) ?? 0) + 1));
    return perHouse;
  }, [rows]);
  const needsMember = rows.filter((row) => row.match.status !== 'match').length;
  const term = search.trim().toLowerCase();
  const visible = rows.filter((row) =>
    (!houseFilter || row.houseId === houseFilter)
    && (!rankFilter || String(row.achievedRank) === rankFilter)
    && (!matchFilter || (matchFilter === 'corrected' ? row.corrected : row.match.status === matchFilter))
    && (!term || row.name.toLowerCase().includes(term)));
  const exportRows = useMemo(() => previewExportRows(rows, memberName), [rows, memberName]);

  return (
    <section className="scrapbook-paper overflow-hidden border-[var(--color-border)] bg-surface" aria-label="Placement results">
      <div className="border-b px-5 py-4 border-[var(--color-border)]">
        <h3 className="font-serif text-lg font-bold text-text-primary">Placement preview</h3>
        <p className="mt-1 text-xs text-text-muted">
          First-come, first-served: each applicant, in submission order, took their highest-ranked House with room. Nothing is saved yet.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <SummaryCard label="Applicants" value={rows.length} />
          <SummaryCard label="Assigned" value={rows.length} />
          {rankCounts.map((count, index) => (
            <SummaryCard key={index} label={`${ordinal(index + 1)} choice`} value={count} />
          ))}
          <SummaryCard label="Member review" value={needsMember} />
        </div>
        <div className="mt-4 space-y-2">
          {houses.map((house) => {
            const count = counts.get(house.id) ?? 0;
            const capacity = capacities[house.id] ?? 0;
            const percent = capacity > 0 ? Math.min(100, Math.round((count / capacity) * 100)) : 0;
            return (
              <div key={house.id} data-testid={`placement-capacity-${house.label}`}>
                <div className="flex justify-between text-xs text-text-secondary">
                  <span className="font-semibold text-text-primary">{house.label}</span>
                  <span className="font-mono">{count} / {capacity}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded bg-[var(--color-surface2)]" role="progressbar" aria-label={`${house.label} filled`} aria-valuenow={count} aria-valuemin={0} aria-valuemax={capacity}>
                  <div className="h-full bg-brand-600 dark:bg-brand-400" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <HousePlacementExportPanel rows={exportRows} houses={houses} academicYearStart={academicYearStart} preview />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3 border-[var(--color-border)]">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search applicants…"
          aria-label="Search applicants"
          className="rounded border px-2 py-1.5 text-xs border-[var(--color-border)] bg-surface2 text-text-primary"
        />
        <select value={houseFilter} onChange={(event) => setHouseFilter(event.target.value)} aria-label="Filter by assigned House" className={`${selectCls} border-[var(--color-border)]`}>
          <option value="">All Houses</option>
          {houses.map((house) => <option key={house.id} value={house.id}>{house.label}</option>)}
        </select>
        <select value={rankFilter} onChange={(event) => setRankFilter(event.target.value)} aria-label="Filter by achieved choice" className={`${selectCls} border-[var(--color-border)]`}>
          <option value="">Any choice</option>
          {rankCounts.map((_, index) => <option key={index} value={String(index + 1)}>{`${ordinal(index + 1)} choice`}</option>)}
        </select>
        <select value={matchFilter} onChange={(event) => setMatchFilter(event.target.value)} aria-label="Filter by member match" className={`${selectCls} border-[var(--color-border)]`}>
          <option value="">Any member match</option>
          <option value="match">Matched</option>
          <option value="review">Needs review</option>
          <option value="unmatched">Unmatched</option>
          <option value="corrected">Ranking corrected</option>
        </select>
        <span className="text-xs text-text-muted">{visible.length} of {rows.length}</span>
      </div>

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="border-b bg-[var(--color-surface2)] border-[var(--color-border)]">
              {['Priority', 'Name', 'Submitted', ...rankCounts.map((_, index) => ordinal(index + 1)), 'Assigned House', 'Result', 'Member match'].map((heading) => (
                <th key={heading} className={`${headCls} text-text-muted`}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y border-[var(--color-border)]">
            {visible.map((row) => (
              <tr key={row.id} data-testid="placement-result-row" className="align-top">
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">#{row.priority}</td>
                <td className="px-3 py-2">
                  <p className="text-[13px] font-semibold text-text-primary">{row.name}</p>
                  <p className="mt-0.5 text-[11px] text-text-muted">{row.explanation}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-text-secondary">{row.submitted}</td>
                {rankCounts.map((_, index) => (
                  <td key={index} className={`px-3 py-2 text-xs ${index + 1 === row.achievedRank ? 'font-bold text-text-primary' : 'text-text-muted'}`}>
                    {row.preferences[index] ?? '—'}
                  </td>
                ))}
                <td className="px-3 py-2 text-xs font-semibold text-text-primary">{row.houseLabel}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-text-secondary">{ordinal(row.achievedRank)}</td>
                <td className="px-3 py-2 text-[11px]">
                  <p className={`font-mono font-bold uppercase ${matchTone(row.match)}`}>{matchLabel(row.match)}</p>
                  <p className="mt-0.5 text-text-muted">{row.match.note}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
