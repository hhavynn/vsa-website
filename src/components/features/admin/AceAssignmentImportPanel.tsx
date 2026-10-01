import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import { toUserMessage } from '../../../data/errors';
import {
  AceNodeRef,
  ImportResolution,
  parseAssignmentImport,
  resolveImportRows,
} from '../../../lib/aceAssignments';

interface AceAssignmentImportPanelProps {
  nodes: readonly AceNodeRef[];
  onImport: (resolution: ImportResolution) => Promise<void>;
  onClose: () => void;
}

const PLACEHOLDER = 'name\tbig\nJohn Nguyen\tApril Pham\nAmy Tran\tEmily Nguyen';

/** Pasted CSV/TSV of upcoming Littles. Creates draft rows only; nothing is published. */
export function AceAssignmentImportPanel({ nodes, onImport, onClose }: AceAssignmentImportPanelProps) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const parsed = useMemo(() => parseAssignmentImport(text), [text]);

  const run = async () => {
    setImporting(true);
    try {
      const emails = parsed.rows.flatMap((row) => (row.email ? [row.email] : []));
      const membersByEmail = await memberLookupRepository.matchMembersByEmail(emails);
      await onImport(resolveImportRows(parsed.rows, { nodes, membersByEmail }));
      setText('');
    } catch (error) {
      toast.error(toUserMessage(error, 'Could not add the Littles.'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <section
      aria-label="Import Littles"
      className="rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-4 font-sans text-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Import Littles</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-text3)]">
            Paste a CSV or TSV. Recognized columns: name, first name, last name, email, big, notes. Emails only match
            existing members and are never saved. Imports add draft rows; nothing becomes public.
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

      <label htmlFor="ace-assignment-import" className="sr-only">
        Pasted Littles
      </label>
      <textarea
        id="ace-assignment-import"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        className="mt-3 block min-h-[140px] w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs text-[var(--color-text)] placeholder-[var(--color-text3)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
      />

      {text.trim() && (
        <div className="mt-2 text-[var(--color-text2)]">
          <p>
            {parsed.rows.length} {parsed.rows.length === 1 ? 'Little' : 'Littles'} found
            {parsed.skipped > 0 && ` · ${parsed.skipped} blank ${parsed.skipped === 1 ? 'row' : 'rows'} skipped`}
            {parsed.columns.length > 0 && ` · columns: ${parsed.columns.join(', ')}`}
          </p>
          {parsed.warnings.map((warning) => (
            <p key={warning} className="mt-0.5 text-[var(--color-text3)]">
              <span aria-hidden>⚠️ </span>
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={run}
          disabled={importing || parsed.rows.length === 0}
          className="rounded border-0 bg-[var(--color-text)] px-3 py-1.5 text-xs font-medium text-[var(--color-bg)] disabled:opacity-50"
        >
          {importing ? 'Adding…' : `Add ${parsed.rows.length} to draft`}
        </button>
      </div>
    </section>
  );
}
