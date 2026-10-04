import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { FadeContent } from '../../components/ui/FadeContent';
import { formatAcademicYear } from '../../lib/academicTerms';
import { adminOverviewRepository } from '../../data/repos/adminOverview';
import { DEFAULT_OVERVIEW_STATS } from '../../lib/adminOverviewStats';
import { warnsWhenNoUpcomingEvents } from '../../lib/adminAttention';
import { ADMIN_HEALTH_QUERY_KEYS, HEALTH_QUERY_OPTIONS } from '../../lib/adminHealthQuery';
import { AttentionQueue } from '../../components/features/admin/AttentionQueue';
import { OperationsDashboard } from '../../components/features/admin/OperationsDashboard';
import { RecentActivityCard } from '../../components/features/admin/RecentActivityCard';

interface AdminToolCard {
  to: string;
  label: string;
  desc: string;
  affects?: string;
  keywords: string[];
}

interface AdminToolGroup {
  title: string;
  intro: string;
  tools: AdminToolCard[];
}

const ADMIN_TOOL_GROUPS: AdminToolGroup[] = [
  {
    title: 'Member Experience',
    intro: 'Edit the pages and programs members interact with most.',
    tools: [
      {
        to: '/admin/events',
        label: 'Events & Recaps',
        desc: 'Edit upcoming events, dates, locations, point values, event images, and recap notes.',
        affects: '/events, homepage event previews, Ask VSA event answers',
        keywords: ['events', 'event recaps', 'recaps', 'dates', 'locations', 'points', 'images', 'check in'],
      },
      {
        to: '/admin/houses',
        label: 'Houses',
        desc: 'Manage House assignments, public House profiles, House images, House parents, and House events.',
        affects: '/house, /house/year/:year, House detail pages, house standings',
        keywords: ['houses', 'house', 'assignments', 'reveal', 'membership'],
      },
      {
        to: '/admin/ace',
        label: 'ACE Families',
        desc: 'Manage ACE family groups and member relationships.',
        affects: '/ace and ACE family displays',
        keywords: ['ace', 'families', 'family', 'members'],
      },
      {
        to: '/admin/interns',
        label: 'Intern Cohort',
        desc: 'Prepare the accepted intern cohort privately: import names, link members, assign mentors, then publish to the Cabinet Interns group.',
        affects: '/intern-program, /cabinet (Interns group), intern avatars',
        keywords: ['interns', 'intern', 'cohort', 'mentor', 'internship', 'accepted'],
      },
      {
        to: '/admin/applications',
        label: 'Applications',
        desc: 'Manage application and interest-form links with open/close windows. Buttons appear publicly only while a window is open.',
        affects: '/ace, /house, /intern-program, /cabinet, /vcn/current, /wild-n-culture, /get-involved',
        keywords: ['applications', 'apply', 'forms', 'interest form', 'windows', 'ace', 'house', 'intern', 'cabinet', 'vcn', 'wnc'],
      },
      {
        to: '/admin/uvsa-schools',
        label: 'UVSA School Cards',
        desc: 'Manage SoCal VSA school cards shown on the UVSA Network page.',
        affects: '/uvsa-network',
        keywords: ['uvsa', 'schools', 'externals', 'network', 'socal'],
      },
      {
        to: '/admin/external-events',
        label: 'External Events',
        desc: 'Manage UVSA and partner events promoted outside regular VSA programming.',
        affects: '/uvsa-network and external event cards',
        keywords: ['external', 'externals', 'uvsa', 'events', 'partner'],
      },
    ],
  },
  {
    title: 'Content & Media',
    intro: 'Keep public site content, photos, archives, and resources current.',
    tools: [
      {
        to: '/admin/content-calendar',
        label: 'Content Calendar',
        desc: 'Plan upcoming website updates and review content health derived from events, apps, and terms.',
        affects: 'Admin workflow planning',
        keywords: ['calendar', 'content', 'planning', 'schedule', 'reminders'],
      },
      {
        to: '/admin/content',
        label: 'Homepage & Program Content',
        desc: 'Update homepage presidents message, featured photos, and program page content without changing code.',
        affects: '/, /get-involved, /intern-program, /vcn, /wild-n-culture',
        keywords: ['homepage', 'home', 'content', 'copy', 'photos', 'programs'],
      },
      {
        to: '/admin/cabinet',
        label: 'Cabinet',
        desc: 'Update cabinet profiles, photos, roles, and cabinet years shown on the public Cabinet page.',
        affects: '/cabinet and cabinet archive years',
        keywords: ['cabinet', 'profiles', 'board', 'officers', 'photos'],
      },
      {
        to: '/admin/gallery',
        label: 'Gallery',
        desc: 'Upload gallery drops and connect memories to events with albums and cover images.',
        affects: '/gallery and event recap links',
        keywords: ['gallery', 'photos', 'albums', 'memories', 'media'],
      },
      {
        to: '/admin/vcn',
        label: 'VCN Archives',
        desc: 'Manage VCN archive entries, current production selection, media links, and source notes.',
        affects: '/vcn/current and /vcn/archive',
        keywords: ['vcn', 'archives', 'archive', 'media', 'culture night'],
      },
      {
        to: '/admin/ai-knowledge',
        label: 'Ask VSA Knowledge',
        desc: 'Manage public-safe facts Ask VSA can use when answering member questions.',
        affects: 'Ask VSA assistant responses',
        keywords: ['ai', 'assistant', 'ask vsa', 'knowledge', 'snippets', 'faq'],
      },
      {
        to: '/admin/resources',
        label: 'Resources Index',
        desc: 'Maintain admin-only Drive, form, and doc links for cabinet work.',
        affects: 'Admin-only resources and cabinet operations',
        keywords: ['resources', 'source of truth', 'drive', 'forms', 'docs', 'index', 'ai', 'assistant'],
      },
      {
        to: '/admin/settings',
        label: 'Site Settings',
        desc: 'Update logo, theme assets, and existing site-wide public content switches.',
        affects: 'Global header, footer, logo, and site settings',
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
        affects: 'Member point records and attendance audit history',
        keywords: ['attendance', 'imports', 'import', 'audit', 'logs', 'sheets'],
      },
      {
        to: '/admin/members',
        label: 'Members',
        desc: 'Manage members, aliases, exports, and records used by attendance and points tools.',
        affects: 'Find My Points, attendance matching, and admin member tools',
        keywords: ['members', 'member', 'aliases', 'records', 'attendance', 'points'],
      },
      {
        to: '/admin/points',
        label: 'Points Tools',
        desc: 'Review point records and jump to related member, import, event, and merge tools.',
        affects: '/leaderboard and /points lookups',
        keywords: ['points', 'leaderboard', 'find my points', 'records', 'tools'],
      },
      {
        to: '/admin/merge-suggestions',
        label: 'Merge Review',
        desc: 'Review duplicate member suggestions so point records stay clean.',
        affects: 'Member records used by attendance and points',
        keywords: ['merge', 'duplicates', 'members', 'cleanup', 'data health'],
      },
      {
        to: '/admin/years',
        label: 'Years & Terms',
        desc: 'Manage academic terms and cabinet years used by events, archives, and points.',
        affects: 'Event grouping, cabinet years, archives, and academic-year filters',
        keywords: ['years', 'terms', 'quarters', 'academic', 'cabinet years'],
      },
    ],
  },
  {
    title: 'System',
    intro: 'Check site health, feedback, diagnostics, and admin operations.',
    tools: [
      {
        to: '/admin/data-rights',
        label: 'Data Rights',
        desc: 'Track minimal intake, identity-verification, review, and decision metadata for privacy and data requests.',
        affects: 'Admin-only request tracking; no member data actions',
        keywords: ['privacy', 'data rights', 'requests', 'verification', 'review', 'decisions'],
      },
      {
        to: '/admin/launch-checklist',
        label: 'Launch Checklist',
        desc: 'Pre-launch readiness checks for each academic year. Covers terms, cabinet, events, gallery, applications, Houses, VCN, and Ask VSA.',
        affects: 'All public-facing sections of the site',
        keywords: ['launch', 'checklist', 'readiness', 'pre-launch', 'year', 'setup', 'qa'],
      },
      {
        to: '/admin',
        label: 'Data Health Warnings',
        desc: 'Check missing event terms, incomplete upcoming event info, and gallery cover issues.',
        affects: 'Admin dashboard diagnostics',
        keywords: ['data health', 'warnings', 'diagnostics', 'missing', 'issues'],
      },
      {
        to: '/admin/ai-feedback',
        label: 'Ask VSA Feedback',
        desc: 'Review ratings and feedback submitted by users on Ask VSA AI assistant responses.',
        affects: 'Admin-only',
        keywords: ['ai', 'ask vsa', 'feedback', 'assistant', 'knowledge'],
      },
      {
        to: '/admin/analytics',
        label: 'Analytics',
        desc: 'Review existing admin analytics and high-level site activity signals.',
        affects: 'Admin-only analytics views',
        keywords: ['analytics', 'reports', 'activity', 'diagnostics'],
      },
      {
        to: '/admin/feedback',
        label: 'Feedback',
        desc: 'Triage bugs, feature requests, and user suggestions from the public feedback form.',
        affects: '/feedback submissions and admin triage',
        keywords: ['feedback', 'bugs', 'requests', 'support', 'suggestions'],
      },
    ],
  },
];

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="scrapbook-note flex h-full flex-col justify-center px-5 py-5 sm:px-6">
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

function ToolCard({ tool, activeAiSnippets }: { tool: AdminToolCard; activeAiSnippets?: number }) {
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
      {tool.affects && (
        <p className="mt-4 rounded border px-3 py-2 font-sans text-[11px] leading-relaxed" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-surface2)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-text2)' }}>Public page affected:</span> {tool.affects}
        </p>
      )}
      {tool.to === '/admin/ai-knowledge' && typeof activeAiSnippets === 'number' && (
        <p className="mt-3 rounded border px-3 py-2 font-sans text-[11px] leading-relaxed" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-surface2)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-text2)' }}>{activeAiSnippets}</span> active snippets available to Ask VSA.
        </p>
      )}
    </Link>
  );
}


function HealthGroupCard({ title, to, children }: { title: string; to?: string; children: React.ReactNode }) {
  return (
    <FadeContent className="h-full">
      <div className="scrapbook-paper h-full overflow-hidden bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>{title}</h3>
          {to && (
            <Link to={to} className="font-sans text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400">
              View details →
            </Link>
          )}
        </div>
        <div className="p-5">
          <div className="space-y-3">
            {children}
          </div>
        </div>
      </div>
    </FadeContent>
  );
}

function HealthItem({ label, value, status, to }: { label: string; value: React.ReactNode; status?: 'good' | 'warning' | 'error' | 'neutral'; to?: string }) {
  let statusColor = 'text-[var(--color-text3)]';
  let dotColor = 'bg-gray-400';
  
  if (status === 'good') {
    statusColor = 'text-green-600 dark:text-green-400';
    dotColor = 'bg-green-500';
  } else if (status === 'warning') {
    statusColor = 'text-amber-600 dark:text-amber-400';
    dotColor = 'bg-amber-500';
  } else if (status === 'error') {
    statusColor = 'text-red-600 dark:text-red-400';
    dotColor = 'bg-red-500';
  }

  const content = (
    <div className={`flex items-center justify-between group ${to ? 'cursor-pointer hover:bg-[var(--color-surface)] p-2 -mx-2 rounded transition-colors' : ''}`}>
      <div className="flex items-center gap-2">
        <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <span className="font-sans text-[13px]" style={{ color: 'var(--color-text2)' }}>{label}</span>
      </div>
      <span className={`font-mono text-[12px] font-bold ${statusColor}`}>{value}</span>
    </div>
  );

  return to ? <Link to={to} className="block">{content}</Link> : content;
}

export default function AdminOverview() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Cached for a minute and never refetched on focus/reconnect or on a timer:
  // revisiting the page reuses the numbers, and "Refresh" is the way to re-scan.
  const overview = useQuery(ADMIN_HEALTH_QUERY_KEYS.overview, () => adminOverviewRepository.load(), HEALTH_QUERY_OPTIONS);
  const stats = overview.data?.stats ?? DEFAULT_OVERVIEW_STATS;
  const unavailable = overview.data?.unavailable ?? [];
  const loading = overview.isLoading;
  const refreshing = overview.isFetching;

  function refreshHealth() {
    return queryClient.invalidateQueries(ADMIN_HEALTH_QUERY_KEYS.all);
  }

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
        <div className="flex max-w-5xl flex-wrap items-start justify-between gap-4">
          <div>
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
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <button
              type="button"
              onClick={refreshHealth}
              disabled={refreshing}
              className="rounded border border-[var(--color-border)] px-3 py-1.5 font-sans text-xs font-semibold text-brand-600 transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-60 dark:text-brand-400"
            >
              {refreshing ? 'Refreshing…' : 'Refresh counts'}
            </button>
            {overview.dataUpdatedAt > 0 && (
              <p className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                Counts loaded {new Date(overview.dataUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8 lg:mb-10">
          <AttentionQueue signals={overview.data?.attention ?? null} loading={loading} failed={overview.isError} />
        </div>
        <div className="mb-8 lg:mb-10">
          <OperationsDashboard />
        </div>
        <div className="mb-8 lg:mb-10">
          <RecentActivityCard />
        </div>
        {unavailable.length > 0 && (
          <div role="status" className="mb-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 font-sans text-[13px] text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            Some counts could not be loaded ({unavailable.join(', ')}), so numbers below may be incomplete. Use Refresh counts to try again.
          </div>
        )}
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
            Loading overview...
          </div>
        ) : (
          <div className="space-y-8 lg:space-y-10">
            <div className="grid gap-4 sm:grid-cols-2 lg:gap-6 xl:grid-cols-3">
              {[
                <StatCard key="members" label="Members" value={stats.members} detail="Total member records currently in the system." />,
                <StatCard key="events" label="Events" value={stats.events} detail={`${stats.upcomingEvents} upcoming events are still active.`} />,
                <StatCard key="cabinet" label="Cabinet" value={stats.cabinetMembers} detail={`${stats.cabinetYears} cabinet years are available for archives.`} />,
                <StatCard key="gallery" label="Gallery" value={stats.galleryAlbums} detail="Public albums linked from Google Photos." />,
                <StatCard key="terms" label="Terms" value={stats.academicTerms} detail="Academic terms used to group event archives." />,
                <StatCard key="feedback" label="Feedback" value={stats.feedback} detail={`${stats.pendingFeedback} items still need follow-up.`} />,
              ].map((card, index) => (
                <FadeContent key={card.key} delay={index * 0.05} className="h-full">
                  {card}
                </FadeContent>
              ))}
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
                  filteredGroups.map((group, groupIndex) => (
                    <FadeContent key={group.title} delay={groupIndex * 0.06}>
                      <section className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
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
                            <ToolCard
                              key={tool.to}
                              tool={tool}
                              activeAiSnippets={stats.aiTableExists ? stats.aiSnippetsActive : undefined}
                            />
                          ))}
                        </div>
                      </section>
                    </FadeContent>
                  ))
                )}
              </div>

              <div className="space-y-6">
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

            <div className="mt-10 space-y-6">
              <div className="scrapbook-paper p-5 sm:p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                  Content Health Dashboard
                </h2>
                <p className="mt-1 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                  Quickly see what public content is missing, stale, hidden, broken, or still using legacy storage.{' '}
                  <Link to="/admin/content-health" className="font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400">
                    See what needs fixing, with links to the pages that fix it →
                  </Link>
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <HealthGroupCard title="Events" to="/admin/events">
                  <HealthItem label="Published events" value={stats.eventsPublished} status="good" />
                  <HealthItem label="Draft events" value={stats.eventsDraft} status={stats.eventsDraft > 0 ? 'warning' : 'neutral'} />
                  <HealthItem label="Upcoming published" value={stats.eventsUpcomingPublished} status={stats.eventsUpcomingPublished > 0 ? 'good' : warnsWhenNoUpcomingEvents() ? 'warning' : 'neutral'} />
                  <HealthItem label="Missing image" value={stats.eventsMissingImage} status={stats.eventsMissingImage > 0 ? 'warning' : 'good'} />
                  <HealthItem label="Missing location" value={stats.eventsMissingLocation} status={stats.eventsMissingLocation > 0 ? 'warning' : 'good'} />
                </HealthGroupCard>

                <HealthGroupCard title="Houses" to="/admin/houses">
                  <HealthItem
                    label={stats.activeTermUnavailable
                      ? 'Current House profiles (active term could not be loaded)'
                      : `Current House profiles (${stats.housesCurrentYearStart ? formatAcademicYear(stats.housesCurrentYearStart) : 'active year'})`}
                    value={stats.activeTermUnavailable ? '—' : stats.housesCurrentCount}
                    status={stats.activeTermUnavailable || stats.housesCurrentCount === 0 ? 'warning' : 'good'}
                  />
                  <HealthItem label="Missing House images" value={stats.housesMissingImage} status={stats.housesMissingImage > 0 ? 'warning' : 'good'} />
                  <HealthItem label="Missing House parents" value={stats.housesMissingParents} status={stats.housesMissingParents > 0 ? 'warning' : 'good'} />
                </HealthGroupCard>

                <HealthGroupCard title="Gallery" to="/admin/gallery">
                  <HealthItem label="Total albums" value={stats.galleryCount} status="neutral" />
                  <HealthItem label="Missing cover image" value={stats.galleryMissingCover} status={stats.galleryMissingCover > 0 ? 'warning' : 'good'} />
                  <HealthItem label="Missing Photos URL" value={stats.galleryMissingPhotosUrl} status={stats.galleryMissingPhotosUrl > 0 ? 'warning' : 'good'} />
                </HealthGroupCard>

                <HealthGroupCard title="Cabinet" to="/admin/cabinet">
                  <HealthItem label="Active cabinet year" value={stats.cabinetActiveYear?.label || 'None'} status={stats.cabinetActiveYear ? 'good' : 'error'} />
                  <HealthItem label="Members in active year" value={stats.cabinetMembersActiveYear} status={stats.cabinetMembersActiveYear > 0 ? 'good' : 'warning'} />
                  <HealthItem label="Members missing image" value={stats.cabinetMissingImage} status={stats.cabinetMissingImage > 0 ? 'warning' : 'good'} />
                  <HealthItem label="Members missing role" value={stats.cabinetMissingRole} status={stats.cabinetMissingRole > 0 ? 'warning' : 'good'} />
                </HealthGroupCard>

                <HealthGroupCard title="VCN" to="/admin/vcn">
                  <HealthItem label="Current published exists" value={stats.vcnCurrentPublishedExists ? 'Yes' : 'No'} status={stats.vcnCurrentPublishedExists ? 'good' : 'warning'} />
                  <HealthItem label="Archive count" value={stats.vcnArchiveCount} status="neutral" />
                  <HealthItem label="Missing cover media" value={stats.vcnMissingMedia} status={stats.vcnMissingMedia > 0 ? 'warning' : 'good'} />
                </HealthGroupCard>

                <HealthGroupCard title="Program Content" to="/admin/content">
                  <HealthItem label="Missing / inactive content" value={stats.programContentMissing} status={stats.programContentMissing > 0 ? 'warning' : 'good'} />
                  <HealthItem label="Get Involved, ACE, Intern, House, WNC" value="Monitored" status="neutral" />
                </HealthGroupCard>

                <HealthGroupCard title="Ask VSA AI" to={stats.aiTableExists ? "/admin/ai-knowledge" : "/admin/resources"}>
                  {stats.aiTableExists ? (
                    <>
                      <HealthItem label="Active snippets" value={stats.aiSnippetsActive} status="good" />
                      <HealthItem label="Inactive snippets" value={stats.aiSnippetsInactive} status="neutral" />
                      <HealthItem label="Latest verification" value={stats.aiLastVerifiedAt ? new Date(stats.aiLastVerifiedAt).toLocaleDateString() : 'Never'} status={stats.aiLastVerifiedAt ? 'good' : 'warning'} />
                    </>
                  ) : (
                    <HealthItem label="AI Table exists" value="No" status="warning" />
                  )}
                </HealthGroupCard>

                <HealthGroupCard title="Applications" to="/admin/applications">
                  <HealthItem label="Total windows" value={stats.applicationsTotal} status="neutral" />
                  <HealthItem label="Currently open" value={stats.applicationsOpen} status={stats.applicationsOpen > 0 ? 'good' : 'neutral'} />
                  <HealthItem label="Scheduled" value={stats.applicationsUpcoming} status="neutral" />
                  <HealthItem label="Closed" value={stats.applicationsClosed} status="neutral" />
                </HealthGroupCard>

                <HealthGroupCard title="Storage / Egress">
                  <HealthItem label="Supabase Storage URLs" value={stats.storageUrlsCount} status={stats.storageUrlsCount > 0 ? 'warning' : 'good'} />
                  <HealthItem label="Images to migrate" value="View queries" status="neutral" />
                </HealthGroupCard>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
