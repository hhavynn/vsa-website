import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';
import { Event } from '../../../types';
import { motion } from 'framer-motion';
import { EVENT_TYPE_LABELS } from '../../../constants/eventTypes';

interface Achievement {
  id: string;
  name: string;
  description: string;
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
        const { data: pointsData, error: pointsError } = await supabase
          .from('user_points')
          .select('total_points')
          .eq('user_id', user.id)
          .single();

        if (pointsError) throw pointsError;
        const currentPoints = pointsData?.total_points || 0;
        setPoints(currentPoints);

        const { data: attendanceData, error: attendanceError } = await supabase
          .from('event_attendance')
          .select('event_id')
          .eq('user_id', user.id);

        if (attendanceError) throw attendanceError;

        let eventsData: Event[] = [];
        if (attendanceData && attendanceData.length > 0) {
          const eventIds = attendanceData.map(a => a.event_id);
          const { data: fetchedEvents, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .in('id', eventIds);

          if (eventsError) throw eventsError;
          eventsData = fetchedEvents || [];
          setEventsAttended(eventsData);
        }

        const gbmCount = eventsData.filter(e => e.event_type === 'gbm').length;
        const mixerCount = eventsData.filter(e => e.event_type === 'mixer').length;
        const vcnCount = eventsData.filter(e => e.event_type === 'vcn').length;
        const wildnCultureCount = eventsData.filter(e => e.event_type === 'wildn_culture').length;

        const newAchievements: Achievement[] = [
          {
            id: 'gbm_master',
            name: 'GBM Master',
            description: 'Attended 5 GBMs',
            unlocked: gbmCount >= 5,
            progress: gbmCount,
            total: 5
          },
          {
            id: 'social_butterfly',
            name: 'Social Butterfly',
            description: 'Attended 3 mixers',
            unlocked: mixerCount >= 3,
            progress: mixerCount,
            total: 3
          },
          {
            id: 'vcn_star',
            name: 'VCN Star',
            description: 'Participated in VCN',
            unlocked: vcnCount > 0
          },
          {
            id: 'vcn_attendee',
            name: 'VCN Attendee',
            description: 'Attended VCN as an audience member',
            unlocked: vcnCount > 0
          },
          {
            id: 'culture_enthusiast',
            name: 'Culture Enthusiast',
            description: "Attended Wild n' Culture",
            unlocked: wildnCultureCount > 0
          },
          {
            id: 'point_collector',
            name: 'Point Collector',
            description: 'Earned 100 points',
            unlocked: currentPoints >= 100,
            progress: currentPoints,
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
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Points Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] rounded-md p-6"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-4">Points Earned</h2>
        <div className="text-4xl font-bold text-brand-600 dark:text-brand-400">{points}</div>
        <p className="text-zinc-500 text-sm mt-2">Keep attending events to earn more points!</p>
      </motion.div>

      {/* Events Attended Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] rounded-md p-6"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-4">Events Attended</h2>
        <div className="text-4xl font-bold text-brand-600 dark:text-brand-400">{eventsAttended.length}</div>
        <div className="mt-4 space-y-2">
          {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => {
            const count = eventsAttended.filter(e => e.event_type === type).length;
            return (
              <div key={type} className="flex justify-between text-zinc-600 dark:text-zinc-400 text-sm">
                <span>{label}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{count}</span>
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
        className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] rounded-md p-6"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-4">Achievements</h2>
        <div className="space-y-3">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`p-3 rounded border ${
                achievement.unlocked
                  ? 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40'
                  : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded border ${
                  achievement.unlocked
                    ? 'border-zinc-300 dark:border-zinc-600'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}>
                  <svg
                    className={`w-4 h-4 ${
                      achievement.unlocked
                        ? 'text-zinc-700 dark:text-zinc-300'
                        : 'text-zinc-300 dark:text-zinc-600'
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
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-medium ${
                    achievement.unlocked
                      ? 'text-zinc-900 dark:text-zinc-50'
                      : 'text-zinc-500'
                  }`}>
                    {achievement.name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {achievement.description}
                  </p>
                  {achievement.progress !== undefined && (
                    <div className="mt-1.5">
                      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded">
                        <div
                          className="h-1.5 bg-brand-600 rounded"
                          style={{
                            width: `${Math.min((achievement.progress / (achievement.total || 1)) * 100, 100)}%`
                          }}
                        />
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
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
  );
}
