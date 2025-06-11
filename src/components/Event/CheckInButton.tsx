import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

type CheckInButtonProps = {
  eventId: string;
  onSuccess?: () => void;
};

export function CheckInButton({ eventId, onSuccess }: CheckInButtonProps) {
  const { user } = useAuth();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async () => {
    if (!user) {
      setError('Please sign in to sign up for events');
      return;
    }

    try {
      setIsCheckingIn(true);
      setError(null);

      const { error: checkInError } = await supabase
        .from('check_ins')
        .insert({
          user_id: user.id,
          event_id: eventId,
        });

      if (checkInError) throw checkInError;

      setIsCheckedIn(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (!user) {
    return (
      <button
        disabled
        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
      >
        Sign in to sign up
      </button>
    );
  }

  if (isCheckedIn) {
    return (
      <button
        disabled
        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 cursor-default"
      >
        ✓ Signed up!
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleCheckIn}
        disabled={isCheckingIn}
        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {isCheckingIn ? 'Signing up...' : 'Sign Up'}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
} 