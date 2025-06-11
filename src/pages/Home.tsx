import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { SignInForm } from '../components/Auth/SignInForm';
import { SignUpForm } from '../components/Auth/SignUpForm';
import { CheckInCodeInput } from '../components/Points/CheckInCodeInput';
import { supabase } from '../lib/supabase';

export function Home() {
  const { user } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        if (profile) {
          setUserName(`${profile.first_name} ${profile.last_name}`);
        }
      } catch (err) {
        console.error('Error fetching user name:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserName();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-4xl font-bold text-center mb-8">Welcome to VSA</h1>
        
        {user ? (
          <div className="space-y-8">
            <div className="text-center">
              <p className="text-xl mb-4">Hello, {userName || 'there'}!</p>
              <p className="text-gray-600 mb-6">You are signed in and ready to participate in events.</p>
              <div className="flex justify-center space-x-4">
                <a
                  href="/events"
                  className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition-colors"
                >
                  View Events
                </a>
                <a
                  href="/profile"
                  className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 transition-colors"
                >
                  View Profile
                </a>
              </div>
            </div>
            
            <div className="max-w-md mx-auto">
              <CheckInCodeInput />
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-xl mb-8">Please sign in or create an account to access events and track your points.</p>
            <div className="max-w-md mx-auto">
              {showSignUp ? (
                <>
                  <SignUpForm />
                  <p className="mt-4 text-gray-600">
                    Already have an account?{' '}
                    <button
                      onClick={() => setShowSignUp(false)}
                      className="text-indigo-600 hover:text-indigo-500"
                    >
                      Sign In
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <SignInForm />
                  <p className="mt-4 text-gray-600">
                    Don't have an account?{' '}
                    <button
                      onClick={() => setShowSignUp(true)}
                      className="text-indigo-600 hover:text-indigo-500"
                    >
                      Sign Up
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 