import { useAuth } from '../hooks/useAuth';
import { useEventAttendance } from '../hooks/useEventAttendance';
import { usePoints } from '../hooks/usePoints';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Event, EventAttendance } from '../types';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';
import { MemberDashboard } from '../components/Dashboard/MemberDashboard';
import { Avatar } from '../components/Avatar/Avatar';
import { supabase } from '../lib/supabase';

interface AttendanceRecord extends EventAttendance {
  event: Event;
}

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

export function Profile() {
  const { user } = useAuth();
  const { getUserAttendance, loading, error } = useEventAttendance();
  const { points } = usePoints();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({
    totalEvents: 0,
    eventsThisMonth: 0,
    badgesEarned: 0
  });

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setUserProfile(data);
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (user) {
        const data = await getUserAttendance(user.id);
        if (data) {
          // Filter out any records with missing event data
          const validRecords = data.filter(record => record.event != null);
          setAttendance(validRecords);
          
          // Calculate statistics
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          
          const eventsThisMonth = validRecords.filter(record => 
            record.event && new Date(record.event.date) >= firstDayOfMonth
          ).length;
          
          setStats({
            totalEvents: validRecords.length,
            eventsThisMonth,
            badgesEarned: 0 // Placeholder for future badges system
          });
        }
      }
    };
    fetchAttendance();
  }, [user, getUserAttendance]);

  if (!user) return <div>Please sign in to view your profile.</div>;
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const displayName = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name} ${userProfile.last_name}`
    : user.email;

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white transition-colors duration-300">
      <h1 className="text-3xl font-bold mb-8 text-white dark:text-gray-900">Profile</h1>
      
      {/* Profile Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
        <div className="flex items-center space-x-6">
          <div className="relative group" onClick={(e) => e.stopPropagation()}>
            <Avatar size="lg" showUploadButton={true} />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <div className="bg-black bg-opacity-50 rounded-full p-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-3 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              Click to upload photo
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">{displayName}</h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-lg font-medium text-gray-900 dark:text-white">{points} points</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span className="text-lg font-medium text-gray-900 dark:text-white">{stats.totalEvents} events attended</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Member Dashboard */}
      <MemberDashboard />

      {/* Event Attendance History */}
      <RevealOnScrollWrapper>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Event Attendance History</h2>
            {attendance.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No events attended yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex space-x-4 pb-4">
                  {attendance.map((record) => (
                    record.event && (
                      <div
                        key={record.id}
                        className="flex-shrink-0 w-64 bg-gray-100 dark:bg-gray-700 rounded-lg p-4"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {record.event.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          {format(new Date(record.event.date), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          Type: {record.event.event_type.replace(/_/g, ' ').toUpperCase()}
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Points Earned: {record.points_earned}
                        </p>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </RevealOnScrollWrapper>
    </div>
  );
} 