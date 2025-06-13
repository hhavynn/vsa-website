import { useAuth } from '../hooks/useAuth';
import { useEventAttendance } from '../hooks/useEventAttendance';
import { usePoints } from '../hooks/usePoints';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';

export function Profile() {
  const { user } = useAuth();
  const { getUserAttendance, loading, error } = useEventAttendance();
  const { points } = usePoints();
  const [attendance, setAttendance] = useState<any[]>([]);
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
          setAttendance(data);
          
          // Calculate statistics
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          
          const eventsThisMonth = data.filter(record => 
            new Date(record.event.date) >= firstDayOfMonth
          ).length;
          
          setStats({
            totalEvents: data.length,
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
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Total Points</h3>
          <p className="text-3xl font-bold text-yellow-400">{points}</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Total Events</h3>
          <p className="text-3xl font-bold text-white">{stats.totalEvents}</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Events This Month</h3>
          <p className="text-3xl font-bold text-white">{stats.eventsThisMonth}</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Badges Earned</h3>
          <p className="text-3xl font-bold text-white">{stats.badgesEarned}</p>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-white">Event Attendance History</h2>
        {attendance.length === 0 ? (
          <p className="text-gray-400">No events attended yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex space-x-4 pb-4">
              {attendance.map((record) => (
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 