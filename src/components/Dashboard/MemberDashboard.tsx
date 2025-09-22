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
  }, [user, eventsAttended, points]);

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
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6"
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Points Earned</h2>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{points}</div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Keep attending events to earn more points!</p>
        </motion.div>

        {/* Events Attended Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6"
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Events Attended</h2>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{eventsAttended.length}</div>
          <div className="mt-4 space-y-2">
            {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => {
              const count = eventsAttended.filter(e => e.event_type === type).length;
              return (
                <div key={type} className="flex justify-between text-gray-700 dark:text-gray-300">
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
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6"
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Achievements</h2>
          <div className="space-y-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg ${
                  achievement.unlocked
                    ? 'bg-indigo-50 dark:bg-indigo-900/50'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    achievement.unlocked
                      ? 'bg-indigo-100 dark:bg-indigo-800'
                      : 'bg-gray-200 dark:bg-gray-600'
                  }`}>
                    <svg
                      className={`w-6 h-6 ${
                        achievement.unlocked
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className={`font-semibold ${
                      achievement.unlocked
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {achievement.name}
                    </h3>
                    <p className={`text-sm ${
                      achievement.unlocked
                        ? 'text-gray-600 dark:text-gray-300'
                        : 'text-gray-500 dark:text-gray-500'
                    }`}>
                      {achievement.description}
                    </p>
                    {achievement.progress !== undefined && (
                      <div className="mt-2">
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                          <div
                            className="h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full"
                            style={{
                              width: `${(achievement.progress / (achievement.total || 1)) * 100}%`
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {achievement.progress} / {achievement.total}
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