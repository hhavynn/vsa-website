// Protected domain — House membership. Stage B of automatic House placement:
// shows every problem submission and lets an admin repair a ranking, map a form
// option to a House, confirm an identity, or exclude someone with a reason.
// Nothing is reordered or repaired without one of those explicit actions.
import { useState } from 'react';
import { normalizeHouseLookup } from '../../../lib/houseAssignmentImport';
import { ordinal } from '../../../lib/housePlacement';
import {
  PlacementEdits,
  PlacementReview,
  ReviewedApplicant,
  formatFormTime,
} from '../../../lib/housePlacementImport';

export interface HousePlacementReviewPanelProps {
  review: PlacementReview;
  edits: PlacementEdits;
  onEditsChange: (next: PlacementEdits) => void;
  disabled?: boolean;
}

const selectCls =
  'w-full min-w-[120px] rounded border bg-[var(--color-surface2)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const linkBtn = 'bg-transparent p-0 text-[11px] font-semibold underline-offset-2 hover:underline disabled:opacity-50';
const headCls = 'px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em]';

function submittedText(row: ReviewedApplicant) {
  return row.submittedAtIso ? formatFormTime(row.submittedAtIso) : row.rawTimestamp || '—';
}

function statusText(row: ReviewedApplicant) {
  if (row.status === 'excluded') return 'Excluded';
  if (row.status === 'duplicate') return 'Repeat';
  if (row.status === 'invalid') return 'Needs fix';
  return row.corrected ? 'Corrected' : 'Valid';
}

function statusTone(row: ReviewedApplicant) {
  if (row.status === 'invalid') return 'text-red-600 dark:text-red-400';
  if (row.status === 'excluded' || row.status === 'duplicate') return 'text-zinc-500 dark:text-zinc-400';
  return 'text-emerald-700 dark:text-emerald-400';
}

export function HousePlacementReviewPanel({ review, edits, onEditsChange, disabled = false }: HousePlacementReviewPanelProps) {
  const [excludeReason, setExcludeReason] = useState<Record<string, string>>({});
  const houseById = new Map(review.houses.map((house) => [house.id, house]));
  const byId = new Map(review.applicants.map((row) => [row.id, row]));
  const attention = review.applicants.filter((row) =>
    row.status === 'invalid' || row.corrected || row.status === 'excluded' || !!edits.confirmedIdentities[row.id]
      || !!edits.rollbackChoices[row.id] || row.issues.some((issue) => issue.severity === 'warning'));
  const duplicates = review.applicants.filter((row) => row.status === 'duplicate');

  function setChoice(row: ReviewedApplicant, rank: number, houseId: string) {
    const next = Array.from({ length: review.requiredRanks }, (_, index) => row.choiceIds[index] ?? null);
    next[rank] = houseId || null;
    onEditsChange({ ...edits, corrections: { ...edits.corrections, [row.id]: next } });
  }

  function resetCorrection(row: ReviewedApplicant) {
    const corrections = { ...edits.corrections };
    delete corrections[row.id];
    onEditsChange({ ...edits, corrections });
  }

  function exclude(row: ReviewedApplicant) {
    const reason = (excludeReason[row.id] ?? '').trim();
    if (!reason) return;
    onEditsChange({ ...edits, exclusions: { ...edits.exclusions, [row.id]: reason } });
  }

  function include(row: ReviewedApplicant) {
    const exclusions = { ...edits.exclusions };
    delete exclusions[row.id];
    onEditsChange({ ...edits, exclusions });
  }

  function setMapping(key: string, houseId: string) {
    const houseMappings = { ...edits.houseMappings };
    if (houseId) houseMappings[key] = houseId;
    else delete houseMappings[key];
    onEditsChange({ ...edits, houseMappings });
  }

  function setRollback(row: ReviewedApplicant, choice: string) {
    const rollbackChoices = { ...edits.rollbackChoices };
    if (choice === 'first' || choice === 'second') rollbackChoices[row.id] = choice;
    else delete rollbackChoices[row.id];
    onEditsChange({ ...edits, rollbackChoices });
  }

  function setIdentity(row: ReviewedApplicant, confirmed: boolean) {
    const confirmedIdentities = { ...edits.confirmedIdentities };
    if (confirmed) confirmedIdentities[row.id] = true;
    else delete confirmedIdentities[row.id];
    onEditsChange({ ...edits, confirmedIdentities });
  }

  return (
    <div className="space-y-6">
      {review.unresolvedLabels.length > 0 && (
        <section className="scrapbook-paper p-5 border-[var(--color-border)] bg-surface" aria-label="House option mapping">
          <h3 className="font-serif text-lg font-bold text-text-primary">Unrecognized House options</h3>
          <p className="mt-1 text-xs text-text-muted">
            These form options do not match exactly one active House for this year. Map each to the House it means, or fix the affected rows below.
          </p>
          <ul className="mt-3 space-y-2">
            {review.unresolvedLabels.map((label) => (
              <li key={label.key} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-xs border-[var(--color-border)]">
                <span className="text-text-primary">
                  <strong>“{label.label}”</strong> · {label.count} selection{label.count === 1 ? '' : 's'} ·{' '}
                  {label.kind === 'ambiguous' ? 'matches more than one House' : label.kind === 'inactive' ? 'inactive House' : 'no matching House'}
                </span>
                <select
                  value={edits.houseMappings[label.key] ?? ''}
                  disabled={disabled}
                  onChange={(event) => setMapping(label.key, event.target.value)}
                  aria-label={`House for option ${label.label}`}
                  className={`${selectCls} w-auto border-[var(--color-border)]`}
                >
                  <option value="">Choose a House…</option>
                  {review.houses.map((house) => <option key={house.id} value={house.id}>{house.label}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.parentResolvedLabels.length > 0 && (
        <section className="scrapbook-paper p-5 border-[var(--color-border)] bg-surface" aria-label="Recognized by House Parents">
          <h3 className="font-serif text-lg font-bold text-text-primary">Recognized by House Parent names</h3>
          <p className="mt-1 text-xs text-text-muted">
            These options don&rsquo;t match a House name exactly, but their House Parents match exactly one House. Change the House here only if this is wrong.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-text-secondary">
            {review.parentResolvedLabels.map((item) => (
              <li key={item.label} className="flex flex-wrap items-center justify-between gap-2">
                <span>“{item.label}” · {item.count} selection{item.count === 1 ? '' : 's'}</span>
                <select
                  value={item.profileId}
                  disabled={disabled}
                  onChange={(event) => setMapping(normalizeHouseLookup(item.label), event.target.value)}
                  aria-label={`House for option ${item.label}`}
                  className={`${selectCls} w-auto border-[var(--color-border)]`}
                >
                  {review.houses.map((house) => <option key={house.id} value={house.id}>{house.label}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      {duplicates.length > 0 && (
        <section className="scrapbook-paper p-5 border-[var(--color-border)] bg-surface" aria-label="Repeat submissions">
          <h3 className="font-serif text-lg font-bold text-text-primary">Repeat submissions ({duplicates.length})</h3>
          <p className="mt-1 text-xs text-text-muted">
            Same email as an earlier submission. The earliest one keeps its place in line; these later rows are ignored.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-text-secondary">
            {duplicates.map((row) => {
              const kept = row.duplicateOf ? byId.get(row.duplicateOf) : undefined;
              return (
                <li key={row.id}>
                  Row {row.sourceRow} ({row.name || 'no name'}, {submittedText(row)}) ignored — kept row {kept?.sourceRow} submitted {kept ? submittedText(kept) : '—'}.{' '}
                  {row.duplicateDiffers ? <strong className="text-amber-700 dark:text-amber-400">The later submission ranked Houses differently.</strong> : 'Same rankings.'}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="scrapbook-paper overflow-hidden border-[var(--color-border)] bg-surface" aria-label="Submissions to review">
        <div className="border-b px-5 py-4 border-[var(--color-border)]">
          <h3 className="font-serif text-lg font-bold text-text-primary">Submissions to review</h3>
          <p className="mt-1 text-xs text-text-muted">
            {review.counts.invalid > 0
              ? `${review.counts.invalid} submission${review.counts.invalid === 1 ? ' needs' : 's need'} a fix or an exclusion before placement. Fixing a ranking keeps the applicant's place in line.`
              : 'No submission is blocking placement.'}
          </p>
        </div>
        {attention.length === 0 ? (
          <p className="px-5 py-6 text-sm text-text-muted">Every submission is valid as uploaded.</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b bg-[var(--color-surface2)] border-[var(--color-border)]">
                  {['Row', 'Applicant', 'Status', ...Array.from({ length: review.requiredRanks }, (_, index) => `${ordinal(index + 1)}`), 'Reason', ''].map((heading, index) => (
                    <th key={`${heading}-${index}`} className={`${headCls} text-text-muted`}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y border-[var(--color-border)]">
                {attention.map((row) => (
                  <tr key={row.id} data-testid="placement-problem-row" className="align-top">
                    <td className="px-3 py-2 font-mono text-xs text-text-secondary">{row.sourceRow}</td>
                    <td className="px-3 py-2">
                      <p className="text-[13px] font-semibold text-text-primary">{row.name || '—'}</p>
                      <p className="text-[11px] text-text-muted">{submittedText(row)}</p>
                      {row.timestamp.kind === 'ok' && row.timestamp.ambiguous && (
                        <select
                          value={edits.rollbackChoices[row.id] ?? ''}
                          disabled={disabled}
                          onChange={(event) => setRollback(row, event.target.value)}
                          aria-label={`Which repeated hour for row ${row.sourceRow}`}
                          className={`${selectCls} mt-1 border-[var(--color-border)]`}
                        >
                          <option value="">Which 1 AM hour?</option>
                          <option value="first">First (PDT, before clocks fell back)</option>
                          <option value="second">Second (PST, after clocks fell back)</option>
                        </select>
                      )}
                    </td>
                    <td className={`px-3 py-2 font-mono text-[11px] font-bold uppercase ${statusTone(row)}`}>{statusText(row)}</td>
                    {Array.from({ length: review.requiredRanks }, (_, rank) => (
                      <td key={rank} className="px-3 py-2">
                        <select
                          value={row.choiceIds[rank] ?? ''}
                          disabled={disabled || row.status === 'excluded'}
                          onChange={(event) => setChoice(row, rank, event.target.value)}
                          aria-label={`${ordinal(rank + 1)} choice for row ${row.sourceRow}`}
                          className={`${selectCls} border-[var(--color-border)]`}
                        >
                          <option value="">{row.rawChoices[rank] && !row.corrected ? `⚠ ${row.rawChoices[rank]}` : '—'}</option>
                          {review.houses.map((house) => <option key={house.id} value={house.id}>{house.label}</option>)}
                        </select>
                        {row.corrected && row.rawChoices[rank] && houseById.get(row.choiceIds[rank] ?? '')?.label !== row.rawChoices[rank] && (
                          <p className="mt-0.5 text-[10px] text-text-muted">Form: {row.rawChoices[rank]}</p>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-[11px] text-text-secondary">
                      {row.exclusionReason ? (
                        <p>Excluded: {row.exclusionReason}</p>
                      ) : (
                        <ul className="space-y-0.5">
                          {row.issues.map((issue, index) => (
                            <li key={`${issue.code}-${index}`} className={issue.severity === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}>
                              {issue.message}
                            </li>
                          ))}
                          {row.issues.length === 0 && <li>{row.corrected ? 'Ranking corrected by an admin.' : edits.confirmedIdentities[row.id] ? 'Identity confirmed by an admin.' : ''}</li>}
                        </ul>
                      )}
                    </td>
                    <td className="space-y-1 px-3 py-2">
                      {row.corrected && (
                        <button type="button" disabled={disabled} onClick={() => resetCorrection(row)} className={`${linkBtn} text-text-secondary`}>
                          Undo correction
                        </button>
                      )}
                      {!row.email && row.status !== 'excluded' && (
                        <label className="flex items-center gap-1 text-[11px] text-text-secondary">
                          <input type="checkbox" checked={!!edits.confirmedIdentities[row.id]} disabled={disabled} onChange={(event) => setIdentity(row, event.target.checked)} />
                          Separate applicant
                        </label>
                      )}
                      {row.status === 'excluded' ? (
                        <button type="button" disabled={disabled} onClick={() => include(row)} className={`${linkBtn} text-[var(--brand)]`}>
                          Include again
                        </button>
                      ) : (
                        <div className="flex min-w-[180px] gap-1">
                          <input
                            type="text"
                            value={excludeReason[row.id] ?? ''}
                            disabled={disabled}
                            onChange={(event) => setExcludeReason((current) => ({ ...current, [row.id]: event.target.value }))}
                            placeholder="Reason to exclude"
                            aria-label={`Reason to exclude row ${row.sourceRow}`}
                            className="min-w-0 flex-1 rounded border px-2 py-1 text-[11px] border-[var(--color-border)] bg-surface2 text-text-primary"
                          />
                          <button
                            type="button"
                            disabled={disabled || !(excludeReason[row.id] ?? '').trim()}
                            onClick={() => exclude(row)}
                            className={`${linkBtn} text-text-secondary`}
                          >
                            Exclude
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
