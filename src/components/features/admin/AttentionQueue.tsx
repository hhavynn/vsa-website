import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AttentionSignals, attentionSummary, buildAttentionQueue } from '../../../lib/adminAttention';

/**
 * The first thing on the Admin Overview: what needs a person right now. Counts
 * and generic labels only (no names, emails, submissions, or request details),
 * each linking to the page and filter that resolves it. It reads the signals the
 * Overview already loaded, so it makes no requests of its own.
 */
export function AttentionQueue({ signals, loading = false, failed = false, now }: { signals: AttentionSignals | null; loading?: boolean; failed?: boolean; now?: Date }) {
  const queue = useMemo(() => (signals ? buildAttentionQueue(signals, now) : null), [signals, now]);

  return (
    <section aria-labelledby="attention-queue-title" className="scrapbook-paper border-[var(--color-border)] bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="attention-queue-title" className="font-serif text-2xl font-bold text-text-primary">
          Needs attention
        </h2>
        {queue && <p className="font-mono text-[11px] text-text-muted">{attentionSummary(queue)}</p>}
      </div>

      {failed && !queue ? (
        <p role="alert" className="mt-3 text-sm text-text-secondary">Could not check what needs attention. Use Refresh counts to try again; the tools below still work.</p>
      ) : loading || !queue ? (
        <p className="mt-3 text-sm text-text-muted">Checking what needs attention…</p>
      ) : queue.items.length === 0 ? (
        <div className="mt-3" aria-live="polite">
          <p className="font-sans text-base font-semibold text-text-primary">
            {queue.unchecked.length === 0 ? 'You’re all caught up' : 'Nothing needs attention in what could be checked'}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {queue.unchecked.length === 0
              ? 'No requests, reviews, or deadlines are waiting on you right now.'
              : `Could not check: ${queue.unchecked.join(', ')}. Use Refresh counts to try again.`}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {queue.items.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to}
                  data-attention-id={item.id}
                  className="group flex h-full items-start gap-3 rounded-lg border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-surface2)]"
                >
                  <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.tone === 'urgent' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-sans text-[13px] font-semibold leading-snug text-text-primary">
                      {item.count} {item.label}
                    </span>
                    {item.detail && <span className="mt-0.5 block font-sans text-[12px] text-text-secondary">{item.detail}</span>}
                  </span>
                  <span aria-hidden className="shrink-0 self-center text-text-muted transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </li>
            ))}
          </ul>
          {queue.unchecked.length > 0 && (
            <p className="mt-3 text-xs text-text-muted">Could not check: {queue.unchecked.join(', ')}.</p>
          )}
        </>
      )}
    </section>
  );
}

export default AttentionQueue;
