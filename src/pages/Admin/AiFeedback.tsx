import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUrlFilter } from '../../hooks/useUrlFilter';
import { PageTitle } from '../../components/common/PageTitle';
import { AiFeedback, AiFeedbackFilters, aiFeedbackRepository } from '../../data/repos/aiFeedback';
import { format } from 'date-fns';
import { toUserMessage } from '../../data/errors';

export default function AdminAiFeedback() {
  const [feedback, setFeedback] = useState<AiFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const dirtyNotes = useRef<Set<string>>(new Set());
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [savingResolutionId, setSavingResolutionId] = useState<string | null>(null);
  const [resolutionErrorId, setResolutionErrorId] = useState<string | null>(null);
  
  const [statusParam, setStatusFilter] = useUrlFilter(['unresolved', 'resolved', 'all'], 'filter', 'unresolved');
  const statusFilter = statusParam as AiFeedbackFilters['status'];
  const [ratingFilter, setRatingFilter] = useState<AiFeedbackFilters['rating']>('all');

  useEffect(() => {
    let mounted = true;

    async function loadFeedback() {
      setLoading(true);
      setErrorText(null);
      try {
        const data = await aiFeedbackRepository.listAdminFeedback({
          status: statusFilter,
          rating: ratingFilter,
        });
        if (!mounted) return;
        setFeedback(data);
        // Keep unsaved notes by ID even when another filter hides the row.
        setNoteDrafts(current => {
          const next = { ...current };
          for (const item of data) {
            if (!dirtyNotes.current.has(item.id)) next[item.id] = item.admin_notes ?? '';
          }
          return next;
        });
        setNoteError(null);
      } catch (err) {
        if (!mounted) return;
        console.error(err);
        setErrorText(toUserMessage(err, 'Failed to load AI feedback.'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadFeedback();

    return () => {
      mounted = false;
    };
  }, [statusFilter, ratingFilter]);

  async function handleSetResolution(id: string, resolve: boolean) {
    if (savingResolutionId || savingNoteId || dirtyNotes.current.has(id)) return;
    setSavingResolutionId(id);
    setResolutionErrorId(null);
    try {
      if (resolve) await aiFeedbackRepository.markResolved(id);
      else await aiFeedbackRepository.markUnresolved(id);
      const resolvedAt = resolve ? new Date().toISOString() : null;
      setFeedback(current => current
        .map(item => item.id === id ? { ...item, resolved_at: resolvedAt } : item)
        // Changing a status should immediately remove the item from the
        // active filtered inbox, not leave a stale action on the screen.
        .filter(item => statusFilter === 'all' || (statusFilter === 'resolved' ? !!item.resolved_at : !item.resolved_at)));
    } catch {
      // A rejected write must keep the visible status unchanged and retryable.
      setResolutionErrorId(id);
    } finally {
      setSavingResolutionId(null);
    }
  }

  async function handleSaveNote(item: AiFeedback) {
    const draft = (noteDrafts[item.id] ?? item.admin_notes ?? '').trim();
    setSavingNoteId(item.id);
    setNoteError(null);
    try {
      await aiFeedbackRepository.updateAdminNotes(item.id, draft);
      setFeedback(current => current.map(row => row.id === item.id ? { ...row, admin_notes: draft || null } : row));
      dirtyNotes.current.delete(item.id);
      setNoteDrafts(current => ({ ...current, [item.id]: draft }));
    } catch {
      setNoteError(item.id);
    } finally {
      setSavingNoteId(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Ask VSA Feedback" />

      <div className="vsa-admin-field vsa-ribbon-bottom border-[var(--color-border)] border-b px-5 py-6 sm:px-8 sm:py-7">
        <div className="max-w-5xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text3)' }}>
            Admin workflow
          </p>
          <h1 className="mt-2 font-display text-[2rem] font-normal leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[2.6rem]" style={{ color: 'var(--color-text)' }}>
            Ask VSA Feedback
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            Review helpfulness ratings, record next steps, and update the knowledge base. Only short, admin-only review notes are saved; never paste a raw conversation or member identifiers.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap gap-4">
          <label className="block">
            <span className="mb-1 block font-sans text-[11px] font-semibold" style={{ color: 'var(--color-text3)' }}>
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded border bg-[var(--color-surface)] px-3 py-1.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-sans text-[11px] font-semibold" style={{ color: 'var(--color-text3)' }}>
              Rating
            </span>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value as any)}
              className="rounded border bg-[var(--color-surface)] px-3 py-1.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <option value="all">All Ratings</option>
              <option value="not_helpful">Not Helpful</option>
              <option value="helpful">Helpful</option>
            </select>
          </label>
        </div>

        {errorText ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {errorText}
          </div>
        ) : loading ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
            Loading feedback...
          </div>
        ) : feedback.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>No feedback found for these filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedback.map(item => (
              <div key={item.id} className="rounded-lg border p-4 sm:p-5 shadow-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider ${
                        item.rating === 'helpful' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                      }`}>
                        {item.rating === 'helpful' ? '👍 Helpful' : '👎 Not Helpful'}
                      </span>
                      {item.category && (
                        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>
                          {item.category}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                      {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
                      {item.page_path && ` • on ${item.page_path}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSetResolution(item.id, !item.resolved_at)}
                    disabled={savingNoteId !== null || savingResolutionId !== null || (noteDrafts[item.id] ?? item.admin_notes ?? '').trim() !== (item.admin_notes ?? '').trim()}
                    title="Save any pending review note before changing resolution"
                    className="shrink-0 disabled:cursor-not-allowed disabled:opacity-50 rounded border px-3 py-1 font-sans text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {savingResolutionId === item.id ? 'Updating…' : item.resolved_at ? 'Reopen for review' : 'Mark Resolved'}
                  </button>
                </div>

                {resolutionErrorId === item.id && (
                  <p role="alert" className="mt-2 font-sans text-xs text-red-600 dark:text-red-400">
                    Could not update feedback status. Please retry.
                  </p>
                )}

                {item.feedback_text && (
                  <div className="mt-4 rounded-lg bg-[var(--color-surface2)] p-3" style={{ borderLeft: '3px solid var(--accent)' }}>
                    <p className="font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>User Note:</p>
                    <p className="mt-1 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                      {item.feedback_text}
                    </p>
                  </div>
                )}

                <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <label htmlFor={'feedback-note-' + item.id} className="font-sans text-xs font-semibold text-text-secondary">
                      Internal review note
                    </label>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {item.category?.trim() && item.category.length <= 80 && (
                        <Link
                          to={`/admin/ai-knowledge?category=${encodeURIComponent(item.category)}`}
                          className="font-sans text-xs font-semibold text-brand-700 underline hover:no-underline dark:text-brand-300"
                        >
                          Browse {item.category} knowledge candidates →
                        </Link>
                      )}
                      <Link
                        to="/admin/ai-knowledge"
                        className="font-sans text-xs font-semibold text-brand-700 underline hover:no-underline dark:text-brand-300"
                      >
                        Review knowledge base →
                      </Link>
                    </div>
                  </div>
                  <p className="mt-1 font-sans text-[11px] text-text-muted">
                    Describe what to verify or change. Do not include names, emails, hashed identifiers or raw chats.
                    This note does not automatically mark the feedback resolved.
                    The category link shows possible knowledge to review, not the source of this answer.
                  </p>
                  <textarea
                    id={'feedback-note-' + item.id}
                    value={noteDrafts[item.id] ?? item.admin_notes ?? ''}
                    onChange={event => {
                      // Reverting to the server baseline makes this field clean again,
                      // so a later filter refresh can hydrate another admin's edit.
                      if (event.target.value.trim() === (item.admin_notes ?? '').trim()) {
                        dirtyNotes.current.delete(item.id);
                      } else {
                        dirtyNotes.current.add(item.id);
                      }
                      setNoteDrafts(current => ({ ...current, [item.id]: event.target.value }));
                    }}
                    maxLength={1500}
                    rows={3}
                    disabled={savingNoteId === item.id || savingResolutionId === item.id}
                    className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-sans text-sm text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    placeholder="Example: Update the published FAQ about event check-ins."
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSaveNote(item)}
                      disabled={savingNoteId !== null || savingResolutionId !== null || (noteDrafts[item.id] ?? item.admin_notes ?? '').trim() === (item.admin_notes ?? '').trim()}
                      className="rounded-md border border-[var(--color-border)] px-3 py-2 font-sans text-xs font-semibold text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-300"
                    >
                      {savingNoteId === item.id ? 'Saving…' : 'Save review note'}
                    </button>
                    {noteError === item.id && (
                      <span role="alert" className="font-sans text-xs text-red-600 dark:text-red-400">
                        Note could not be saved. Please retry.
                      </span>
                    )}
                  </div>
                </div>

                {item.answer_excerpt && (
                  <div className="mt-3">
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>Context Excerpt</p>
                    <p className="mt-1 font-sans text-xs italic leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                      "{item.answer_excerpt}"
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
