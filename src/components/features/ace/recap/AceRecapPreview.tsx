import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import type { AceRecapSnapshot, RecapFamily, RecapReviewRecord } from '../../../../lib/aceRecap/recapSnapshot';
import { layoutTree } from '../../../../lib/aceTreeLayout';
import type { TreeNode } from '../../../../lib/aceTreeLayout';
import { accentFromThemeColor } from '../../../../lib/aceFamilyAdapter';
import { FamilyTree } from '../FamilyTree';
import { usePannableTree } from '../usePannableTree';
import { AceRecapPlayer } from './AceRecapPlayer';
import { displayFamilyName } from './RecapStage';

/**
 * PRIVATE review surface for a recap snapshot: before/after trees per family,
 * the Chair's review queue and the recap player. It takes the snapshot as a
 * prop and fetches nothing, so it can only show data the reviewer already
 * holds locally. Never route this into the public site.
 */

const STATUS_LABEL: Record<string, string> = {
  resolved_exact: 'Exact match',
  resolved_variant: 'Middle-name variant',
  ambiguous: 'Ambiguous — several nodes',
  not_found: 'No published node',
  co_big: 'Two Bigs listed',
  stale_candidate: 'Only an old (legacy) namesake',
  archived_family: 'Only in an archived fam',
};
const WARNING_LABEL: Record<string, string> = {
  generation_outlier: 'Big node far above newest generation',
  rejected_name_match: 'Name is on a rejection list',
  rejected_namesake: 'Similar name on a rejection list',
  little_already_on_tree: 'Already on the tree under this Big',
  duplicate_little: 'Little listed twice',
};

function toTreeNodes(fam: RecapFamily, includeNew: boolean): TreeNode[] {
  return fam.nodes
    .filter((n) => includeNew || !n.isNew)
    .map((n) => ({
      id: n.id, initial: n.label.trim().charAt(0).toUpperCase() || '?', label: n.label,
      role: n.isNew ? 'Little' : n.role, parent: n.parent, photoUrl: null, isDraft: n.isNew,
      cohort: null,
    }));
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'gold' }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-surface px-4 py-3">
      <div className={`text-2xl font-semibold tabular-nums ${tone === 'gold' ? 'text-amber-600 dark:text-amber-300' : 'text-text-primary'}`}>{value}</div>
      <div className="text-xs uppercase tracking-wider text-text-muted">{label}</div>
    </div>
  );
}

function FamilyCanvas({ fam, mode, focusId, onFocus }: { fam: RecapFamily; mode: 'before' | 'after'; focusId: string | null; onFocus: (id: string | null) => void }) {
  const nodes = useMemo(() => toTreeNodes(fam, mode === 'after'), [fam, mode]);
  const layout = useMemo(() => layoutTree(nodes), [nodes]);
  const pan = usePannableTree(`${fam.id}:${mode}`);
  const accent = accentFromThemeColor(fam.themeColor, fam.id);
  const newIds = useMemo(() => fam.nodes.filter((n) => n.isNew).map((n) => n.id), [fam]);
  const { zoomTo } = pan.controls;
  const fit = useCallback(() => {
    const viewport = pan.viewportRef.current;
    const canvas = pan.canvasRef.current;
    if (!viewport || !canvas || !canvas.offsetWidth) return;
    pan.resetView();
    const next = Math.min(1, (viewport.clientWidth - 48) / canvas.offsetWidth, (viewport.clientHeight - 48) / canvas.offsetHeight);
    zoomTo(Math.max(0.1, next), { x: 0, y: 0 });
  }, [pan, zoomTo]);
  // Open on the whole family so its size reads at a glance.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the family or mode changes
  useLayoutEffect(() => { fit(); }, [fam.id, mode]);
  const showNew = () => {
    pan.resetView();
    zoomTo(0.75, { x: 0, y: 0 });
    window.requestAnimationFrame(() => pan.revealNodes(newIds));
  };
  return (
    <div className="ace-app">
      <div
        className={`ace-sheet-treewrap ace-tree-panviewport ${pan.isDragging ? 'is-dragging' : ''}`}
        ref={pan.viewportRef}
        tabIndex={0}
        aria-label={`${displayFamilyName(fam.name)} ${mode === 'after' ? 'after' : 'before'} the new pairings. Drag to pan, plus and minus to zoom, Home to reset.`}
        style={{ height: 'min(70vh, 720px)' }}
        {...pan.viewportHandlers}
      >
        <div className="ace-tree-controls">
          <button className="ace-tree-control ace-tree-zoom-button" type="button" onClick={pan.controls.zoomOut} disabled={!pan.controls.canZoomOut} aria-label="Zoom out">
            <span className="ace-tree-control-symbol" aria-hidden="true">−</span>
          </button>
          <div className="ace-tree-zoom-readout" aria-hidden="true">{pan.controls.zoomPercent}%</div>
          <button className="ace-tree-control ace-tree-zoom-button" type="button" onClick={pan.controls.zoomIn} disabled={!pan.controls.canZoomIn} aria-label="Zoom in">
            <span className="ace-tree-control-symbol" aria-hidden="true">+</span>
          </button>
          <button className="ace-tree-control ace-tree-reset" type="button" onClick={fit} aria-label="Fit the whole tree">
            <span className="ace-tree-control-symbol" aria-hidden="true">Fit</span>
          </button>
          {mode === 'after' && newIds.length > 0 && (
            <button className="ace-tree-control ace-tree-reset" type="button" onClick={showNew} aria-label="Jump to the new branches">
              <span className="ace-tree-control-symbol" aria-hidden="true">New</span>
            </button>
          )}
        </div>
        <div className="ace-sheet-treepad ace-tree-canvas" ref={pan.canvasRef}
          style={{ transform: `translate3d(${pan.offset.x}px, ${pan.offset.y}px, 0) scale(${pan.zoom})` }}>
          <FamilyTree nodes={nodes} layout={layout} accent={accent} focusId={focusId}
            onSelect={(id: string) => onFocus(id === focusId ? null : id)} />
        </div>
      </div>
    </div>
  );
}

function QueueTable({ records }: { records: RecapReviewRecord[] }) {
  if (!records.length) return <p className="text-sm text-text-muted">Nothing waiting for review.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface2 text-xs uppercase tracking-wider text-text-muted">
          <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Big</th><th className="px-3 py-2">Little</th><th className="px-3 py-2">Why it is held</th><th className="px-3 py-2">Candidate nodes</th></tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t border-[var(--color-border)] align-top">
              <td className="px-3 py-2 tabular-nums text-text-muted">{r.sheetRow}</td>
              <td className="px-3 py-2 font-medium text-text-primary">{r.bigName}</td>
              <td className="px-3 py-2 text-text-primary">{r.littleName}</td>
              <td className="px-3 py-2 text-text-secondary">
                {STATUS_LABEL[r.bigStatus] ?? r.bigStatus}
                {r.warnings.map((w) => <div key={w} className="text-amber-700 dark:text-amber-300">{WARNING_LABEL[w] ?? w}</div>)}
              </td>
              <td className="px-3 py-2 text-text-secondary">
                {r.candidates.length === 0 ? '—' : r.candidates.map((c) => (
                  <div key={c.nodeId}>{c.nodeName} · {c.familyName} · gen {c.depth + 1} · {c.childCount} littles{c.importTerm ? ` · import ${c.importTerm}` : ''}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AceRecapPreview({ snapshot }: { snapshot: AceRecapSnapshot }) {
  const families = useMemo(() => snapshot.families.filter((f) => !f.archived || f.added > 0), [snapshot]);
  const archived = useMemo(() => snapshot.families.filter((f) => f.archived && f.added === 0), [snapshot]);
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '');
  const [mode, setMode] = useState<'before' | 'after'>('after');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tab, setTab] = useState<'trees' | 'queue' | 'recap'>('trees');
  const fam = snapshot.families.find((f) => f.id === familyId) ?? families[0];
  const queue = snapshot.records.filter((r) => !r.safeToPreview);
  const warned = snapshot.records.filter((r) => r.safeToPreview && r.warnings.length > 0);
  const byId = new Map(fam?.nodes.map((n) => [n.id, n.label]) ?? []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div role="alert" className="rounded-xl border border-amber-500/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <strong>Private preview — nothing here is published.</strong> New Littles exist only in this file. {snapshot.totals.approved} of {snapshot.totals.littles} pairings
        are Chair-approved; {snapshot.totals.queued} are held for identity review and are not attached to any tree.
        Source: {snapshot.source.label}, retrieved {snapshot.source.retrievedAt}.
      </div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-text-muted">ACE · {snapshot.cycle.label}</p>
          <h1 className="font-serif text-4xl text-text-primary">Family tree expansion preview</h1>
        </div>
        <nav role="tablist" aria-label="Preview sections" className="flex gap-2">
          {(['trees', 'queue', 'recap'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${tab === t ? 'bg-brand-600 text-white' : 'border border-[var(--color-border)] text-text-secondary hover:bg-surface2'}`}>
              {t === 'trees' ? 'Trees' : t === 'queue' ? `Review queue (${queue.length})` : 'Recap'}
            </button>
          ))}
        </nav>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Big rows" value={snapshot.totals.bigRows} />
        <Stat label="Little placements" value={snapshot.totals.littles} />
        <Stat label="Previewed" value={`+${snapshot.totals.previewed}`} tone="gold" />
        <Stat label="Held for review" value={snapshot.totals.queued} />
        <Stat label="Families growing" value={snapshot.totals.familiesGrowing} />
      </div>

      {tab === 'trees' && fam && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Family">
            {families.map((f) => (
              <button key={f.id} role="tab" aria-selected={f.id === fam.id} type="button"
                onClick={() => { setFamilyId(f.id); setFocusId(null); }}
                className={`rounded-full px-3 py-1.5 text-sm ${f.id === fam.id ? 'bg-text-primary text-surface' : 'border border-[var(--color-border)] text-text-secondary hover:bg-surface2'}`}>
                {displayFamilyName(f.name)}{f.added > 0 && <span className={`ml-1 font-semibold ${f.id === fam.id ? '' : 'text-amber-600 dark:text-amber-300'}`}>+{f.added}</span>}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="radiogroup" aria-label="Before or after" className="inline-flex overflow-hidden rounded-full border border-[var(--color-border)]">
              {(['before', 'after'] as const).map((m) => (
                <button key={m} role="radio" aria-checked={mode === m} type="button" onClick={() => setMode(m)}
                  className={`px-4 py-1.5 text-sm ${mode === m ? 'bg-brand-600 text-white' : 'text-text-secondary'}`}>
                  {m === 'before' ? 'Before (published today)' : `After (${snapshot.cycle.label})`}
                </button>
              ))}
            </div>
            <p className="text-sm text-text-secondary">
              {fam.before.people} → {fam.after.people} members · {fam.before.generations} → {fam.after.generations} generations · {fam.growth.length} Bigs
            </p>
          </div>
          <FamilyCanvas fam={fam} mode={mode} focusId={focusId} onFocus={setFocusId} />
          <p className="text-xs text-text-muted">Dashed nodes marked “Draft · not published” are the proposed Littles. Click a node to trace its lineage.</p>
          {fam.growth.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {fam.growth.map((g) => (
                <li key={g.bigNodeId}>
                  <button type="button" onClick={() => { setMode('after'); setFocusId(g.littleIds[0]); }}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-surface px-3 py-2 text-left text-sm hover:bg-surface2">
                    <span className="font-medium text-text-primary">{g.bigLabel}</span>
                    <span className="text-text-muted"> → </span>
                    <span className="text-amber-700 dark:text-amber-300">{g.littleIds.map((id) => byId.get(id)).join(', ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fam.checks.length > 0 && (
            <details className="rounded-lg border border-[var(--color-border)] p-3 text-sm text-text-secondary">
              <summary className="cursor-pointer">Branch preview checks ({fam.checks.length})</summary>
              <ul className="mt-2 list-disc pl-5">{fam.checks.map((c, i) => <li key={i}><code>{c.code}</code> {c.message}</li>)}</ul>
            </details>
          )}
          {archived.length > 0 && (
            <p className="text-xs text-text-muted">Archived fams with no proposed additions: {archived.map((f) => displayFamilyName(f.name)).join(', ')}.</p>
          )}
        </section>
      )}

      {tab === 'queue' && (
        <section className="space-y-6">
          <div>
            <h2 className="mb-2 font-serif text-2xl text-text-primary">Held for ACE Chair review</h2>
            <p className="mb-3 text-sm text-text-secondary">These Littles are not attached to any tree. Resolve the Big’s exact node, then record the approval and rebuild the snapshot.</p>
            <QueueTable records={queue} />
          </div>
          <div>
            <h2 className="mb-2 font-serif text-2xl text-text-primary">Previewed, with notes</h2>
            <QueueTable records={warned} />
          </div>
        </section>
      )}

      {tab === 'recap' && <AceRecapPlayer snapshot={snapshot} />}
    </div>
  );
}
