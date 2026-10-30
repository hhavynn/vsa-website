import { ReactNode, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import { toUserMessage } from '../../../data/errors';
import type { AceNodeRef, ImportResolution } from '../../../lib/aceAssignments';
import {
  MutualRespondent,
  PossibleDecision,
  classifyMutualRequests,
  followUpReviewRows,
  parseMutualRequests,
  planMutualImport,
} from '../../../lib/aceMutualRequests';
import { problemRowsToCsv } from '../../../lib/adminImportReview';
import { downloadCsv } from '../../../lib/housePlacementExport';
import { pluralize } from '../../../lib/operationalStatus';
import { cn } from '../../../lib/utils';
import { useUnsavedChangesGuard } from '../../../hooks/useUnsavedChangesGuard';

interface AceMutualRequestPanelProps {
  nodes: readonly AceNodeRef[];
  /** Little names already in the draft; those Littles are skipped. */
  existingNames?: readonly string[];
  onImport: (resolution: ImportResolution) => Promise<void>;
  onClose: () => void;
}

const smallBtn =
  'rounded border border-[var(--color-border)] bg-transparent px-2.5 py-1 font-sans text-[11px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface2)] disabled:opacity-50';

function who(person: MutualRespondent): string {
  return person.fam ? `${person.name} (${person.fam})` : person.name;
}

function Section({ title, count, tone, children }: { title: string; count: number; tone: string; children: ReactNode }) {
  const id = `ace-mutual-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
      <h4 id={id} className="flex items-baseline gap-2 border-b border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-text-primary">
        {title}
        <span className={cn('font-mono text-[11px] font-bold', tone)}>{count}</span>
      </h4>
      {count === 0 ? (
        <p className="px-3 py-2 text-text-muted">None.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-[var(--color-border)] overflow-y-auto">{children}</ul>
      )}
    </section>
  );
}

/**
 * Checks the pasted "ACE Mutual Request" responses for pairs that requested
 * each other. The paste stays in this component's state only; confirmed pairs
 * go into the draft through the same import path as Import Littles.
 */
export function AceMutualRequestPanel({ nodes, existingNames = [], onImport, onClose }: AceMutualRequestPanelProps) {
  const [text, setText] = useState('');
  const [decisions, setDecisions] = useState<ReadonlyMap<string, PossibleDecision>>(new Map());
  const [importing, setImporting] = useState(false);
  useUnsavedChangesGuard(text.trim().length > 0, importing);

  const parsed = useMemo(() => parseMutualRequests(text), [text]);
  const check = useMemo(() => classifyMutualRequests(parsed.respondents, decisions), [parsed.respondents, decisions]);
  const followUps = useMemo(() => followUpReviewRows(check), [check]);
  const preview = useMemo(
    () => planMutualImport(check.pairs, { nodes, membersByEmail: new Map(), existingNames }),
    [check.pairs, nodes, existingNames],
  );
  const toAdd = preview.resolution.seeds.length;
  const pendingPossible = check.possible.filter((item) => item.decision === 'pending').length;
  const bigs = parsed.respondents.filter((person) => person.role === 'big').length;
  const littles = parsed.respondents.filter((person) => person.role === 'little').length;

  const decide = (key: string, decision: PossibleDecision) =>
    setDecisions((current) => {
      const next = new Map(current);
      if (next.get(key) === decision) next.delete(key);
      else next.set(key, decision);
      return next;
    });

  const add = async () => {
    setImporting(true);
    try {
      const emails = check.pairs.flatMap((pair) => (pair.little.email ? [pair.little.email] : []));
      const membersByEmail = await memberLookupRepository.matchMembersByEmail(emails);
      const plan = planMutualImport(check.pairs, { nodes, membersByEmail, existingNames });
      if (plan.resolution.seeds.length > 0) await onImport(plan.resolution);
      if (plan.alreadyInDraft > 0) toast(`Skipped ${pluralize(plan.alreadyInDraft, 'Little')} already in the draft.`);
      setText('');
      setDecisions(new Map());
    } catch (error) {
      toast.error(toUserMessage(error, 'Could not add the pairs.'));
    } finally {
      setImporting(false);
    }
  };

  const hasInput = text.trim().length > 0;

  return (
    <section
      aria-label="Check mutual requests"
      className="rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-4 font-sans text-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Check mutual requests</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-text3)]">
            Copy the ACE Mutual Request responses from Google Sheets, header row included, and paste them here. A pair
            counts only when both people requested each other. Phone, social and email columns are ignored, and nothing
            is saved until you add the confirmed pairs to the draft.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="bg-transparent p-0 text-[11px] font-medium text-[var(--color-text2)] hover:underline"
        >
          Close
        </button>
      </div>

      <label htmlFor="ace-mutual-requests" className="sr-only">
        Pasted mutual request responses
      </label>
      <textarea
        id="ace-mutual-requests"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the form responses, including the header row"
        spellCheck={false}
        className="mt-3 block min-h-[140px] w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs text-[var(--color-text)] placeholder-[var(--color-text3)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
      />

      {hasInput && (
        <div className="mt-2 text-[var(--color-text2)]" aria-live="polite">
          <p data-testid="mutual-summary">
            {pluralize(parsed.respondents.length, 'person', 'people')} · {pluralize(bigs, 'Big')} · {pluralize(littles, 'Little')}
          </p>
          {parsed.warnings.map((warning) => (
            <p key={warning} className="mt-0.5 text-[var(--color-text3)]">
              <span aria-hidden>⚠️ </span>
              {warning}
            </p>
          ))}
        </div>
      )}

      {hasInput && parsed.respondents.length > 0 && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Section title="Confirmed pairs" count={check.pairs.length} tone="text-green-700 dark:text-green-400">
            {check.pairs.map((pair) => (
              <li key={`${pair.big.id}-${pair.little.id}`} className="px-3 py-2 text-text-primary">
                <span className="font-semibold">{who(pair.big)}</span>
                <span className="mx-1.5 text-text-muted">Big of</span>
                <span className="font-semibold">{pair.little.name}</span>
                {pair.confirmedByChair && <span className="ml-1.5 text-text-muted">(you confirmed a spelling)</span>}
              </li>
            ))}
          </Section>

          <Section title="Possible matches" count={check.possible.length} tone="text-amber-700 dark:text-amber-400">
            {check.possible.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <p className="min-w-0 text-text-primary">
                  {item.from.name} wrote <span className="font-semibold">“{item.requested}”</span>. Did they mean{' '}
                  <span className="font-semibold">{who(item.candidate)}</span>?
                </p>
                <div className="flex gap-1.5" role="group" aria-label={`${item.requested} is ${item.candidate.name}?`}>
                  <button type="button" aria-pressed={item.decision === 'accepted'} onClick={() => decide(item.key, 'accepted')} className={cn(smallBtn, item.decision === 'accepted' && 'border-brand-600 bg-brand-600/10 dark:border-brand-400')}>
                    Same person
                  </button>
                  <button type="button" aria-pressed={item.decision === 'rejected'} onClick={() => decide(item.key, 'rejected')} className={cn(smallBtn, item.decision === 'rejected' && 'border-brand-600 bg-brand-600/10 dark:border-brand-400')}>
                    Not them
                  </button>
                </div>
              </li>
            ))}
          </Section>

          <Section title="One-sided" count={check.oneSided.length} tone="text-amber-700 dark:text-amber-400">
            {check.oneSided.map((item) => (
              <li key={`${item.from.id}-${item.to.id}`} className="px-3 py-2">
                <p className="text-text-primary">
                  <span className="font-semibold">{item.from.name}</span> asked for {item.to.name}
                </p>
                <p className="mt-0.5 text-text-secondary">
                  {item.to.requested.length > 0 ? `${item.to.name} asked for ${item.to.requested.join(', ')}.` : `${item.to.name} did not name anyone.`}
                </p>
              </li>
            ))}
          </Section>

          <Section title="Unresolved names" count={check.unresolved.length} tone="text-text-secondary">
            {check.unresolved.map((item, index) => (
              <li key={`${item.from.id}-${item.requested}-${index}`} className="px-3 py-2">
                <p className="text-text-primary">
                  <span className="font-semibold">{item.from.name}</span> asked for “{item.requested}”
                </p>
                <p className="mt-0.5 text-text-secondary">{item.reason}</p>
              </li>
            ))}
          </Section>

          <Section title="Conflicts" count={check.conflicts.length} tone="text-red-600 dark:text-red-400">
            {check.conflicts.map((conflict) => (
              <li key={`${conflict.kind}-${conflict.person.id}`} className="px-3 py-2">
                <p className="font-semibold text-text-primary">{conflict.person.name}</p>
                <p className="mt-0.5 text-text-secondary">{conflict.message}</p>
              </li>
            ))}
          </Section>
        </div>
      )}

      {hasInput && parsed.respondents.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {pendingPossible > 0 && (
            <p className="mr-auto text-text-secondary">{pluralize(pendingPossible, 'possible match', 'possible matches')} still to check.</p>
          )}
          {preview.alreadyInDraft > 0 && (
            <p className="text-text-secondary">{pluralize(preview.alreadyInDraft, 'Little')} already in the draft will be skipped.</p>
          )}
          <button
            type="button"
            onClick={() => downloadCsv(problemRowsToCsv(followUps), 'ace-mutual-request-follow-ups.csv')}
            disabled={followUps.length === 0}
            className={smallBtn}
          >
            Download follow-ups CSV
          </button>
          <button
            type="button"
            onClick={add}
            disabled={importing || toAdd === 0}
            className="rounded border-0 bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 dark:bg-brand-300 dark:text-brand-950 dark:hover:bg-brand-200 disabled:opacity-50"
          >
            {importing ? 'Adding…' : `Add ${pluralize(toAdd, 'confirmed pair')} to draft`}
          </button>
        </div>
      )}
    </section>
  );
}
