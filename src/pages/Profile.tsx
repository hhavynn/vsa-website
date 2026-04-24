import { useAuth } from '../hooks/useAuth';
import { useEventAttendance } from '../hooks/useEventAttendance';
import { usePoints } from '../hooks/usePoints';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Event, EventAttendance } from '../types';
import { MemberDashboard } from '../components/features/dashboard/MemberDashboard';
import { Avatar } from '../components/features/avatar/Avatar';
import { PageLoader } from '../components/common/PageLoader';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
import { supabase } from '../lib/supabase';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import toast, { Toaster } from 'react-hot-toast';

interface AttendanceRecord extends EventAttendance { event: Event; }

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  college: string | null;
  year: string | null;
}

const UCSD_COLLEGES = [
  'Revelle College','Muir College','Marshall College','Eleanor Roosevelt College',
  'Roosevelt College','Sixth College','Seventh College','Eighth College',
];
const YEARS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year+','1st Year Transfer','2nd Year Transfer'];

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  background: 'var(--color-surface)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 4, outline: 'none',
};

export function Profile() {
  const { user } = useAuth();
  const { getUserAttendance, loading, error } = useEventAttendance();
  const { points } = usePoints();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ totalEvents: 0, eventsThisMonth: 0 });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', college: '', year: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('first_name, last_name, college, year')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setUserProfile(data);
          setEditForm({ first_name: data.first_name ?? '', last_name: data.last_name ?? '', college: data.college ?? '', year: data.year ?? '' });
        }
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getUserAttendance(user.id).then(data => {
      if (data) {
        const valid = data.filter(r => r.event != null);
        setAttendance(valid);
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        setStats({ totalEvents: valid.length, eventsThisMonth: valid.filter(r => new Date(r.event.date) >= start).length });
      }
    });
  }, [user, getUserAttendance]);

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('user_profiles').update({
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        college: editForm.college || null,
        year: editForm.year || null,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      if (error) throw error;
      setUserProfile({ first_name: editForm.first_name.trim(), last_name: editForm.last_name.trim(), college: editForm.college || null, year: editForm.year || null });
      setEditOpen(false);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>Please sign in to view your profile.</p>
    </div>
  );
  if (loading) return <PageLoader message="Loading profile..." />;
  if (error) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>Error: {error.message}</p>
    </div>
  );

  const displayName = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name} ${userProfile.last_name}`
    : user.email;

  return (
    <>
      <PageTitle title="Profile" />
      <Toaster position="top-right" />

      {/* Page header */}
      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <div className="flex items-center gap-5">
          <div onClick={e => e.stopPropagation()}>
            <Avatar size="lg" showUploadButton />
          </div>
          <div>
            <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 36, color: 'var(--color-text)' }}>
              {displayName}
            </h1>
            <p className="font-sans text-sm mt-1" style={{ color: 'var(--color-text2)' }}>{user.email}</p>
            {(userProfile?.college || userProfile?.year) && (
              <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text3)' }}>
                {[userProfile.year, userProfile.college].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mt-5">
          <div>
            <span className="font-serif" style={{ fontSize: 28, color: 'var(--color-text)' }}>{points}</span>
            <span className="font-sans text-xs ml-1.5" style={{ color: 'var(--color-text3)' }}>points</span>
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />
          <div>
            <span className="font-serif" style={{ fontSize: 28, color: 'var(--color-text)' }}>{stats.totalEvents}</span>
            <span className="font-sans text-xs ml-1.5" style={{ color: 'var(--color-text3)' }}>events attended</span>
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />
          <div>
            <span className="font-serif" style={{ fontSize: 28, color: 'var(--color-text)' }}>{stats.eventsThisMonth}</span>
            <span className="font-sans text-xs ml-1.5" style={{ color: 'var(--color-text3)' }}>this month</span>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={() => setEditOpen(true)}
              className="font-sans text-xs border rounded px-3 py-1.5 transition-colors duration-150"
              style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent', cursor: 'pointer' }}
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '40px 52px' }}>
        {/* Member Dashboard */}
        <MemberDashboard />

        {/* Event History */}
        {attendance.length > 0 && (
          <div className="mt-8">
            <Label className="mb-4">Event History · {attendance.length}</Label>
            <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              {attendance.map((record) => record.event && (
                <div
                  key={record.id}
                  className="flex items-center justify-between border-b last:border-b-0"
                  style={{ padding: '12px 20px', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="font-mono text-[10px] tracking-[.04em] shrink-0"
                      style={{ color: 'var(--color-text3)', width: 56 }}
                    >
                      {format(new Date(record.event.date), 'MMM d').toUpperCase()}
                    </span>
                    <div>
                      <div className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {record.event.name}
                      </div>
                      <div className="font-sans text-[11px] mt-0.5" style={{ color: 'var(--color-text3)' }}>
                        {EVENT_TYPE_LABELS[record.event.event_type]}
                      </div>
                    </div>
                  </div>
                  <span className="font-sans text-xs font-medium text-brand-600 dark:text-brand-400">
                    +{record.points_earned} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEditOpen(false)}>
          <div
            className="w-full max-w-md border rounded shadow-xl"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Edit Profile</h2>
              <button onClick={() => setEditOpen(false)} style={{ color: 'var(--color-text3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Label className="mb-1.5">First Name</Label>
                  <input type="text" value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <Label className="mb-1.5">Last Name</Label>
                  <input type="text" value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <Label className="mb-1.5">College</Label>
                <select value={editForm.college} onChange={e => setEditForm(f => ({ ...f, college: e.target.value }))} style={inputStyle}>
                  <option value="">— Select college —</option>
                  {UCSD_COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1.5">Year</Label>
                <select value={editForm.year} onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))} style={inputStyle}>
                  <option value="">— Select year —</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                Your college and year are used to accurately match your attendance from event sign-in sheets.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 font-sans text-sm font-medium rounded py-2.5 transition-colors duration-150 disabled:opacity-40"
                style={{ background: 'var(--color-text)', color: 'var(--color-bg)', cursor: saving ? 'default' : 'pointer', border: 'none' }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditOpen(false)}
                className="font-sans text-sm rounded border px-4 py-2.5 transition-colors duration-150"
                style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
