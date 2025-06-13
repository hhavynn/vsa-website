import { useAuth } from '../hooks/useAuth';
import { useEventAttendance } from '../hooks/useEventAttendance';
import { usePoints } from '../hooks/usePoints';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Event, EventAttendance } from '../types';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';
import { MemberDashboard } from '../components/Dashboard/MemberDashboard';

interface AttendanceRecord extends EventAttendance {
  event: Event;
}

export function Profile() {
  const { user } = useAuth();
  const { getUserAttendance, loading, error } = useEventAttendance();
  const { points } = usePoints();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    eventsThisMonth: 0,
    badgesEarned: 0
  });

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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-white">Profile</h1>
      
      {/* Member Dashboard */}
      <MemberDashboard />

      {/* Rest of the profile content */}
      <RevealOnScrollWrapper>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-white">Event Attendance History</h2>
            {attendance.length === 0 ? (
              <p className="text-gray-400">No events attended yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex space-x-4 pb-4">
                  {attendance.map((record) => (
                    record.event && (
                      <div
                        key={record.id}
                        className="flex-shrink-0 w-64 bg-gray-700 rounded-lg p-4"
                      >
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {record.event.name}
                        </h3>
                        <p className="text-sm text-gray-300 mb-2">
                          {format(new Date(record.event.date), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-gray-400 mb-2">
                          Type: {record.event.event_type.replace(/_/g, ' ').toUpperCase()}
                        </p>
                        <p className="text-sm text-green-400">
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