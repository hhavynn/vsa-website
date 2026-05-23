import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { supabase } from '../../lib/supabase';

interface OverviewStats {
  members: number;
  events: number;
  upcomingEvents: number;
  cabinetMembers: number;
  galleryAlbums: number;
  academicTerms: number;
  cabinetYears: number;
  feedback: number;
  pendingFeedback: number;
  mergeCandidates: number;
  eventsMissingTerms: number;
  upcomingEventsMissingInfo: number;
  galleryAlbumsMissingCover: number;
}

const DEFAULT_STATS: OverviewStats = {
  members: 0,
  events: 0,
  upcomingEvents: 0,
  cabinetMembers: 0,
  galleryAlbums: 0,
  academicTerms: 0,
  cabinetYears: 0,
  feedback: 0,
  pendingFeedback: 0,
  mergeCandidates: 0,
  eventsMissingTerms: 0,
  upcomingEventsMissingInfo: 0,
  galleryAlbumsMissingCover: 0,
};

const QUICK_LINKS = [
  { to: '/admin/events', label: 'Events', desc: 'Create events, assign academic terms, manage images, forms, points, and check-in codes.' },
  { to: '/admin/cabinet', label: 'Cabinet', desc: 'Add board members, assign cabinet years, upload photos, and keep public leadership pages current.' },
  { to: '/admin/years', label: 'Years & Terms', desc: 'Create quarters and cabinet years, then choose which ones are active/current.' },
  { to: '/admin/gallery', label: 'Gallery', desc: 'Add Google Photos albums and cover images for the public gallery.' },
  { to: '/admin/content', label: 'Homepage Content', desc: 'Update the presidents message and homepage photo without changing code.' },
  { to: '/admin/members', label: 'Members', desc: 'Search, edit, merge, and export the member directory used by points tools.' },
  { to: '/admin/houses', label: 'Houses', desc: 'Import House Reveal assignments and assign members to houses without changing attendance.' },
  { to: '/admin/import', label: 'Import', desc: 'Match attendance sheets against member records before awarding points.' },
  { to: '/admin/feedback', label: 'Feedback', desc: 'Triage bugs, feature requests, and user suggestions.' },
];

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="scrapbook-note flex flex-col justify-center px-5 py-5 sm:px-6">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>
        {label}
      </p>
      <p className="font-serif text-[38px] leading-none" style={{ color: 'var(--color-text)' }}>
        {value}
      </p>
      <p className="mt-3 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
        {detail}
      </p>
    </div>
  );
}

function HealthWarning({ count, label, to, critical = false }: { count: number; label: string; to: string; critical?: boolean }) {
  if (count === 0) return null;

  return (
    <Link to={to} className="group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>
      <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${critical ? 'bg-red-500' : 'bg-amber-500'}`} />
      <div>
        <p className="font-sans text-[13px] font-semibold leading-none" style={{ color: 'var(--color-text)' }}>
          {count} {label}
        </p>
        <p className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
          Click to view and fix
        </p>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="ml-auto h-3 w-3 shrink-0 self-center opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--color-text3)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
      </svg>
    </Link>
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
        cabinetResult,
        galleryResult,
        academicTermsResult,
        cabinetYearsResult,
        feedbackResult,
        pendingFeedbackResult,
        mergeResult,
        missingTermsResult,
        upcomingMissingInfoResult,
        missingGalleryCoverResult,
      ] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }).gte('date', nowIso),
        supabase.from('cabinet_members').select('*', { count: 'exact', head: true }),
        supabase.from('gallery_events').select('*', { count: 'exact', head: true }),
        supabase.from('academic_terms').select('*', { count: 'exact', head: true }),
        supabase.from('cabinet_years').select('*', { count: 'exact', head: true }),
        supabase.from('feedback').select('*', { count: 'exact', head: true }),
        supabase.from('feedback').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
        supabase.from('merge_exclusions').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }).is('academic_term_id', null),
        supabase.from('events').select('*', { count: 'exact', head: true }).gte('date', nowIso).or('location.eq."",check_in_form_url.eq."",image_url.is.null'),
        supabase.from('gallery_events').select('*', { count: 'exact', head: true }).is('cover_image_url', null),
      ]);

      setStats({
        members: membersResult.count ?? 0,
        events: eventsResult.count ?? 0,
        upcomingEvents: upcomingResult.count ?? 0,
        cabinetMembers: cabinetResult.count ?? 0,
        galleryAlbums: galleryResult.count ?? 0,
        academicTerms: academicTermsResult.count ?? 0,
        cabinetYears: cabinetYearsResult.count ?? 0,
        feedback: feedbackResult.count ?? 0,
        pendingFeedback: pendingFeedbackResult.count ?? 0,
        mergeCandidates: mergeResult.count ?? 0,
        eventsMissingTerms: missingTermsResult.count ?? 0,
        upcomingEventsMissingInfo: upcomingMissingInfoResult.count ?? 0,
        galleryAlbumsMissingCover: missingGalleryCoverResult.count ?? 0,
      });
      setLoading(false);
    }

    loadOverview();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Admin Overview" />

      <div className="border-b px-6 py-6 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
          Overview
        </h1>
        <p className="mt-2 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
          High-level status across members, events, and incoming admin work.
        </p>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
            Loading overview...
          </div>
        ) : (
          <div className="space-y-8 lg:space-y-10">
            <div className="grid gap-4 sm:grid-cols-2 lg:gap-6 xl:grid-cols-3">
              <StatCard label="Members" value={stats.members} detail="Total member records currently in the system." />
              <StatCard label="Events" value={stats.events} detail={`${stats.upcomingEvents} upcoming events are still active.`} />
              <StatCard label="Cabinet" value={stats.cabinetMembers} detail={`${stats.cabinetYears} cabinet years are available for archives.`} />
              <StatCard label="Gallery" value={stats.galleryAlbums} detail="Public albums linked from Google Photos." />
              <StatCard label="Terms" value={stats.academicTerms} detail="Academic terms used to group event archives." />
              <StatCard label="Feedback" value={stats.feedback} detail={`${stats.pendingFeedback} items still need follow-up.`} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="border-b px-5 py-4 sm:px-6 sm:py-5" style={{ borderColor: 'var(--color-border)' }}>
                  <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                    Quick Actions
                  </h2>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {QUICK_LINKS.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="group flex flex-col items-start justify-between gap-2 px-5 py-4 transition-colors hover:bg-[var(--color-surface2)] sm:flex-row sm:items-center sm:px-6"
                    >
                      <div>
                        <p className="font-sans text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>
                          {link.label}
                        </p>
                        <p className="mt-1 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                          {link.desc}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--color-surface)] p-2 text-brand-600 transition-transform group-hover:translate-x-1 dark:text-brand-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="scrapbook-paper h-fit p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <span className="scrapbook-pin" aria-hidden />
                <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                  Attention
                </h2>
                <div className="mt-6 space-y-6">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>
                      Pending Feedback
                    </p>
                    <p className="mt-2 font-serif text-[42px] leading-none text-[var(--accent)]">
                      {stats.pendingFeedback}
                    </p>
                  </div>
                  <div className="border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>
                      Merge Exclusions
                    </p>
                    <p className="mt-2 font-sans text-[13px] leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                      <span className="font-semibold text-[var(--color-text)]">{stats.mergeCandidates}</span> merge exclusions are stored. Review duplicates from the merge screen when needed.
                    </p>
                  </div>
                  </div>
                  </div>

                  <div className="scrapbook-paper h-fit p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                    Data Health
                  </h2>
                  {(stats.eventsMissingTerms + stats.upcomingEventsMissingInfo + stats.galleryAlbumsMissingCover) > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                      {stats.eventsMissingTerms + stats.upcomingEventsMissingInfo + stats.galleryAlbumsMissingCover}
                    </span>
                  )}
                  </div>

                  <div className="mt-6 space-y-3">
                  {(stats.eventsMissingTerms + stats.upcomingEventsMissingInfo + stats.galleryAlbumsMissingCover) === 0 ? (
                    <p className="font-sans text-[13px] leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                      All systems normal. No critical data issues detected.
                    </p>
                  ) : (
                    <>
                      <HealthWarning 
                        count={stats.eventsMissingTerms} 
                        label="events missing terms" 
                        to="/admin/events" 
                        critical={true} 
                      />
                      <HealthWarning 
                        count={stats.upcomingEventsMissingInfo} 
                        label="upcoming events need info" 
                        to="/admin/events" 
                      />
                      <HealthWarning 
                        count={stats.galleryAlbumsMissingCover} 
                        label="albums missing covers" 
                        to="/admin/gallery" 
                      />
                    </>
                  )}
                  </div>
                  </div>
                  </div>

          </div>
        )}
      </div>
    </div>
  );
}
