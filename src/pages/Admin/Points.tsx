import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { PageTitle } from '../../components/common/PageTitle';
import { useAcademicTerms } from '../../hooks/useAcademicTerms';
import { leaderboardRepository } from '../../data/repos/leaderboard';

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
  const { terms, loading: termsLoading } = useAcademicTerms();
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [checkIns, setCheckIns]       = useState<CheckIn[]>([]);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [eventsThisMonth, setEventsThisMonth] = useState<number>(0);
  const [nextEvent, setNextEvent]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(() => {
    return 'all';
  });

  // Group terms by academic year for the selector
  const academicYears = useMemo(() => {
    const years = new Map<number, string>();
    terms.forEach((term) => {
      if (!years.has(term.academic_year_start)) {
        years.set(term.academic_year_start, `${term.academic_year_start}-${term.academic_year_end}`);
      }
    });
    return Array.from(years.entries()).sort((a, b) => b[0] - a[0]);
  }, [terms]);

  // Set default year to active year or most recent year
  useEffect(() => {
    if (terms.length > 0 && selectedYear === 'all') {
      const activeTerm = terms.find((t) => t.is_active);
      if (activeTerm) {
        setSelectedYear(activeTerm.academic_year_start);
      } else {
        setSelectedYear(terms[0].academic_year_start);
      }
    }
  }, [terms, selectedYear]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let lb: LeaderboardRow[] = [];
      if (selectedYear === 'all') {
        const data = await leaderboardRepository.getAllTimeLeaderboard();
        lb = (data ?? []).slice(0, 10) as LeaderboardRow[];
        
        // Total points across all members (all-time)
        const { data: totals, error: totErr } = await supabase
          .from('members')
          .select('points');
        if (!totErr && totals) {
          setTotalPoints(totals.reduce((s, m: any) => s + (m.points ?? 0), 0));
        }
      } else {
        const data = await leaderboardRepository.getYearlyLeaderboard(selectedYear);
        lb = data.slice(0, 10).map(m => ({
          id: m.member_id,
          first_name: m.first_name,
          last_name: m.last_name,
          points: m.total_points,
          events_attended: m.events_attended,
        }));

        // Total points for the year
        setTotalPoints(data.reduce((s, m) => s + m.total_points, 0));
      }
      setLeaderboard(lb);

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
  }, [selectedYear]);

  useEffect(() => {
    if (selectedYear !== 'all' || terms.length > 0) {
      load();
    }
  }, [load, selectedYear, terms.length]);

  const topEarner = leaderboard[0];
  const selectedYearLabel = selectedYear === 'all' ? 'All-Time' : academicYears.find(([y]) => y === selectedYear)?.[1] || '';

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Points" />
      <Toaster position="top-right" />

      <div className="border-b" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Points</h1>
            <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>Points distribution and check-in history</p>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="h-8 rounded border bg-transparent px-2 font-sans text-xs font-medium outline-none transition-colors hover:border-zinc-400 focus:border-zinc-500"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <option value="all">All-Time</option>
            {academicYears.map(([year, label]) => (
              <option key={year} value={year}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">

        {loading && termsLoading ? (
          <div className="py-20 text-center text-[13px]" style={{ color: 'var(--color-text3)' }}>Loading...</div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_288px] items-start">
            {/* ── MAIN COLUMN ── */}
            <div className="flex-1 min-w-0">
              {/* KPI CARDS */}
              <div className="grid gap-4 mb-8 md:grid-cols-3">
                {/* Total Points */}
                <div className="border rounded-md px-5 py-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                    Total Points ({selectedYearLabel})
                  </p>
                  <p className="font-serif text-[32px] leading-none" style={{ color: 'var(--color-text)' }}>{totalPoints.toLocaleString()}</p>
                </div>

                {/* Top Earner */}
                <div className="border rounded-md px-5 py-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>Top Earner</p>
                  {topEarner ? (
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: 'var(--color-surface2)', color: 'var(--color-text2)' }}>
                        {initials(topEarner.first_name, topEarner.last_name)}
                      </div>
                      <div>
                        <p className="font-sans text-[20px] font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
                          {topEarner.first_name} {topEarner.last_name}
                        </p>
                        <p className="text-[12px]" style={{ color: 'var(--color-text2)' }}>{topEarner.points} pts {selectedYear === 'all' ? 'total' : 'this year'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px]" style={{ color: 'var(--color-text3)' }}>No data</p>
                  )}
                </div>

                {/* Events This Month */}
                <div className="border rounded-md px-5 py-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>Events This Month</p>
                  <p className="font-serif text-[32px] leading-none" style={{ color: 'var(--color-text)' }}>{eventsThisMonth}</p>
                  {nextEvent && <p className="mt-1 text-[12px]" style={{ color: 'var(--color-text2)' }}>{nextEvent}</p>}
                </div>
              </div>

              {/* LEADERBOARD TABLE */}
              <div className="mb-8">
                <p className="mb-3 text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>
                  Top 10 Standings ({selectedYearLabel})
                </p>
                <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                        <th className="w-16 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>Rank</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>Name</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>Points</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>Events</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                      {leaderboard.map((m, i) => {
                        const rank = i + 1;
                        const isTop = rank === 1;
                        return (
                          <tr
                            key={m.id}
                            className="transition-colors hover:opacity-95"
                            style={isTop ? { background: 'var(--color-surface2)', boxShadow: 'inset 2px 0 0 0 var(--color-primary)' } : undefined}
                          >
                            <td className="px-4 py-2.5">
                              <span
                                className={`font-bold ${rank === 1 ? 'text-[15px]' : ''}`}
                                style={{ color: rank === 1 ? 'var(--color-text)' : rank <= 3 ? 'var(--color-text2)' : 'var(--color-text3)' }}
                              >
                                #{rank}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{ background: 'var(--color-surface2)', color: 'var(--color-text2)' }}>
                                  {initials(m.first_name, m.last_name)}
                                </div>
                                <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                                  {m.first_name} {m.last_name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--color-text)' }}>{m.points.toLocaleString()}</td>
                            <td className="px-4 py-2.5" style={{ color: 'var(--color-text2)' }}>{m.events_attended}</td>
                          </tr>
                        );
                      })}
                      {leaderboard.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--color-text3)' }}>No data yet for this year.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RECENT CHECK-INS */}
              <div>
                <p className="mb-3 text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>Recent Check-ins</p>
                <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  {checkIns.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--color-text3)' }}>No check-ins yet.</div>
                  ) : (
                    <div className="divide-y" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                      {checkIns.map((ci, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                          <div>
                            <p className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>{ci.member_name}</p>
                            <p className="text-[12px]" style={{ color: 'var(--color-text3)' }}>{ci.event_name}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[12px]" style={{ color: 'var(--color-text3)' }}>
                              {ci.event_date ? relativeTime(ci.event_date) : '—'}
                            </span>
                            <span className="rounded border px-2 py-0.5 text-[12px] font-semibold text-brand-600 dark:text-brand-400" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
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
            <div className="w-full shrink-0 xl:w-72">
              {/* QUICK ACTIONS */}
              <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="border-b px-4 py-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                  <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>Quick Actions</p>
                </div>
                <div className="divide-y" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <Link
                    to="/admin/members"
                    className="group flex items-center justify-between px-4 py-3 transition-colors"
                  >
                    <span className="text-[13px] font-medium" style={{ color: 'var(--color-text2)' }}>View All Members</span>
                    <svg className="w-4 h-4 text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    to="/admin/import"
                    className="group flex items-center justify-between px-4 py-3 transition-colors"
                  >
                    <span className="text-[13px] font-medium" style={{ color: 'var(--color-text2)' }}>Import Attendance</span>
                    <svg className="w-4 h-4 text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    to="/admin/events"
                    className="group flex items-center justify-between px-4 py-3 transition-colors"
                  >
                    <div>
                      <span className="text-[13px] font-medium" style={{ color: 'var(--color-text2)' }}>Manage Events</span>
                    </div>
                    <svg className="w-4 h-4 text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    to="/admin/merge-suggestions"
                    className="group flex items-center justify-between px-4 py-3 transition-colors"
                  >
                    <span className="text-[13px] font-medium" style={{ color: 'var(--color-text2)' }}>Review Merge Suggestions</span>
                    <svg className="w-4 h-4 text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
