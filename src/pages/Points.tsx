import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckInCodeInput } from '../components/features/points/CheckInCodeInput';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { PageLoader } from '../components/common/PageLoader';
import { PageError } from '../components/common/PageError';

export default function Points() {
  const [points, setPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPoints = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view your points');
        return;
      }

      const { data, error } = await supabase
        .from('user_points')
        .select('total_points')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setPoints(data?.total_points || 0);
    } catch (err) {
      console.error('Error fetching points:', err);
      setError('Failed to fetch points');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoints();
  }, []);

  if (loading) return <PageLoader message="Loading your points..." />;
  if (error) return <PageError message={error} resetError={fetchPoints} />;

  return (
    <RevealOnScrollWrapper>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Points</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Your Points</h2>
            <p className="text-4xl font-bold text-indigo-600">{points}</p>
          </div>

          <div>
            <CheckInCodeInput onPointsAdded={fetchPoints} />
          </div>
        </div>
      </div>
    </RevealOnScrollWrapper>
  );
}
