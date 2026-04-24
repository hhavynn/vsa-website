import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { supabase } from '../../lib/supabase';

interface OverviewStats {
  members: number;
  events: number;
  upcomingEvents: number;
  feedback: number;
  pendingFeedback: number;
  mergeCandidates: number;
}

const DEFAULT_STATS: OverviewStats = {
  members: 0,
  events: 0,
  upcomingEvents: 0,
  feedback: 0,
  pendingFeedback: 0,
  mergeCandidates: 0,
};

const QUICK_LINKS = [
  { to: '/admin/members', label: 'Members', desc: 'Search, edit, merge, and export the member directory.' },
  { to: '/admin/events', label: 'Events', desc: 'Create new events, manage check-in codes, and update details.' },
  { to: '/admin/import', label: 'Import', desc: 'Match attendance sheets against member records before awarding points.' },
  { to: '/admin/feedback', label: 'Feedback', desc: 'Triage bugs, feature requests, and user suggestions.' },
];

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-md border px-5 py-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
        {label}
      </p>
      <p className="font-serif text-[34px] leading-none" style={{ color: 'var(--color-text)' }}>
        {value}
      </p>
      <p className="mt-2 text-xs" style={{ color: 'var(--color-text2)' }}>
        {detail}
      </p>
    </div>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState<OverviewStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOverview() {
      setLoading(true);
      const nowIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [
        membersResult,
        eventsResult,
        upcomingResult,
        feedbackResult,
        pendingFeedbackResult,
        mergeResult,
      ] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }).gte('date', nowIso),
        supabase.from('feedback').select('*', { count: 'exact', head: true }),
        supabase.from('feedback').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
        supabase.from('merge_exclusions').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        members: membersResult.count ?? 0,
        events: eventsResult.count ?? 0,
        upcomingEvents: upcomingResult.count ?? 0,
        feedback: feedbackResult.count ?? 0,
        pendingFeedback: pendingFeedbackResult.count ?? 0,
        mergeCandidates: mergeResult.count ?? 0,
      });
      setLoading(false);
    }

    loadOverview();
  }, []);

  return (
    <>
      <PageTitle title="Admin Overview" />

      <div className="border-b" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-sans text-base font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
          Overview
        </h1>
        <p className="mt-0.5 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
          High-level status across members, events, and incoming admin work.
        </p>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
            Loading overview...
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Members" value={stats.members} detail="Total member records currently in the system." />
              <StatCard label="Events" value={stats.events} detail={`${stats.upcomingEvents} upcoming events are still active.`} />
              <StatCard label="Feedback" value={stats.feedback} detail={`${stats.pendingFeedback} items still need follow-up.`} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
                  <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Quick Actions
                  </h2>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {QUICK_LINKS.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="flex items-start justify-between gap-4 px-5 py-4 transition-opacity hover:opacity-80"
                    >
                      <div>
                        <p className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {link.label}
                        </p>
                        <p className="mt-1 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                          {link.desc}
                        </p>
                      </div>
                      <span className="font-sans text-sm text-brand-600 dark:text-brand-400">→</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-md border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  Attention
                </h2>
                <div className="mt-4 space-y-3">
                  <div className="border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                      Pending Feedback
                    </p>
                    <p className="mt-1 font-serif text-3xl leading-none" style={{ color: 'var(--color-text)' }}>
                      {stats.pendingFeedback}
                    </p>
                  </div>
                  <div className="border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                      Merge Exclusions
                    </p>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                      {stats.mergeCandidates} merge exclusions are stored. Review duplicates from the merge screen when needed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
