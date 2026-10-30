import { useEffect, useState, useMemo } from 'react';
import { memberIdentityRepository } from '../../data/repos/memberIdentity';
import { identityImportEnabled } from '../../lib/identityRollout';
import { DUPLICATE_REASON_LABEL, DuplicateCandidateMember, DuplicatePair, findDuplicateMembers } from '../../lib/duplicateMembers';
import type { IdentityAlias } from '../../lib/identityResolution';
import type { YearObservation } from '../../lib/yearStanding';
import { EvidenceList } from '../../components/features/admin/AttendanceRowDecision';
import toast, { Toaster } from 'react-hot-toast';
import { usePagination } from '../../hooks/usePagination';
import { PaginationControls } from '../../components/common/PaginationControls';
import { PageTitle } from '../../components/common/PageTitle';

type Member = DuplicateCandidateMember;
type MergePair = DuplicatePair<Member>;

export default function AdminMergeSuggestions() {
  const [members, setMembers] = useState<Member[]>([]);
  const [aliases, setAliases] = useState<IdentityAlias[]>([]);
  const [observations, setObservations] = useState<YearObservation[]>([]);
  const [exclusions, setExclusions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [executingRow, setExecutingRow] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  async function loadData() {
    setLoading(true);
    setLoadError('');
    try {
      // Complete reads or an error: a partial roster would hide real duplicates and show "All clean".
      // Aliases and years exist only once the identity migration is rolled out.
      const identity = identityImportEnabled();
      const [roster, excluded, emails, years] = await Promise.all([
        memberIdentityRepository.loadRoster(),
        memberIdentityRepository.loadMergeExclusions(),
        identity ? memberIdentityRepository.loadIdentityEmails() : Promise.resolve([]),
        identity ? memberIdentityRepository.loadYearObservations() : Promise.resolve([]),
      ]);
      setMembers(roster);
      setAliases(emails);
      setObservations(years);
      // Store pairs symmetrically so A->B or B->A are both recognized
      const exSet = new Set<string>();
      excluded.forEach((row) => {
        exSet.add(`${row.source_id}-${row.target_id}`);
        exSet.add(`${row.target_id}-${row.source_id}`);
      });
      setExclusions(exSet);
    } catch (err: unknown) {
      setMembers([]);
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // ─── Detection Logic ──────────────────────────────────────────────────────────
  // Shared with the attendance importer's name and evidence rules; suggestions only.
  const potentialMatches = useMemo(
    () => findDuplicateMembers(members, aliases, observations, exclusions),
    [members, aliases, observations, exclusions],
  );
  const emailsByMember = useMemo(() => {
    const map = new Map<string, string[]>();
    const add = (id: string, email: string | null) => {
      const value = (email ?? '').trim().toLowerCase();
      if (!value) return;
      const list = map.get(id) ?? [];
      if (!list.includes(value)) map.set(id, [...list, value]);
    };
    members.forEach(m => add(m.id, m.email));
    aliases.forEach(a => add(a.member_id, a.email));
    return map;
  }, [members, aliases]);

  // ─── Pagination ───────────────────────────────────────────────────────────────
  const {
    page, totalPages, rowsPerPage, setRowsPerPage, setCurrentPage,
    pageStartLabel, pageEndLabel,
    paginatedData: paginatedMatches,
  } = usePagination(potentialMatches, { defaultRowsPerPage: 10 });

  // ─── Actions ─────────────────────────────────────────────────────────────────
  async function handleMerge(pair: MergePair) {
    const pairId = `${pair.source.id}-${pair.target.id}`;
    setExecutingRow(pairId);
    try {
      await memberIdentityRepository.mergeMembers(pair.source.id, pair.target.id);
      toast.success('Successfully merged members.');
      await loadData(); // Full refresh ensures we don't try to merge deleted records later
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Merge failed.');
    } finally {
      setExecutingRow(null);
    }
  }

  async function handleIgnore(pair: MergePair) {
    const pairId = `${pair.source.id}-${pair.target.id}`;
    setExecutingRow(pairId);
    try {
      await memberIdentityRepository.ignoreMergePair(pair.source.id, pair.target.id);
      setExclusions(prev => {
        const next = new Set(prev);
        next.add(`${pair.source.id}-${pair.target.id}`);
        next.add(`${pair.target.id}-${pair.source.id}`);
        return next;
      });
      toast.success('Pair ignored.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to ignore pair.');
    } finally {
      setExecutingRow(null);
    }
  }

  // ─── Render Helper ────────────────────────────────────────────────────────────
  const DiffRow = ({ label, targetVal, sourceVal }: { label: string, targetVal: string | null, sourceVal: string | null }) => {
    const hasSourceOnly = !targetVal && sourceVal;

    return (
      <div className="grid grid-cols-12 gap-4 py-2 text-sm border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="col-span-2 font-medium" style={{ color: 'var(--color-text2)' }}>{label}</div>
        <div className={`col-span-5 ${!targetVal ? 'italic' : ''}`} style={{ color: !targetVal ? 'var(--color-text3)' : 'var(--color-text)' }}>
          {targetVal || '—'}
        </div>
        <div className={`col-span-5 ${hasSourceOnly ? 'font-medium' : (!sourceVal ? 'italic' : '')}`} style={{ color: hasSourceOnly ? '#10b981' : (!sourceVal ? 'var(--color-text3)' : 'var(--color-text)') }}>
          {sourceVal || '—'}
          {hasSourceOnly && <span className="ml-2 text-[10px] uppercase border border-emerald-500/40 text-emerald-500 px-1 py-0.5 rounded">Will Fill</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Merge Suggestions" />
      <Toaster position="top-right" />

      <div className="border-b" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Merge Suggestions</h1>
        <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>
          Review and merge likely duplicate member records before they diverge further.
        </p>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="border rounded-md p-6 min-h-[500px]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="mb-6">
            <h2 className="font-sans font-semibold text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>Duplicate Review Queue</h2>
            <p className="mt-1 text-sm max-w-2xl" style={{ color: 'var(--color-text2)' }}>
              Likely duplicates, found by a shared email, the same name and college, or the same name. Nothing merges without you.
              Merging keeps the Target's id, moves attendance (never crediting an event twice), keeps every email so both keep matching on future imports, and fills missing details.
            </p>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text3)' }}>Loading suggestions...</div>
          ) : loadError ? (
            <div role="alert" className="py-16 text-center">
              <h3 className="text-base font-semibold text-text-primary">Suggestions could not be loaded.</h3>
              <p className="mt-1 text-sm text-text-secondary">{loadError}</p>
              <button type="button" onClick={loadData} className="mt-4 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">Try again</button>
            </div>
          ) : potentialMatches.length === 0 ? (
            <div className="py-16 text-center">
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>All clean.</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text2)' }}>No potential duplicates found in your database.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {paginatedMatches.map((pair) => {
                const pairId = `${pair.source.id}-${pair.target.id}`;
                const isWorking = executingRow === pairId;
                
                return (
                  <div
                    key={pairId}
                    className={`border rounded-md overflow-hidden transition-opacity ${isWorking ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
                  >

                    {/* Header */}
                    <div className="px-6 py-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                      <span className="text-xs font-semibold uppercase tracking-label" style={{ color: 'var(--color-text2)' }}>
                        {DUPLICATE_REASON_LABEL[pair.reason]}
                      </span>
                    </div>

                    {/* Columns */}
                    <div className="p-6">
                      <div className="mb-4"><EvidenceList notes={pair.evidence} /></div>
                      <div className="grid grid-cols-12 gap-4 pb-2 text-xs font-semibold uppercase tracking-label" style={{ color: 'var(--color-text2)' }}>
                        <div className="col-span-2">Field</div>
                        <div className="col-span-5 text-brand-600 dark:text-brand-400">Target (Master Record)</div>
                        <div className="col-span-5 text-red-600 dark:text-red-400">Source (merged into target)</div>
                      </div>

                      <DiffRow label="First Name" targetVal={pair.target.first_name} sourceVal={pair.source.first_name} />
                      <DiffRow label="Last Name" targetVal={pair.target.last_name} sourceVal={pair.source.last_name} />
                      <DiffRow label="Contact email" targetVal={pair.target.email} sourceVal={pair.source.email} />
                      <DiffRow label="All emails" targetVal={(emailsByMember.get(pair.target.id) ?? []).join(', ') || null} sourceVal={(emailsByMember.get(pair.source.id) ?? []).join(', ') || null} />
                      <DiffRow label="College" targetVal={pair.target.college} sourceVal={pair.source.college} />
                      <DiffRow label="Year" targetVal={pair.target.year} sourceVal={pair.source.year} />
                      
                      <div className="grid grid-cols-12 gap-4 py-2 text-sm border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="col-span-2 font-medium" style={{ color: 'var(--color-text2)' }}>Points & Events</div>
                        <div className="col-span-5 font-semibold" style={{ color: 'var(--color-text)' }}>
                          {pair.target.points} pts <span className="font-normal ml-1" style={{ color: 'var(--color-text3)' }}>({pair.target.events_attended} events)</span>
                        </div>
                        <div className="col-span-5 text-emerald-500 font-medium">
                          <span className="line-through mr-2" style={{ color: 'var(--color-text)' }}>
                            {pair.source.points} pts <span className="font-normal ml-1" style={{ color: 'var(--color-text3)' }}>({pair.source.events_attended} events)</span>
                          </span>
                          + Will Transfer
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-3 justify-end mt-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <button
                          onClick={() => handleIgnore(pair)}
                          className="px-4 py-2 border rounded text-sm font-medium transition-colors"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}
                        >
                          Ignore / Not Match
                        </button>
                        <button
                          onClick={() => handleMerge(pair)}
                          className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded text-sm font-medium transition-colors"
                        >
                          Confirm Merge
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
              <PaginationControls
                page={page} totalPages={totalPages}
                rowsPerPage={rowsPerPage} onPageChange={setCurrentPage} onRowsPerPageChange={setRowsPerPage}
                pageStartLabel={pageStartLabel} pageEndLabel={pageEndLabel} totalCount={potentialMatches.length}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
