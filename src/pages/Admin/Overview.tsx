import { useEffect, useMemo, useState } from 'react';
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

interface AdminToolCard {
  to: string;
  label: string;
  desc: string;
  keywords: string[];
}

interface AdminToolGroup {
  title: string;
  intro: string;
  tools: AdminToolCard[];
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

const ADMIN_TOOL_GROUPS: AdminToolGroup[] = [
  {
    title: 'Member Experience',
    intro: 'Edit the pages and programs members interact with most.',
    tools: [
      {
        to: '/admin/events',
        label: 'Events & Recaps',
        desc: 'Edit upcoming events, dates, locations, point values, event images, and recap notes.',
        keywords: ['events', 'event recaps', 'recaps', 'dates', 'locations', 'points', 'images', 'check in'],
      },
      {
        to: '/admin/houses',
        label: 'Houses',
        desc: 'Manage house assignments, house images, and House Reveal backfill tools.',
        keywords: ['houses', 'house', 'assignments', 'reveal', 'membership'],
      },
      {
        to: '/admin/ace',
        label: 'ACE Families',
        desc: 'Manage ACE family groups and member relationships.',
        keywords: ['ace', 'families', 'family', 'members'],
      },
      {
        to: '/admin/uvsa-schools',
        label: 'UVSA School Cards',
        desc: 'Manage SoCal VSA school cards shown on the UVSA Network page.',
        keywords: ['uvsa', 'schools', 'externals', 'network', 'socal'],
      },
      {
        to: '/admin/external-events',
        label: 'External Events',
        desc: 'Manage UVSA and partner events promoted outside regular VSA programming.',
        keywords: ['external', 'externals', 'uvsa', 'events', 'partner'],
      },
    ],
  },
  {
    title: 'Content & Media',
    intro: 'Keep public site content, photos, archives, and resources current.',
    tools: [
      {
        to: '/admin/content',
        label: 'Homepage Content',
        desc: 'Update homepage copy, featured photos, and program content without changing code.',
        keywords: ['homepage', 'home', 'content', 'copy', 'photos', 'programs'],
      },
      {
        to: '/admin/cabinet',
        label: 'Cabinet',
        desc: 'Update cabinet profiles, photos, roles, and cabinet years shown on the public Cabinet page.',
        keywords: ['cabinet', 'profiles', 'board', 'officers', 'photos'],
      },
      {
        to: '/admin/gallery',
        label: 'Gallery',
        desc: 'Upload gallery drops and connect memories to events with albums and cover images.',
        keywords: ['gallery', 'photos', 'albums', 'memories', 'media'],
      },
      {
        to: '/admin/vcn',
        label: 'VCN Archives',
        desc: 'Manage VCN archive entries, media links, and source notes.',
        keywords: ['vcn', 'archives', 'archive', 'media', 'culture night'],
      },
      {
        to: '/admin/resources',
        label: 'Resources Index',
        desc: 'Maintain admin-only Drive, form, and doc links for cabinet work.',
        keywords: ['resources', 'source of truth', 'drive', 'forms', 'docs', 'index', 'ai', 'assistant'],
      },
      {
        to: '/admin/settings',
        label: 'Site Settings',
        desc: 'Adjust existing site-wide admin settings and public content switches.',
        keywords: ['settings', 'site settings', 'config', 'site'],
      },
    ],
  },
  {
    title: 'Points & Attendance',
    intro: 'Work with members, attendance files, point records, and data cleanup.',
    tools: [
      {
        to: '/admin/import',
        label: 'Attendance Imports & Audit Logs',
        desc: 'Import attendance sheets, review matches, and check completed or failed import records.',
        keywords: ['attendance', 'imports', 'import', 'audit', 'logs', 'sheets'],
      },
      {
        to: '/admin/members',
        label: 'Members',
        desc: 'Manage members, aliases, exports, and records used by attendance and points tools.',
        keywords: ['members', 'member', 'aliases', 'records', 'attendance', 'points'],
      },
      {
        to: '/admin/points',
        label: 'Points Tools',
        desc: 'Review point records and jump to related member, import, event, and merge tools.',
        keywords: ['points', 'leaderboard', 'find my points', 'records', 'tools'],
      },
      {
        to: '/admin/merge-suggestions',
        label: 'Merge Review',
        desc: 'Review duplicate member suggestions so point records stay clean.',
        keywords: ['merge', 'duplicates', 'members', 'cleanup', 'data health'],
      },
      {
        to: '/admin/years',
        label: 'Years & Terms',
        desc: 'Manage academic terms and cabinet years used by events, archives, and points.',
        keywords: ['years', 'terms', 'quarters', 'academic', 'cabinet years'],
      },
    ],
  },
  {
    title: 'System',
    intro: 'Check site health, feedback, diagnostics, and admin operations.',
    tools: [
      {
        to: '/admin',
        label: 'Data Health Warnings',
        desc: 'Check missing event terms, incomplete upcoming event info, and gallery cover issues.',
        keywords: ['data health', 'warnings', 'diagnostics', 'missing', 'issues'],
      },
      {
        to: '/admin/analytics',
        label: 'Analytics',
        desc: 'Review existing admin analytics and high-level site activity signals.',
        keywords: ['analytics', 'reports', 'activity', 'diagnostics'],
      },
      {
        to: '/admin/feedback',
        label: 'Feedback',
        desc: 'Triage bugs, feature requests, and user suggestions from the public feedback form.',
        keywords: ['feedback', 'bugs', 'requests', 'support', 'suggestions'],
      },
    ],
  },
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

function ToolCard({ tool }: { tool: AdminToolCard }) {
  return (
    <Link
      to={tool.to}
      className="group flex h-full flex-col rounded-lg border p-4 transition-colors hover:bg-[var(--color-surface2)] sm:p-5"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-sans text-[15px] font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
          {tool.label}
        </h3>
        <span className="mt-0.5 shrink-0 rounded-full bg-[var(--color-surface2)] p-2 text-brand-600 transition-transform group-hover:translate-x-1 dark:text-brand-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </div>
      <p className="mt-3 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
        {tool.desc}
      </p>
    </Link>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState<OverviewStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return ADMIN_TOOL_GROUPS;

    return ADMIN_TOOL_GROUPS
      .map(group => ({
        ...group,
        tools: group.tools.filter(tool => {
          const haystack = [
            group.title,
            group.intro,
            tool.label,
            tool.desc,
            ...tool.keywords,
          ].join(' ').toLowerCase();

          return haystack.includes(query);
        }),
      }))
      .filter(group => group.tools.length > 0);
  }, [searchTerm]);

  const visibleToolCount = filteredGroups.reduce((count, group) => count + group.tools.length, 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Admin Dashboard" />

      <div className="border-b px-6 py-6 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-5xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text3)' }}>
            Admin dashboard
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            What are you trying to edit?
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            Jump into the existing VSA admin tools by topic, or search for the thing you need to update.
          </p>
        </div>
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
              <div className="space-y-6">
                <div className="scrapbook-paper p-5 sm:p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                        Admin tools
                      </h2>
                      <p className="mt-1 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                        Search by page, task, or keyword like events, gallery, cabinet, points, houses, imports, externals, or ai.
                      </p>
                    </div>
                    <div className="w-full md:max-w-xs">
                      <label htmlFor="admin-tool-search" className="sr-only">
                        Search admin tools
                      </label>
                      <input
                        id="admin-tool-search"
                        type="search"
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Search admin tools..."
                        className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none transition-colors placeholder:text-[var(--color-text3)] focus:border-[var(--accent)] focus:bg-[var(--color-surface)]"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                      />
                      <p className="mt-2 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                        Showing {visibleToolCount} existing admin {visibleToolCount === 1 ? 'page' : 'pages'}.
                      </p>
                    </div>
                  </div>
                </div>

                {filteredGroups.length === 0 ? (
                  <div className="scrapbook-paper p-8 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                    <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                      No admin tools found
                    </h2>
                    <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                      Try events, gallery, cabinet, points, houses, attendance, imports, externals, homepage, or settings.
                    </p>
                  </div>
                ) : (
                  filteredGroups.map(group => (
                    <section key={group.title} className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                      <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                        <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                          {group.title}
                        </h2>
                        <p className="mt-1 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                          {group.intro}
                        </p>
                      </div>
                      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                        {group.tools.map(tool => (
                          <ToolCard key={tool.to} tool={tool} />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>

              <div className="space-y-6">
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
                        <HealthWarning count={stats.eventsMissingTerms} label="events missing terms" to="/admin/events" critical={true} />
                        <HealthWarning count={stats.upcomingEventsMissingInfo} label="upcoming events need info" to="/admin/events" />
                        <HealthWarning count={stats.galleryAlbumsMissingCover} label="albums missing covers" to="/admin/gallery" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
