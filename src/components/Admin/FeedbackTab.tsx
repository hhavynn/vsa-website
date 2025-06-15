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
}

const FeedbackTab: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleResolve = async (id: number) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status: 'resolved' })
        .eq('id', id);
      if (error) throw error;
      toast.success('Feedback resolved');
      fetchFeedbacks();
    } catch (error) {
      console.error('Error resolving feedback:', error);
      toast.error('Failed to resolve feedback');
    }
  };

  if (loading) {
    return <div>Loading feedbacks...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Feedback</h2>
      {feedbacks.filter(fb => fb.status !== 'resolved').length === 0 ? (
        <p>No feedback available.</p>
      ) : (
        <ul className="space-y-4">
          {feedbacks.filter(fb => fb.status !== 'resolved').map((feedback) => (
            <li key={feedback.id} className="border p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{feedback.title}</h3>
                  <p className="text-sm text-gray-600">{feedback.description}</p>
                  <p className="text-xs text-gray-500">Type: {feedback.type}</p>
                  <p className="text-xs text-gray-500">Created: {new Date(feedback.created_at).toLocaleString()}</p>
                </div>
                {feedback.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolve(feedback.id)}
                    className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FeedbackTab; 