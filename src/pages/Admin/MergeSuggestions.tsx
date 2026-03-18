import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminNav } from '../../components/features/admin/AdminNav';
import toast, { Toaster } from 'react-hot-toast';

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
      <div className="grid grid-cols-12 gap-4 py-2 text-sm border-t border-gray-100 dark:border-gray-800">
        <div className="col-span-2 text-gray-500 dark:text-gray-400 font-medium">{label}</div>
        <div className={`col-span-5 ${!targetVal ? 'text-gray-400 italic' : 'text-gray-900 dark:text-gray-100'}`}>
          {targetVal || '—'}
        </div>
        <div className={`col-span-5 ${hasSourceOnly ? 'text-green-600 font-medium' : (!sourceVal ? 'text-gray-400 italic' : 'text-gray-900 dark:text-gray-100')}`}>
          {sourceVal || '—'}
          {hasSourceOnly && <span className="ml-2 text-[10px] uppercase bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1 py-0.5 rounded">Will Fill</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <AdminNav />

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 min-h-[500px]">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Merge Suggestions</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm max-w-2xl">
              Clean up your database. The system automatically finds potential duplicates based on names or emails. 
              Merging will transfer attendance and fill in any missing data on the Target member.
            </p>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400">Loading suggestions…</div>
          ) : potentialMatches.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">All clean!</h3>
              <p className="text-gray-500 mt-1">We couldn't find any potential duplicates in your database.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {potentialMatches.map((pair) => {
                const pairId = `${pair.source.id}-${pair.target.id}`;
                const isWorking = executingRow === pairId;
                
                return (
                  <div key={pairId} className={`border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm transition-opacity ${isWorking ? 'opacity-50 pointer-events-none' : ''}`}>
                    
                    {/* Header */}
                    <div className="bg-indigo-50/50 dark:bg-indigo-900/20 px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                        {pair.reason === 'Exact Email Match' ? '✉️' : '📝'} {pair.reason}
                      </span>
                    </div>

                    {/* Columns */}
                    <div className="p-6">
                      <div className="grid grid-cols-12 gap-4 pb-2 text-xs font-semibold uppercase text-gray-400 tracking-wider">
                        <div className="col-span-2">Field</div>
                        <div className="col-span-5 text-indigo-600 dark:text-indigo-400">Target (Master Record)</div>
                        <div className="col-span-5 text-red-600 dark:text-red-400">Source (To be deleted)</div>
                      </div>

                      <DiffRow label="First Name" targetVal={pair.target.first_name} sourceVal={pair.source.first_name} />
                      <DiffRow label="Last Name" targetVal={pair.target.last_name} sourceVal={pair.source.last_name} />
                      <DiffRow label="Email" targetVal={pair.target.email} sourceVal={pair.source.email} />
                      <DiffRow label="College" targetVal={pair.target.college} sourceVal={pair.source.college} />
                      <DiffRow label="Year" targetVal={pair.target.year} sourceVal={pair.source.year} />
                      
                      <div className="grid grid-cols-12 gap-4 py-2 text-sm border-t border-gray-100 dark:border-gray-800">
                        <div className="col-span-2 text-gray-500 dark:text-gray-400 font-medium">Points & Events</div>
                        <div className="col-span-5 text-gray-900 dark:text-gray-100 font-semibold">
                          {pair.target.points} pts <span className="text-gray-400 font-normal ml-1">({pair.target.events_attended} events)</span>
                        </div>
                        <div className="col-span-5 text-green-600 font-medium">
                          <span className="text-gray-900 dark:text-gray-100 line-through mr-2">
                            {pair.source.points} pts <span className="text-gray-400 font-normal ml-1">({pair.source.events_attended} events)</span>
                          </span>
                          + Will Transfer
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button 
                          onClick={() => handleIgnore(pair)}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors"
                        >
                          Ignore / Not Match
                        </button>
                        <button 
                          onClick={() => handleMerge(pair)}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                        >
                          Confirm Merge
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
