import { useEffect, useState } from 'react';
import { PageTitle } from '../../components/common/PageTitle';
import { AiFeedback, AiFeedbackFilters, aiFeedbackRepository } from '../../data/repos/aiFeedback';
import { format } from 'date-fns';

export default function AdminAiFeedback() {
  const [feedback, setFeedback] = useState<AiFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  
  const [statusFilter, setStatusFilter] = useState<AiFeedbackFilters['status']>('unresolved');
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
      } catch (err) {
        if (!mounted) return;
        setErrorText(err instanceof Error ? err.message : 'Failed to load AI feedback.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadFeedback();

    return () => {
      mounted = false;
    };
  }, [statusFilter, ratingFilter]);

  async function handleMarkResolved(id: string) {
    try {
      await aiFeedbackRepository.markResolved(id);
      setFeedback(current => current.map(item => item.id === id ? { ...item, resolved_at: new Date().toISOString() } : item));
    } catch (err) {
      alert('Failed to mark resolved.');
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Ask VSA Feedback" />

      <div className="border-b px-6 py-6 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-5xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text3)' }}>
            Admin workflow
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            Ask VSA Feedback
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            Review helpfulness ratings and member feedback to improve the Ask VSA knowledge base.
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
                  {!item.resolved_at && (
                    <button
                      onClick={() => handleMarkResolved(item.id)}
                      className="shrink-0 rounded border px-3 py-1 font-sans text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>

                {item.feedback_text && (
                  <div className="mt-4 rounded-lg bg-[var(--color-surface2)] p-3" style={{ borderLeft: '3px solid var(--accent)' }}>
                    <p className="font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>User Note:</p>
                    <p className="mt-1 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                      {item.feedback_text}
                    </p>
                  </div>
                )}

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
