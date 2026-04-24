import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';

interface Feedback {
  id: number;
  user_id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
  status: string;
  priority?: string;
}

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  feature: 'Feature Request',
  improvement: 'Improvement',
  other: 'Other',
};

const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const selectCls =
  'h-9 min-w-[170px] rounded border px-3 text-sm transition-colors focus:outline-none focus:ring-0';

function badgeTone(value?: string) {
  const tones: Record<string, { color: string; borderColor: string; background: string }> = {
    pending: { color: '#8c6a14', borderColor: '#e6d39b', background: '#fff7df' },
    in_progress: { color: '#1a4ed8', borderColor: '#bfd2ff', background: '#edf3ff' },
    resolved: { color: '#0f7a52', borderColor: '#bfe3d4', background: '#eefaf4' },
    closed: { color: 'var(--color-text3)', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' },
    bug: { color: '#b42318', borderColor: '#f2c7c3', background: '#fff1f0' },
    feature: { color: '#6a3fc7', borderColor: '#dccffc', background: '#f6f1ff' },
    improvement: { color: '#1a4ed8', borderColor: '#bfd2ff', background: '#edf3ff' },
    other: { color: 'var(--color-text3)', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' },
    low: { color: 'var(--color-text3)', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' },
    medium: { color: '#8c6a14', borderColor: '#e6d39b', background: '#fff7df' },
    high: { color: '#b42318', borderColor: '#f2c7c3', background: '#fff1f0' },
  };

  return tones[value ?? ''] ?? tones.other;
}

function ActionButton({
  onClick,
  children,
  tone = 'default',
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'blue' | 'green' | 'amber';
}) {
  const tones = {
    default: {
      color: 'var(--color-text2)',
      borderColor: 'var(--color-border)',
      background: 'transparent',
    },
    blue: {
      color: '#1a4ed8',
      borderColor: '#bfd2ff',
      background: '#edf3ff',
    },
    green: {
      color: '#0f7a52',
      borderColor: '#bfe3d4',
      background: '#eefaf4',
    },
    amber: {
      color: '#8c6a14',
      borderColor: '#e6d39b',
      background: '#fff7df',
    },
  } as const;

  return (
    <button
      onClick={onClick}
      className="rounded border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
      style={tones[tone]}
    >
      {children}
    </button>
  );
}

const FeedbackTab: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const { error } = await supabase.from('feedback').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(`Marked as ${FEEDBACK_STATUS_LABELS[newStatus].toLowerCase()}`);
      fetchFeedbacks();
    } catch (error) {
      console.error('Error updating feedback status:', error);
      toast.error('Failed to update status');
    }
  };

  const filteredFeedbacks = feedbacks.filter(
    (feedback) =>
      (statusFilter === 'all' || feedback.status === statusFilter) &&
      (typeFilter === 'all' || feedback.type === typeFilter)
  );

  if (loading) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
        Loading feedback...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="grid gap-4 rounded-md border p-5 md:grid-cols-[repeat(2,minmax(0,220px))_1fr]"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div>
          <label
            htmlFor="status-filter"
            className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-text3)' }}
          >
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectCls}
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
            }}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="type-filter"
            className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-text3)' }}
          >
            Type
          </label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={selectCls}
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
            }}
          >
            <option value="all">All</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature Request</option>
            <option value="improvement">Improvement</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="self-end text-right text-xs" style={{ color: 'var(--color-text2)' }}>
          {filteredFeedbacks.length} item{filteredFeedbacks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {filteredFeedbacks.length === 0 ? (
        <div
          className="rounded-md border py-16 text-center text-sm"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text3)' }}
        >
          {feedbacks.length === 0 ? 'No feedback submitted yet.' : 'No items match the current filters.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFeedbacks.map((feedback) => (
            <article
              key={feedback.id}
              className="rounded-md border p-5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded border px-2 py-0.5 text-[11px] font-medium" style={badgeTone(feedback.status)}>
                      {FEEDBACK_STATUS_LABELS[feedback.status]}
                    </span>
                    <span className="rounded border px-2 py-0.5 text-[11px] font-medium" style={badgeTone(feedback.type)}>
                      {FEEDBACK_TYPE_LABELS[feedback.type]}
                    </span>
                    {feedback.priority && (
                      <span className="rounded border px-2 py-0.5 text-[11px] font-medium" style={badgeTone(feedback.priority)}>
                        {PRIORITY_LABELS[feedback.priority]}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                    {feedback.title}
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    {feedback.description}
                  </p>
                </div>

                <div className="text-xs lg:min-w-[180px] lg:text-right" style={{ color: 'var(--color-text3)' }}>
                  {new Date(feedback.created_at).toLocaleString()}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                {feedback.status === 'pending' && (
                  <ActionButton onClick={() => handleStatusChange(feedback.id, 'in_progress')} tone="blue">
                    Start Review
                  </ActionButton>
                )}
                {feedback.status === 'in_progress' && (
                  <ActionButton onClick={() => handleStatusChange(feedback.id, 'resolved')} tone="green">
                    Mark Resolved
                  </ActionButton>
                )}
                {feedback.status === 'resolved' && (
                  <ActionButton onClick={() => handleStatusChange(feedback.id, 'closed')}>Close</ActionButton>
                )}
                {feedback.status === 'closed' && (
                  <ActionButton onClick={() => handleStatusChange(feedback.id, 'pending')} tone="amber">
                    Reopen
                  </ActionButton>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedbackTab;
