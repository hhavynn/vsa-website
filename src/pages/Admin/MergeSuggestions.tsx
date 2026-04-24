import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { usePagination } from '../../hooks/usePagination';
import { PaginationControls } from '../../components/common/PaginationControls';
import { PageTitle } from '../../components/common/PageTitle';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  email: string | null;
  points: number;
  events_attended: number;
  created_at: string;
}

interface MergePair {
  source: Member;
  target: Member;
  reason: 'Exact Name Match' | 'Exact Email Match';
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function cleanName(raw: string): string {
  let s = raw.trim();
  s = s.replace(/,/g, ' ');
  s = s.replace(/\b[A-Za-z]\.\s*/g, '');
  s = s.replace(/(\b\w{2,})\s+\b[A-Za-z]\b\s+(\w{2,}\b)/g, '$1 $2');
  return s.replace(/\s+/g, ' ').trim();
}

export default function AdminMergeSuggestions() {
  const [members, setMembers] = useState<Member[]>([]);
  const [exclusions, setExclusions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [executingRow, setExecutingRow] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [{ data: mData, error: mErr }, { data: eData, error: eErr }] = await Promise.all([
      supabase.from('members').select('*').order('created_at', { ascending: true }),
      supabase.from('merge_exclusions').select('source_id, target_id')
    ]);

    if (mErr) toast.error('Failed to load members.');
    if (eErr) toast.error('Failed to load exclusions.');

    setMembers((mData ?? []) as Member[]);
    
    // Store pairs symmetrically so A->B or B->A are both recognized
    const exSet = new Set<string>();
    (eData ?? []).forEach((row: any) => {
      exSet.add(`${row.source_id}-${row.target_id}`);
      exSet.add(`${row.target_id}-${row.source_id}`);
    });
    setExclusions(exSet);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  // ─── Detection Logic ──────────────────────────────────────────────────────────
  const potentialMatches = useMemo(() => {
    if (members.length < 2) return [];
    
    // Pre-compute matched values to avoid n^2 string manipulation
    const prep = members.map(m => ({
      m,
      normName: normalizeForMatch(cleanName(`${m.first_name} ${m.last_name}`)),
      normEmail: m.email ? m.email.trim().toLowerCase() : null
    }));

    const pairs: MergePair[] = [];
    // Only compare each pair once
    for (let i = 0; i < prep.length; i++) {
      for (let j = i + 1; j < prep.length; j++) {
        const A = prep[i];
        const B = prep[j];
        
        // Skip ignored pairs
        if (exclusions.has(`${A.m.id}-${B.m.id}`)) continue;

        let reason: MergePair['reason'] | null = null;
        if (A.normEmail && A.normEmail === B.normEmail) {
          reason = 'Exact Email Match';
        } else if (A.normName && A.normName === B.normName) {
          reason = 'Exact Name Match';
        }

        if (reason) {
          // Put the older record as the 'target' and newer as 'source'
          const target = new Date(A.m.created_at) <= new Date(B.m.created_at) ? A.m : B.m;
          const source = target.id === A.m.id ? B.m : A.m;
          pairs.push({ target, source, reason });
        }
      }
    }
    return pairs;
  }, [members, exclusions]);

  // ─── Pagination ───────────────────────────────────────────────────────────────
  const {
    page, totalPages, rowsPerPage, setRowsPerPage, setCurrentPage,
    pageStartLabel, pageEndLabel,
    paginatedData: paginatedMatches,
  } = usePagination(potentialMatches, { defaultRowsPerPage: 10 });

  // ─── Actions ──────────────────────────────────────────────────────────────────
  async function handleMerge(pair: MergePair) {
    const pairId = `${pair.source.id}-${pair.target.id}`;
    setExecutingRow(pairId);
    
    try {
      const { error } = await supabase.rpc('smart_merge_members', {
        p_source_id: pair.source.id,
        p_target_id: pair.target.id
      });
      
      if (error) throw error;
      toast.success('Successfully merged members.');
      await loadData(); // Full refresh ensures we don't try to merge deleted records later
    } catch (err: any) {
      toast.error(err.message || 'Merge failed.');
    } finally {
      setExecutingRow(null);
    }
  }

  async function handleIgnore(pair: MergePair) {
    const pairId = `${pair.source.id}-${pair.target.id}`;
    setExecutingRow(pairId);
    
    try {
      const { error } = await supabase.from('merge_exclusions').insert({
        source_id: pair.source.id,
        target_id: pair.target.id
      });
      
      if (error) throw error;
      
      // Update local state without full refetch
      setExclusions(prev => {
        const next = new Set(prev);
        next.add(`${pair.source.id}-${pair.target.id}`);
        next.add(`${pair.target.id}-${pair.source.id}`);
        return next;
      });
      toast.success('Pair ignored.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to ignore pair.');
    } finally {
      setExecutingRow(null);
    }
  }

  // ─── Render Helper ────────────────────────────────────────────────────────────
  const DiffRow = ({ label, targetVal, sourceVal }: { label: string, targetVal: any, sourceVal: any }) => {
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
    <>
      <PageTitle title="Merge Suggestions" />
      <Toaster position="top-right" />

      <div className="border-b" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-sans font-semibold text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>Merge Suggestions</h1>
        <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>
          Review and merge likely duplicate member records before they diverge further.
        </p>
      </div>

      <div style={{ padding: '20px 28px' }}>
        <div className="border rounded-md p-6 min-h-[500px]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="mb-6">
            <h2 className="font-sans font-semibold text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>Duplicate Review Queue</h2>
            <p className="mt-1 text-sm max-w-2xl" style={{ color: 'var(--color-text2)' }}>
              Clean up your database. The system automatically finds potential duplicates based on names or emails. 
              Merging will transfer attendance and fill in any missing data on the Target member.
            </p>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text3)' }}>Loading suggestions...</div>
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
                        {pair.reason}
                      </span>
                    </div>

                    {/* Columns */}
                    <div className="p-6">
                      <div className="grid grid-cols-12 gap-4 pb-2 text-xs font-semibold uppercase tracking-label" style={{ color: 'var(--color-text2)' }}>
                        <div className="col-span-2">Field</div>
                        <div className="col-span-5 text-brand-600 dark:text-brand-400">Target (Master Record)</div>
                        <div className="col-span-5 text-red-600 dark:text-red-400">Source (To be deleted)</div>
                      </div>

                      <DiffRow label="First Name" targetVal={pair.target.first_name} sourceVal={pair.source.first_name} />
                      <DiffRow label="Last Name" targetVal={pair.target.last_name} sourceVal={pair.source.last_name} />
                      <DiffRow label="Email" targetVal={pair.target.email} sourceVal={pair.source.email} />
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
                theme="zinc"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
