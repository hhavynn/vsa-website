import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { SignInForm } from '../components/Auth/SignInForm';
import { SignUpForm } from '../components/Auth/SignUpForm';
import { CheckInCodeInput } from '../components/Points/CheckInCodeInput';
import { supabase } from '../lib/supabase';
import { EventCard } from '../components/Event/EventCard';
import { useEvents } from '../hooks/useEvents';
import { PageTitle } from '../components/PageTitle';
import { motion } from 'framer-motion';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function Home() {
  const { user } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { events, loading: eventsLoading, error: eventsError } = useEvents();
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const fetchUserName = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
          return;
        }

        if (profile) {
          setUserName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'there');
        }
      } catch (err) {
        console.error('Error fetching user name:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserName();

    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(date.toLocaleDateString(undefined, options));
  }, [user]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );

  return (
    <>
      <PageTitle title="Home" />
      <div className="min-h-screen bg-gray-950 text-white pb-12 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {user ? (
            <div className="space-y-8">
              {/* Welcome Section */}
              <div className="relative rounded-2xl p-8 overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #2D3748 0%, #1A202C 100%)',
                  backgroundImage: 'url(/images/waves-bg.svg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-70"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-center md:justify-between text-center md:text-left">
                  <div>
                    <p className="text-gray-300 text-lg mb-2 text-center md:text-left">{currentDate}</p>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4">
                      Welcome to VSA, {userName || 'there'}!
                    </h1>
                  </div>
                  <img src="/images/vsa-logo.png" alt="VSALogo" className="h-24 md:h-40 w-auto mt-4 md:mt-0" loading="lazy" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Mission Statement Box (Left) */}
                <RevealOnScrollWrapper>
                  <div className="bg-gray-900 rounded-2xl shadow-xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Mission Statement</h2>
                    <p className="text-gray-300">
                      The Vietnamese Student Association of UCSD strives to promote and preserve the Vietnamese culture. We are dedicated to providing resources and a safe space for students to unite as a Vietnamese-American community. This organization is for nonprofit.
                    </p>
                  </div>
                </RevealOnScrollWrapper>

                {/* Event Check-in Section (Middle) */}
                <RevealOnScrollWrapper>
                  <div className="bg-gray-900 rounded-2xl shadow-xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Event Check-in</h2>
                    <CheckInCodeInput />
                  </div>
                </RevealOnScrollWrapper>

                {/* Our 4 Pillars Box (Right) */}
                <RevealOnScrollWrapper>
                  <div className="bg-gray-900 rounded-2xl shadow-xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Our 4 Pillars</h2>
                    <ul className="list-disc list-inside text-gray-300 space-y-2">
                      <li><span className="font-semibold text-white">Social:</span> meeting new people and building bonds with one another such as the ACE Program and House System</li>
                      <li><span className="font-semibold text-white">Cultural:</span> stay in touch with cultural roots through our events such as Vietnamese Culture Night and Black April</li>
                      <li><span className="font-semibold text-white">Community:</span> continue to strive to create a supportive and cooperative community for those of Vietnamese and non-Vietnamese descent</li>
                      <li><span className="font-semibold text-white">Academic:</span> main priority of obtaining good grades and graduating within a reasonable amount of time</li>
                    </ul>
                  </div>
                </RevealOnScrollWrapper>
              </div>

              {/* Upcoming Events Section */}
              <RevealOnScrollWrapper>
                <div className="mt-8 bg-gray-900 rounded-2xl shadow-xl p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Upcoming Events</h2>
                    <motion.a
                      href="/events"
                      className="text-indigo-400 hover:text-indigo-300 transition-colors duration-200"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      See all events &gt;
                    </motion.a>
                  </div>
                  {eventsLoading ? (
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                    </div>
                  ) : eventsError ? (
                    <div className="text-center text-red-400 bg-red-900/20 p-4 rounded-lg">
                      Error loading events: {eventsError.message}
                    </div>
                  ) : events.length === 0 ? (
                    <div className="bg-gray-800 shadow-xl rounded-lg p-6">
                      <p className="text-gray-300">No events scheduled at this time.</p>
                      <p className="text-gray-300 mt-2">Check back soon for upcoming events!</p>
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {events
                        .slice()
                        .sort((a, b) => {
                          const now = new Date();
                          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                          const dateA = new Date(a.date);
                          const dateB = new Date(b.date);
                          
                          // If both events are in the past (more than 1 day ago), sort by most recent first
                          if (dateA < oneDayAgo && dateB < oneDayAgo) {
                            return dateB.getTime() - dateA.getTime();
                          }
                          
                          // If one event is in the past and one is upcoming, put upcoming first
                          if (dateA < oneDayAgo) return 1;
                          if (dateB < oneDayAgo) return -1;
                          
                          // If both events are upcoming, sort by earliest first
                          return dateA.getTime() - dateB.getTime();
                        })
                        .map(event => (
                          <EventCard
                            key={event.id}
                            event={event}
                            onCheckIn={() => {}}
                          />
                        ))}
                    </div>
                  )}
                </div>
              </RevealOnScrollWrapper>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto py-12">
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-white mb-4">
                  Welcome to VSA
                </h1>
                <p className="text-xl text-gray-300">
                  Sign in or create an account to start earning points and participating in events.
                </p>
              </div>
              <div className="bg-gray-800 rounded-2xl shadow-xl p-8">
                {showSignUp ? (
                  <>
                    <SignUpForm />
                    <p className="mt-6 text-center text-gray-400">
                      Already have an account?{' '}
                      <motion.button
                        onClick={() => setShowSignUp(false)}
                        className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors duration-200"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Sign In
                      </motion.button>
                    </p>
                  </>
                ) : (
                  <>
                    <SignInForm />
                    <p className="mt-6 text-center text-gray-400">
                      Don't have an account?{' '}
                      <motion.button
                        onClick={() => setShowSignUp(true)}
                        className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors duration-200"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Sign Up
                      </motion.button>
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 