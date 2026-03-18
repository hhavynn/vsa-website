import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';

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
  bug:         'Bug',
  feature:     'Feature Request',
  improvement: 'Improvement',
  other:       'Other',
};

const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  closed:      'Closed',
};

const PRIORITY_LABELS: Record<string, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
};

// Flat, border-only status badge — no colored backgrounds
const statusBadgeCls = (status: string) => {
  const map: Record<string, string> = {
    pending:     'border-accent-500/40 text-accent-500',
    in_progress: 'border-blue-500/40 text-blue-400',
    resolved:    'border-emerald-500/40 text-emerald-400',
    closed:      'border-zinc-600 text-zinc-500',
  };
  return `px-2 py-0.5 text-xs font-medium border rounded ${map[status] ?? 'border-zinc-600 text-zinc-500'}`;
};

const typeBadgeCls = (type: string) => {
  const map: Record<string, string> = {
    bug:         'border-red-500/40 text-red-400',
    feature:     'border-violet-500/40 text-violet-400',
    improvement: 'border-brand-500/40 text-brand-400',
    other:       'border-zinc-600 text-zinc-500',
  };
  return `px-2 py-0.5 text-xs font-medium border rounded ${map[type] ?? 'border-zinc-600 text-zinc-500'}`;
};

const selectCls = 'h-9 px-3 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500';

const FeedbackTab: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => { fetchFeedbacks(); }, []);

  const fetchFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
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

  const filteredFeedbacks = feedbacks.filter(f =>
    (statusFilter === 'all' || f.status === statusFilter) &&
    (typeFilter === 'all'   || f.type   === typeFilter)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="status-filter" className="block text-xs font-medium text-zinc-500 uppercase tracking-label mb-1">Status</label>
          <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div>
          <label htmlFor="type-filter" className="block text-xs font-medium text-zinc-500 uppercase tracking-label mb-1">Type</label>
          <select id="type-filter" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls}>
            <option value="all">All</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature Request</option>
            <option value="improvement">Improvement</option>
            <option value="other">Other</option>
          </select>
        </div>
        <p className="text-xs text-zinc-500 ml-auto self-end pb-0.5">
          {filteredFeedbacks.length} item{filteredFeedbacks.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* List */}
      {filteredFeedbacks.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-sm">
          {feedbacks.length === 0 ? 'No feedback submitted yet.' : 'No items match the current filters.'}
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-[#27272a] rounded-md overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
          {filteredFeedbacks.map(feedback => (
            <div key={feedback.id} className="p-4 bg-white dark:bg-[#18181b] hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{feedback.title}</h3>
                    <span className={statusBadgeCls(feedback.status)}>
                      {FEEDBACK_STATUS_LABELS[feedback.status]}
                    </span>
                    <span className={typeBadgeCls(feedback.type)}>
                      {FEEDBACK_TYPE_LABELS[feedback.type]}
                    </span>
                    {feedback.priority && (
                      <span className={`px-2 py-0.5 text-xs font-medium border rounded ${
                        feedback.priority === 'high'   ? 'border-red-500/40 text-red-400' :
                        feedback.priority === 'medium' ? 'border-accent-500/40 text-accent-400' :
                                                         'border-zinc-600 text-zinc-500'
                      }`}>
                        {PRIORITY_LABELS[feedback.priority]}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{feedback.description}</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(feedback.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                {feedback.status === 'pending' && (
                  <button onClick={() => handleStatusChange(feedback.id, 'in_progress')}
                    className="px-3 py-1.5 text-xs font-medium border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 rounded transition-colors">
                    Start
                  </button>
                )}
                {feedback.status === 'in_progress' && (
                  <button onClick={() => handleStatusChange(feedback.id, 'resolved')}
                    className="px-3 py-1.5 text-xs font-medium border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors">
                    Mark Resolved
                  </button>
                )}
                {feedback.status === 'resolved' && (
                  <button onClick={() => handleStatusChange(feedback.id, 'closed')}
                    className="px-3 py-1.5 text-xs font-medium border border-zinc-600 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors">
                    Close
                  </button>
                )}
                {feedback.status === 'closed' && (
                  <button onClick={() => handleStatusChange(feedback.id, 'pending')}
                    className="px-3 py-1.5 text-xs font-medium border border-accent-500/40 text-accent-500 hover:bg-accent-500/10 rounded transition-colors">
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedbackTab;
