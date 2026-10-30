import { useState } from 'react';
import type { AceApplicationSummary } from '../../../hooks/useAceApplicationProfiles';

interface AceApplicationProfilesPanelProps {
  summary: AceApplicationSummary | null;
  onLoad: (text: string) => Promise<unknown>;
  onClear: () => void;
  onClose: () => void;
}

export const APPLICATION_PRIVACY_NOTE = 'Application answers stay in this browser tab and are not saved.';

/**
 * Paste the ACE application responses to see them beside the drafts. The
 * answers live only in memory; this panel never calls a write.
 */
export function AceApplicationProfilesPanel({ summary, onLoad, onClear, onClose }: AceApplicationProfilesPanelProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      await onLoad(text);
      // The parsed profiles are all that is kept; drop the raw paste.
      setText('');
    } finally {
      setLoading(false);
    }
  };

  const matched = summary ? summary.bigCount + summary.littleCount - summary.unmatched.length : 0;

  return (
    <section
      aria-label="Application answers"
      className="rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-4 font-sans text-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Application answers</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-text3)]">
            Copy the ACE application responses from Google Sheets, including the header row, and paste them here. Only
            the answers that help with matching are read; contact details, birthdays, allergies, sizes, and similar
            columns are ignored.
          </p>
          <p role="note" className="mt-1 text-[11px] font-semibold text-[var(--color-text2)]">
            <span aria-hidden>🔒 </span>
            {APPLICATION_PRIVACY_NOTE} Leaving or refreshing the page clears them.
          </p>
        </div>
        <button type="button" onClick={onClose} className="bg-transparent p-0 text-[11px] font-medium text-[var(--color-text2)] hover:underline">
          Close
        </button>
      </div>

      <label htmlFor="ace-application-paste" className="sr-only">
        Pasted application responses
      </label>
      <textarea
        id="ace-application-paste"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={summary ? 'Paste again to replace the loaded answers.' : 'Paste the application responses…'}
        spellCheck={false}
        autoComplete="off"
        className="mt-3 block min-h-[96px] w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs text-[var(--color-text)] placeholder-[var(--color-text3)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
      />
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {summary && (
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--color-text2)] hover:bg-[var(--color-surface)]"
          >
            Clear answers
          </button>
        )}
        <button
          type="button"
          onClick={load}
          disabled={loading || !text.trim()}
          className="rounded border-0 bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-300 dark:text-brand-950 dark:hover:bg-brand-200"
        >
          {loading ? 'Loading…' : 'Load answers'}
        </button>
      </div>

      {summary && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3 text-[var(--color-text2)]" aria-live="polite">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Bigs', summary.bigCount],
              ['Littles', summary.littleCount],
              ['Repeats replaced', summary.repeatsReplaced],
              ['Unmatched', summary.unmatched.length],
            ].map(([label, value]) => (
              <div key={label} role="group" aria-label={String(label)}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text3)]">{label}</dt>
                <dd className="font-serif text-lg font-bold text-[var(--color-text)]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-[11px] text-[var(--color-text3)]">
            {matched} matched to a draft Little or an ACE tree node.
          </p>
          {summary.warnings.map((warning) => (
            <p key={warning} className="mt-0.5 text-[var(--color-text3)]">
              <span aria-hidden>⚠️ </span>
              {warning}
            </p>
          ))}
          {summary.emailLookupFailed && (
            <p className="mt-0.5 text-[var(--color-text3)]">
              <span aria-hidden>⚠️ </span>
              Could not check emails against member records, so Littles were matched by name only.
            </p>
          )}
          {summary.unmatched.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium text-[var(--color-text)]">
                {summary.unmatched.length} {summary.unmatched.length === 1 ? 'applicant' : 'applicants'} matched no draft row or tree node
              </summary>
              <p className="mt-1 text-[11px] text-[var(--color-text3)]">
                Fix the spelling of the draft Little or the ACE node so the names agree, or add the Little to the draft.
              </p>
              <ul className="mt-1 grid gap-0.5 sm:grid-cols-2" aria-label="Unmatched applicants">
                {summary.unmatched.map((profile) => (
                  <li key={profile.id}>
                    {profile.displayName}
                    {profile.displayName !== profile.fullName && <span className="text-[var(--color-text3)]"> ({profile.fullName})</span>}
                    <span className="ml-1 font-mono text-[10px] uppercase text-[var(--color-text3)]">{profile.role === 'big' ? 'Big' : 'Little'}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
