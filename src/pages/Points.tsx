import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckInCodeInput } from '../components/features/points/CheckInCodeInput';
import { PageLoader } from '../components/common/PageLoader';
import { PageError } from '../components/common/PageError';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';

export default function Points() {
  const [points, setPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPoints = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Please sign in to view your points'); return; }
      const { data, error } = await supabase
        .from('user_points')
        .select('total_points')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      setPoints(data?.total_points || 0);
    } catch {
      setError('Failed to fetch points');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPoints(); }, []);

  if (loading) return <PageLoader message="Loading your points..." />;
  if (error) return <PageError message={error} resetError={fetchPoints} />;

  return (
    <>
      <PageTitle title="Points" />

      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>Points</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>Your earned points and event check-in</p>
      </div>

      <div style={{ padding: '40px 52px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 720 }}>
          <div className="border rounded p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <Label className="mb-3">Your Points</Label>
            <p className="font-serif leading-none tracking-[-0.04em] text-brand-600 dark:text-brand-400" style={{ fontSize: 64 }}>
              {points}
            </p>
            <p className="font-sans text-xs mt-2" style={{ color: 'var(--color-text3)' }}>total points earned</p>
          </div>

          <div>
            <CheckInCodeInput onPointsAdded={fetchPoints} />
          </div>
        </div>
      </div>
    </>
  );
}
