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
import toast, { Toaster } from 'react-hot-toast';

interface AttendanceRecord extends EventAttendance {
  event: Event;
}

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  college: string | null;
  year: string | null;
}

const UCSD_COLLEGES = [
  'Revelle College',
  'Muir College',
  'Marshall College',
  'Eleanor Roosevelt College',
  'Roosevelt College',
  'Sixth College',
  'Seventh College',
  'Eighth College',
];

const YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year+',
  '1st Year Transfer',
  '2nd Year Transfer',
];

const inputCls = 'w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500';
const labelCls = 'block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1';

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

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', college: '', year: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('first_name, last_name, college, year')
          .eq('id', user.id)
          .single();
        if (error) throw error;
        setUserProfile(data);
        setEditForm({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          college: data.college ?? '',
          year: data.year ?? '',
        });
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

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          college: editForm.college || null,
          year: editForm.year || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (error) throw error;
      setUserProfile({
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        college: editForm.college || null,
        year: editForm.year || null,
      });
      setEditOpen(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error('Failed to save profile.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-zinc-400">Please sign in to view your profile.</p>
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
      <Toaster position="top-right" />

      {/* Profile Header */}
      <RevealOnScrollWrapper>
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] rounded-md p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div onClick={(e) => e.stopPropagation()}>
              <Avatar size="lg" showUploadButton={true} />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-1">{displayName}</h1>
              <p className="text-zinc-500 text-sm mb-1">{user.email}</p>
              {(userProfile?.college || userProfile?.year) && (
                <p className="text-zinc-400 text-sm mb-3">
                  {[userProfile.year, userProfile.college].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="flex flex-wrap gap-3 justify-center sm:justify-start mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-amber-500/20 bg-amber-500/10">
                  <svg className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-amber-400 text-sm font-semibold">{points} pts</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700">
                  <svg className="w-4 h-4 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-zinc-600 dark:text-zinc-400 text-sm font-semibold">{stats.totalEvents} events</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-emerald-500/20 bg-emerald-500/10">
                  <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-emerald-400 text-sm font-semibold">{stats.eventsThisMonth} this month</span>
                </div>
              </div>
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 px-3 py-1.5 rounded transition-colors duration-150"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </RevealOnScrollWrapper>

      {/* Member Dashboard */}
      <MemberDashboard />

      {/* Attendance History */}
      <RevealOnScrollWrapper>
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] rounded-md p-6 mt-8">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-5">Event History</h2>
          {attendance.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-zinc-500 mb-1">No events attended yet.</p>
              <p className="text-zinc-400 text-sm">Check out our upcoming events!</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {attendance.map((record) =>
                record.event && (
                  <div
                    key={record.id}
                    className="flex-shrink-0 w-56 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-4"
                  >
                    <span className="inline-block px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      {EVENT_TYPE_LABELS[record.event.event_type]}
                    </span>
                    <h3 className="text-zinc-900 dark:text-zinc-50 text-sm font-semibold mb-1 line-clamp-2">
                      {record.event.name}
                    </h3>
                    <p className="text-zinc-500 text-xs mb-2">
                      {format(new Date(record.event.date), 'MMM d, yyyy')}
                    </p>
                    <p className="text-emerald-500 text-xs font-medium">
                      +{record.points_earned} pts
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </RevealOnScrollWrapper>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Edit Profile</h2>
              <button onClick={() => setEditOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>College</label>
                <select
                  value={editForm.college}
                  onChange={(e) => setEditForm(f => ({ ...f, college: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Select college —</option>
                  {UCSD_COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Year</label>
                <select
                  value={editForm.year}
                  onChange={(e) => setEditForm(f => ({ ...f, year: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Select year —</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <p className="text-xs text-zinc-500 leading-relaxed pt-1">
                Your college and year are used to accurately match your attendance from event sign-in sheets.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-medium py-2.5 rounded text-sm transition-colors duration-150"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditOpen(false)}
                className="px-4 py-2.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 text-sm transition-colors duration-150"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
