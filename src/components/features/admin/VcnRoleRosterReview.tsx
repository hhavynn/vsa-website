import { useEffect, useMemo, useState } from 'react';
import { useMemberDirectory } from '../../../hooks/useMemberDirectory';
import { reviewVcnRoleCsv, type VcnReview } from '../../../lib/vcnRoleRosterReview';

/** Private, local-only intake preview. This does not write or publish cast credits. */
export function VcnRoleRosterReview({ editionYear }: { editionYear: number | null }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<VcnReview | null>(null);
  const [failure, setFailure] = useState('');
  const [confirmed, setConfirmed] = useState<ReadonlyMap<number,string>>(new Map());
  const directory = useMemberDirectory(open);
  const members = directory.members;
  const byId = directory.byId;
  // An edition change must invalidate both source rows and confirmed identities.
  useEffect(() => { setCsv(''); setResult(null); setConfirmed(new Map()); setFailure(''); }, [editionYear]);
  const counts = useMemo(() => {
    const rows = result?.rows ?? [];
    return {
      total: rows.length,
      verified: rows.filter(r=>r.verification==='verified' && r.role).length,
      unresolved: rows.filter(r=>r.state!=='ready-for-human-review').length,
      reviewed: rows.filter(r=>confirmed.has(r.sourceLine)).length,
    };
  }, [result,confirmed]);
  const preview = () => {
    setConfirmed(new Map());
    setFailure('');
    setResult(null);
    if (!editionYear) { setFailure('Select an existing VCN edition before reviewing its roster.'); return; }
    if (directory.loading || directory.error) {
      setFailure('Canonical member directory unavailable; cannot evaluate roster identities.');
      return;
    }
    try { setResult(reviewVcnRoleCsv(csv,members)); }
    catch(e) { setFailure(e instanceof Error ? e.message : 'CSV could not be parsed'); }
  };
  return (
    <section className="mx-5 my-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:mx-8" aria-label="VCN role import review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-[var(--color-text)]">VCN cast and crew role review</h2>
          <p className="mt-1 text-xs text-[var(--color-text2)]">Import preview for an existing edition. No file, member links, points, attendance or badges are saved or published.</p>
        </div>
        <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} className="vsa-btn-secondary min-h-11 text-xs">
          {open ? 'Hide roster review' : 'Review roster CSV'}
        </button>
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--color-text2)]">
            Edition: <strong>{editionYear ?? 'No edition selected'}</strong>.
            Paste a committee-approved CSV with columns <code>name,role,status</code> (or <code>verification</code>).
            Only an explicit <code>verified</code> status is considered for identity review.
            Stage Manager and Props Master are never silently mapped to other production roles.
          </p>
          <label htmlFor="vcn-roster-file" className="block text-sm font-semibold text-[var(--color-text)]">Read local CSV / TSV file</label>
          <input id="vcn-roster-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values"
            className="block min-h-11 w-full max-w-md text-sm text-[var(--color-text)]"
            onChange={async e=>{
              const file=e.target.files?.[0]; if(!file)return;
              setResult(null);setConfirmed(new Map());setFailure('');
              if(file.size>500000){setCsv('');setFailure('Roster exceeds 500 KB review limit');return;}
              try{setCsv(await file.text());}
              catch{setCsv('');setFailure('Could not read local roster file');}
            }} />
          <label htmlFor="vcn-roster-text" className="block text-sm font-semibold text-[var(--color-text)]">Private roster CSV or TSV</label>
          <textarea id="vcn-roster-text" value={csv} onChange={e=>{setCsv(e.target.value);setResult(null);setConfirmed(new Map());}}
            placeholder={'name,role,status\nExample Member,VCN Dancer,verified'}
            rows={5} maxLength={500000}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-3 font-mono text-xs text-[var(--color-text)]" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={preview} disabled={!editionYear || directory.loading || !!directory.error || !csv.trim()}
              className="vsa-btn-primary min-h-11">Preview identities</button>
            <button type="button" className="vsa-btn-secondary min-h-11" onClick={()=>{setCsv('');setResult(null);setConfirmed(new Map());setFailure('');}}>Clear private roster</button>
          </div>
          {directory.error && <p role="alert" className="text-sm text-red-600">Member directory read failed. Identity status is unknown, not unmatched.</p>}
          {failure && <p role="alert" className="text-sm text-red-600">{failure}</p>}
          {result && (
            <div className="space-y-3">
              <p role="status" className="text-sm text-[var(--color-text)]">
                {counts.total} rows · {counts.verified} verified status + recognized role ·
                {counts.unresolved} need source or identity review · {counts.reviewed} identity selections (this preview only)
              </p>
              <p className="text-xs text-[var(--color-text2)]">
                A verified CSV status and an exact name match are <strong>not</strong> permission to publish.
                An authorized, versioned edition-role writer and shared public projection (#623) must be separately approved.
                Refreshing this page discards this review; never mistake it for a saved decision.
              </p>
              <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
                {result.rows.slice(0,100).map(row=>(
                  <li key={row.sourceLine} className="rounded border border-[var(--color-border)] p-3 text-sm">
                    <p className="font-semibold text-[var(--color-text)]">Row {row.sourceLine}: {row.name || 'Missing name'} · {(row.role ?? row.originalRole) || 'Unknown role'}</p>
                    <p className="text-xs text-[var(--color-text2)]">CSV status: {row.verification || 'missing'} · {row.state.replaceAll('-',' ')}</p>
                    {row.state === 'ready-for-human-review' || row.state === 'ambiguous-identity' ? (
                      <div className="mt-2">
                        <label className="block text-xs font-semibold text-[var(--color-text2)]" htmlFor={'vcn-link-'+row.sourceLine}>Explicit canonical member selection</label>
                        <select id={'vcn-link-'+row.sourceLine}
                          value={confirmed.get(row.sourceLine) ?? ''}
                          onChange={e=>setConfirmed(current=>{const next=new Map(current);if(e.target.value)next.set(row.sourceLine,e.target.value);else next.delete(row.sourceLine);return next;})}
                          className="mt-1 min-h-11 w-full max-w-md rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-2 text-sm">
                          <option value="">Leave unresolved</option>
                          {row.candidateIds.map(id=><option key={id} value={id}>{byId.get(id)?.displayName ?? 'Unavailable member'}</option>)}
                        </select>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {result.rows.length>100 && <p className="text-xs text-[var(--color-text2)]">Showing 100 of {result.rows.length} rows for review. Narrow the source CSV for additional inspection. No rows are saved.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
