import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
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
  bug: 'Bug Report',
  feature: 'Feature Request',
  improvement: 'Improvement',
  other: 'Other'
};

const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed'
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

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
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      toast.error('Failed to load feedbacks');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Feedback marked as ${FEEDBACK_STATUS_LABELS[newStatus].toLowerCase()}`);
      fetchFeedbacks();
    } catch (error) {
      console.error('Error updating feedback status:', error);
      toast.error('Failed to update feedback status');
    }
  };

  const filteredFeedbacks = feedbacks.filter(feedback => {
    const statusMatch = statusFilter === 'all' || feedback.status === statusFilter;
    const typeMatch = typeFilter === 'all' || feedback.type === typeFilter;
    return statusMatch && typeMatch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 dark:text-gray-400">Loading feedbacks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex flex-col space-y-2">
          <label htmlFor="status-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        
        <div className="flex flex-col space-y-2">
          <label htmlFor="type-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Types</option>
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="improvement">Improvement</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Feedback List */}
      {filteredFeedbacks.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 dark:text-gray-400">
            {feedbacks.length === 0 ? 'No feedback available.' : 'No feedback matches the current filters.'}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFeedbacks.map((feedback) => (
            <div key={feedback.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{feedback.title}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      feedback.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      feedback.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      feedback.status === 'resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {FEEDBACK_STATUS_LABELS[feedback.status]}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      feedback.type === 'bug' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      feedback.type === 'feature' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                      feedback.type === 'improvement' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {FEEDBACK_TYPE_LABELS[feedback.type]}
                    </span>
                    {feedback.priority && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        feedback.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        feedback.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {PRIORITY_LABELS[feedback.priority]} Priority
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">{feedback.description}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Submitted: {new Date(feedback.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {feedback.status === 'pending' && (
                  <button
                    onClick={() => handleStatusChange(feedback.id, 'in_progress')}
                    className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Start Working
                  </button>
                )}
                {feedback.status === 'in_progress' && (
                  <button
                    onClick={() => handleStatusChange(feedback.id, 'resolved')}
                    className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Mark Resolved
                  </button>
                )}
                {feedback.status === 'resolved' && (
                  <button
                    onClick={() => handleStatusChange(feedback.id, 'closed')}
                    className="px-3 py-1 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Close
                  </button>
                )}
                {feedback.status === 'closed' && (
                  <button
                    onClick={() => handleStatusChange(feedback.id, 'pending')}
                    className="px-3 py-1 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
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