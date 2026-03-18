import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AdminNav } from '../../components/features/admin/AdminNav';
import toast, { Toaster } from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardRow {
  id: string;
  first_name: string;
  last_name: string;
  points: number;
  events_attended: number;
}

interface CheckIn {
  member_id: string;
  member_name: string;
  event_name: string;
  event_date: string;
  points_earned: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPoints() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [checkIns, setCheckIns]       = useState<CheckIn[]>([]);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [eventsThisMonth, setEventsThisMonth] = useState<number>(0);
  const [nextEvent, setNextEvent]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Top 10 by points
        const { data: lb, error: lbErr } = await supabase
          .from('members')
          .select('id, first_name, last_name, points, events_attended')
          .order('points', { ascending: false })
          .limit(10);
        if (lbErr) throw lbErr;
        setLeaderboard((lb ?? []) as LeaderboardRow[]);

        // Total points across all members
        const { data: totals, error: totErr } = await supabase
          .from('members')
          .select('points');
        if (!totErr && totals) {
          setTotalPoints(totals.reduce((s, m: any) => s + (m.points ?? 0), 0));
        }

        // Events this month + next upcoming
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const { data: monthEvents, error: evErr } = await supabase
          .from('events')
          .select('name, date')
          .gte('date', monthStart.toISOString())
          .lt('date', monthEnd.toISOString())
          .order('date', { ascending: true });
        if (!evErr && monthEvents) {
          setEventsThisMonth(monthEvents.length);
          const upcoming = (monthEvents as any[]).find(e => new Date(e.date) > new Date());
          if (upcoming) {
            const daysAway = Math.ceil((new Date(upcoming.date).getTime() - Date.now()) / 86400000);
            setNextEvent(`Next: ${upcoming.name} in ${daysAway} day${daysAway !== 1 ? 's' : ''}`);
          }
        }

        // Recent check-ins (last 20)
        const { data: ci, error: ciErr } = await supabase
          .from('member_event_attendance')
          .select('member_id, points_earned, members(first_name, last_name), events(name, date)')
          .order('created_at', { ascending: false })
          .limit(20);
        if (!ciErr && ci) {
          setCheckIns(
            (ci as any[]).map(row => ({
              member_id:    row.member_id,
              member_name:  `${row.members?.first_name ?? ''} ${row.members?.last_name ?? ''}`.trim(),
              event_name:   row.events?.name ?? '(unknown event)',
              event_date:   row.events?.date ?? '',
              points_earned: row.points_earned,
            }))
          );
        }
      } catch {
        toast.error('Failed to load points data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const topEarner = leaderboard[0];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="py-6">
      <Toaster position="top-right" />

        {/* PAGE HEADER */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[22px] font-bold text-zinc-900 dark:text-[#fafafa]">Points Overview</h1>
        </div>

        {loading ? (
          <div className="py-20 text-center text-zinc-400 text-[13px]">Loading…</div>
        ) : (
          <div className="flex gap-8 items-start">
            {/* ── MAIN COLUMN ── */}
            <div className="flex-1 min-w-0">
              {/* KPI CARDS */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {/* Total Points */}
                <div className="border border-zinc-200 dark:border-[#27272a] rounded-md px-5 py-4 bg-white dark:bg-[#18181b]">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-2">Total Points Distributed</p>
                  <p className="text-[32px] font-bold text-zinc-900 dark:text-zinc-50 leading-none">{totalPoints.toLocaleString()}</p>
                </div>

                {/* Top Earner */}
                <div className="border border-zinc-200 dark:border-[#27272a] rounded-md px-5 py-4 bg-white dark:bg-[#18181b]">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-2">Top Earner</p>
                  {topEarner ? (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">
                        {initials(topEarner.first_name, topEarner.last_name)}
                      </div>
                      <div>
                        <p className="text-[20px] font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
                          {topEarner.first_name} {topEarner.last_name}
                        </p>
                        <p className="text-[12px] text-zinc-500">{topEarner.points} pts total</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-[13px]">No data</p>
                  )}
                </div>

                {/* Events This Month */}
                <div className="border border-zinc-200 dark:border-[#27272a] rounded-md px-5 py-4 bg-white dark:bg-[#18181b]">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-2">Events This Month</p>
                  <p className="text-[32px] font-bold text-zinc-900 dark:text-zinc-50 leading-none">{eventsThisMonth}</p>
                  {nextEvent && <p className="text-[12px] text-zinc-500 mt-1">{nextEvent}</p>}
                </div>
              </div>

              {/* LEADERBOARD TABLE */}
              <div className="mb-8">
                <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Top 10 Leaderboard</p>
                <div className="border border-zinc-200 dark:border-[#27272a] rounded-md overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-[#27272a] border-b border-zinc-200 dark:border-[#3f3f46]">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide w-16">Rank</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Name</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Total Pts</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Events</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-[#18181b] divide-y divide-zinc-100 dark:divide-[#27272a]">
                      {leaderboard.map((m, i) => {
                        const rank = i + 1;
                        const isTop = rank === 1;
                        return (
                          <tr
                            key={m.id}
                            className={`transition-colors ${
                              isTop
                                ? 'bg-[#eef2ff] dark:bg-indigo-950/30 border-l-2 border-l-indigo-600'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <span className={`font-bold ${
                                rank === 1 ? 'text-zinc-900 dark:text-zinc-50 text-[15px]' :
                                rank <= 3  ? 'text-zinc-600 dark:text-zinc-300' :
                                             'text-zinc-400 dark:text-zinc-500'
                              }`}>
                                #{rank}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">
                                  {initials(m.first_name, m.last_name)}
                                </div>
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {m.first_name} {m.last_name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100">{m.points.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">{m.events_attended}</td>
                          </tr>
                        );
                      })}
                      {leaderboard.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-zinc-400 text-[13px]">No data yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RECENT CHECK-INS */}
              <div>
                <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Recent Check-ins</p>
                <div className="border border-zinc-200 dark:border-[#27272a] rounded-md overflow-hidden">
                  {checkIns.length === 0 ? (
                    <div className="px-4 py-8 text-center text-zinc-400 text-[13px]">No check-ins yet.</div>
                  ) : (
                    <div className="bg-white dark:bg-[#18181b] divide-y divide-zinc-100 dark:divide-[#27272a]">
                      {checkIns.map((ci, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <div>
                            <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{ci.member_name}</p>
                            <p className="text-[12px] text-zinc-400">{ci.event_name}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[12px] text-zinc-400">
                              {ci.event_date ? relativeTime(ci.event_date) : '—'}
                            </span>
                            <span className="text-[12px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded px-2 py-0.5">
                              +{ci.points_earned} pts
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── SIDEBAR ── */}
            <div className="w-72 shrink-0">
              {/* QUICK ACTIONS */}
              <div className="border border-zinc-200 dark:border-[#27272a] rounded-md overflow-hidden">
                <div className="bg-zinc-50 dark:bg-[#27272a] px-4 py-3 border-b border-zinc-200 dark:border-[#3f3f46]">
                  <p className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wide">Quick Actions</p>
                </div>
                <div className="bg-white dark:bg-[#18181b] divide-y divide-zinc-100 dark:divide-[#27272a]">
                  <Link
                    to="/admin/members"
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                  >
                    <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">View All Members</span>
                    <svg className="w-4 h-4 text-indigo-500 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    to="/admin/import"
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                  >
                    <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Import Attendance</span>
                    <svg className="w-4 h-4 text-indigo-500 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    to="/admin/events"
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                  >
                    <div>
                      <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Manage Events</span>
                    </div>
                    <svg className="w-4 h-4 text-indigo-500 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    to="/admin/merge-suggestions"
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                  >
                    <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Review Merge Suggestions</span>
                    <svg className="w-4 h-4 text-indigo-500 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
