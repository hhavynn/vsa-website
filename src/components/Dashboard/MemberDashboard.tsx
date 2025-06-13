import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Event } from '../../types';
import { motion } from 'framer-motion';

// Define event type labels
const EVENT_TYPE_LABELS: Record<Event['event_type'], string> = {
  other: 'General Events',
  gbm: 'General Body Meeting',
  mixer: 'Mixer',
  winter_retreat: 'Winter Retreat',
  vcn: 'VCN',
  wildn_culture: 'Wild n\' Culture',
  external_event: 'External Event'
};

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  total?: number;
}

export function MemberDashboard() {
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [eventsAttended, setEventsAttended] = useState<Event[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        // Fetch user points
        const { data: pointsData, error: pointsError } = await supabase
          .from('user_points')
          .select('points')
          .eq('user_id', user.id)
          .single();

        if (pointsError) throw pointsError;
        setPoints(pointsData?.points || 0);

        // Fetch attended events
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('event_attendance')
          .select('event_id')
          .eq('user_id', user.id);

        if (attendanceError) throw attendanceError;

        if (attendanceData) {
          const eventIds = attendanceData.map(a => a.event_id);
          const { data: eventsData, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .in('id', eventIds);

          if (eventsError) throw eventsError;
          setEventsAttended(eventsData || []);
        }

        // Calculate achievements
        const gbmCount = eventsAttended.filter(e => e.event_type === 'gbm').length;
        const mixerCount = eventsAttended.filter(e => e.event_type === 'mixer').length;
        const vcnCount = eventsAttended.filter(e => e.event_type === 'vcn').length;
        const wildnCultureCount = eventsAttended.filter(e => e.event_type === 'wildn_culture').length;

        const newAchievements: Achievement[] = [
          {
            id: 'gbm_master',
            name: 'GBM Master',
            description: 'Attended 5 GBMs',
            icon: '🎓',
            unlocked: gbmCount >= 5,
            progress: gbmCount,
            total: 5
          },
          {
            id: 'social_butterfly',
            name: 'Social Butterfly',
            description: 'Attended 3 mixers',
            icon: '🦋',
            unlocked: mixerCount >= 3,
            progress: mixerCount,
            total: 3
          },
          {
            id: 'vcn_star',
            name: 'VCN Star',
            description: 'Participated in VCN',
            icon: '⭐',
            unlocked: vcnCount > 0
          },
          {
            id: 'vcn_attendee',
            name: 'VCN Attendee',
            description: 'Attended VCN as an audience member',
            icon: '🎭',
            unlocked: vcnCount > 0
          },
          {
            id: 'culture_enthusiast',
            name: 'Culture Enthusiast',
            description: 'Attended Wild n\' Culture',
            icon: '🎪',
            unlocked: wildnCultureCount > 0
          },
          {
            id: 'point_collector',
            name: 'Point Collector',
            description: 'Earned 100 points',
            icon: '🏆',
            unlocked: points >= 100,
            progress: points,
            total: 100
          }
        ];

        setAchievements(newAchievements);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user, eventsAttended]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Points Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-lg shadow-xl p-6"
        >
          <h2 className="text-2xl font-bold text-white mb-4">Points Earned</h2>
          <div className="text-4xl font-bold text-indigo-400">{points}</div>
          <p className="text-gray-400 mt-2">Keep attending events to earn more points!</p>
        </motion.div>

        {/* Events Attended Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800 rounded-lg shadow-xl p-6"
        >
          <h2 className="text-2xl font-bold text-white mb-4">Events Attended</h2>
          <div className="text-4xl font-bold text-indigo-400">{eventsAttended.length}</div>
          <div className="mt-4 space-y-2">
            {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => {
              const count = eventsAttended.filter(e => e.event_type === type).length;
              return (
                <div key={type} className="flex justify-between text-gray-300">
                  <span>{label}</span>
                  <span>{count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Achievements Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 lg:col-span-3 text-gray-900 dark:text-white"
        >
          <h2 className="text-2xl font-bold text-white mb-4">Achievements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg ${
                  achievement.unlocked
                    ? 'bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-500 text-gray-900 dark:text-white'
                    : 'bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{achievement.icon}</span>
                  <div>
                    <h3 className="font-semibold text-white">{achievement.name}</h3>
                    <p className="text-sm text-gray-400">{achievement.description}</p>
                    {achievement.progress !== undefined && achievement.total && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-indigo-500 h-2 rounded-full"
                            style={{
                              width: `${Math.min(
                                (achievement.progress / achievement.total) * 100,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {achievement.progress}/{achievement.total}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
} 