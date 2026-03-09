import { useAuth } from '../hooks/useAuth';
import { useEventAttendance } from '../hooks/useEventAttendance';
import { usePoints } from '../hooks/usePoints';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Event, EventAttendance } from '../types';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { MemberDashboard } from '../components/features/dashboard/MemberDashboard';
import { Avatar } from '../components/features/avatar/Avatar';
import { PageLoader } from '../components/common/PageLoader';
import { supabase } from '../lib/supabase';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';

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
          const validRecords = data.filter(record => record.event != null);
          setAttendance(validRecords);
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const eventsThisMonth = validRecords.filter(record =>
            record.event && new Date(record.event.date) >= firstDayOfMonth
          ).length;
          setStats({
            totalEvents: validRecords.length,
            eventsThisMonth,
            badgesEarned: 0
          });
        }
      }
    };
    fetchAttendance();
  }, [user, getUserAttendance]);

  if (!user) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-slate-400">Please sign in to view your profile.</p>
    </div>
  );
  if (loading) return <PageLoader message="Loading profile..." />;
  if (error) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-red-400">Error: {error.message}</p>
    </div>
  );

  const displayName = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name} ${userProfile.last_name}`
    : user.email;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Profile Header */}
      <RevealOnScrollWrapper>
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div onClick={(e) => e.stopPropagation()}>
              <Avatar size="lg" showUploadButton={true} />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="font-heading font-bold text-2xl text-white mb-1">{displayName}</h1>
              <p className="text-slate-500 text-sm mb-4">{user.email}</p>
              <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <svg className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-amber-400 text-sm font-semibold">{points} pts</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-indigo-400 text-sm font-semibold">{stats.totalEvents} events</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-emerald-400 text-sm font-semibold">{stats.eventsThisMonth} this month</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RevealOnScrollWrapper>

      {/* Member Dashboard */}
      <MemberDashboard />

      {/* Attendance History */}
      <RevealOnScrollWrapper>
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 mt-8">
          <h2 className="font-heading font-semibold text-lg text-white mb-5">Event History</h2>
          {attendance.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-slate-400 mb-1">No events attended yet.</p>
              <p className="text-slate-500 text-sm">Check out our upcoming events!</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {attendance.map((record) =>
                record.event && (
                  <div
                    key={record.id}
                    className="flex-shrink-0 w-56 rounded-xl bg-slate-800/60 border border-slate-700/60 p-4"
                  >
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600/20 text-indigo-400 mb-2">
                      {EVENT_TYPE_LABELS[record.event.event_type]}
                    </span>
                    <h3 className="text-white text-sm font-semibold mb-1 line-clamp-2">
                      {record.event.name}
                    </h3>
                    <p className="text-slate-500 text-xs mb-2">
                      {format(new Date(record.event.date), 'MMM d, yyyy')}
                    </p>
                    <p className="text-emerald-400 text-xs font-medium">
                      +{record.points_earned} pts
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </RevealOnScrollWrapper>
    </div>
  );
}
