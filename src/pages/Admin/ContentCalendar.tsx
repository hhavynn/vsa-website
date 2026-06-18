import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { format, isBefore, addDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { PageTitle } from '../../components/common/PageTitle';
import { eventsRepository } from '../../data/repos/events';
import { applicationLinksRepository } from '../../data/repos/applicationLinks';
import { academicTermsRepository } from '../../data/repos/academicTerms';
import { getApplicationStatus } from '../../lib/applicationLinks';
import { EVENT_TYPE_LABELS } from '../../constants/eventTypes';

interface CalendarItem {
  id: string;
  title: string;
  type: 'Event' | 'Application' | 'Term' | 'Reminder';
  date?: Date;
  deadline?: Date;
  status: 'Needs attention' | 'Upcoming' | 'Open now' | 'Review' | 'Later';
  note: string;
  to: string;
  critical?: boolean;
}

export default function ContentCalendar() {
  const { data: events = [], isLoading: eventsLoading } = useQuery(['admin-events-calendar'], () => 
    eventsRepository.getEvents({ include_unpublished: true })
  );

  const { data: appLinks = [], isLoading: appsLoading } = useQuery(['admin-apps-calendar'], () => 
    applicationLinksRepository.listAdminApplicationLinks()
  );

  const { data: terms = [], isLoading: termsLoading } = useQuery(['admin-terms-calendar'], () => 
    academicTermsRepository.getTerms()
  );

  const loading = eventsLoading || appsLoading || termsLoading;

  const calendarItems = useMemo(() => {
    const items: CalendarItem[] = [];
    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);

    // 1. Process Events
    events.forEach(event => {
      const eventDate = new Date(event.date);
      
      // Needs attention: Draft events happening soon
      if (!event.is_published && isBefore(eventDate, thirtyDaysFromNow)) {
        items.push({
          id: `event-draft-${event.id}`,
          title: event.name,
          type: 'Event',
          date: eventDate,
          status: 'Needs attention',
          note: 'Draft event needs publishing before it happens.',
          to: '/admin/events',
          critical: isBefore(eventDate, addDays(now, 7))
        });
      }

      // Needs attention: Missing critical info
      if (event.is_published && (!event.image_url || !event.location || event.location === 'TBD')) {
        items.push({
          id: `event-missing-${event.id}`,
          title: event.name,
          type: 'Event',
          date: eventDate,
          status: 'Review',
          note: `Missing ${!event.image_url ? 'image' : 'location'}. Check details.`,
          to: '/admin/events'
        });
      }

      // Upcoming this month
      if (isWithinInterval(eventDate, { start: thisMonthStart, end: thisMonthEnd })) {
        items.push({
          id: `event-upcoming-${event.id}`,
          title: event.name,
          type: 'Event',
          date: eventDate,
          status: 'Upcoming',
          note: `${EVENT_TYPE_LABELS[event.event_type]} happening this month.`,
          to: '/admin/events'
        });
      }
    });

    // 2. Process Applications
    appLinks.forEach(app => {
      const openAt = app.open_at ? new Date(app.open_at) : null;
      const dueAt = app.due_at ? new Date(app.due_at) : null;
      const status = getApplicationStatus(app.open_at, app.due_at, app.is_enabled, now);

      if (status === 'open') {
        items.push({
          id: `app-open-${app.id}`,
          title: app.title,
          type: 'Application',
          deadline: dueAt || undefined,
          status: 'Open now',
          note: `Application is live. Closes ${dueAt ? format(dueAt, 'MMM d') : 'soon'}.`,
          to: '/admin/applications'
        });
      } else if (status === 'not_open' && openAt && isBefore(openAt, thirtyDaysFromNow)) {
        items.push({
          id: `app-upcoming-${app.id}`,
          title: app.title,
          type: 'Application',
          date: openAt,
          status: 'Upcoming',
          note: `Opening on ${format(openAt, 'MMM d')}.`,
          to: '/admin/applications'
        });
      }
    });

    // 3. Process Terms
    const activeTerm = terms.find(t => t.is_active);
    if (!activeTerm) {
      items.push({
        id: 'term-none-active',
        title: 'No active academic term',
        type: 'Term',
        status: 'Needs attention',
        note: 'Active term is required for event grouping and points.',
        to: '/admin/years',
        critical: true
      });
    }

    // 4. Manual/Recurring Reminders (VSA specific)
    const currentMonth = now.getMonth(); // 0-indexed
    
    // Fall (Sep/Oct)
    if (currentMonth === 8 || currentMonth === 9) {
      items.push({
        id: 'rem-fall-president',
        title: 'Review Fall President Message',
        type: 'Reminder',
        status: 'Review',
        note: 'Ensure the homepage message is updated for the new year.',
        to: '/admin/content'
      });
    }

    // Winter (Dec/Jan) - Internship / VCN Prep
    if (currentMonth === 11 || currentMonth === 0) {
      items.push({
        id: 'rem-vcn-prep',
        title: 'Prepare VCN Content',
        type: 'Reminder',
        status: 'Upcoming',
        note: 'VCN is approaching. Review archives and current production info.',
        to: '/admin/vcn'
      });
    }

    // Spring (Mar/Apr) - Cabinet Apps
    if (currentMonth === 2 || currentMonth === 3) {
      items.push({
        id: 'rem-cab-apps',
        title: 'Cabinet Applications Season',
        type: 'Reminder',
        status: 'Upcoming',
        note: 'Time to prepare for next year\'s cabinet applications.',
        to: '/admin/applications'
      });
    }

    return items.sort((a, b) => {
      // Sort priority: Critical -> Needs attention -> Open now -> Upcoming -> Review -> Later
      const priority = {
        'Needs attention': 0,
        'Open now': 1,
        'Upcoming': 2,
        'Review': 3,
        'Later': 4
      };
      
      if (a.critical && !b.critical) return -1;
      if (!a.critical && b.critical) return 1;
      
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }

      // Secondary sort by date
      const dateA = a.date || a.deadline || new Date(8640000000000000);
      const dateB = b.date || b.deadline || new Date(8640000000000000);
      return dateA.getTime() - dateB.getTime();
    });
  }, [events, appLinks, terms]);

  const groupedItems = useMemo(() => {
    return {
      attention: calendarItems.filter(i => i.status === 'Needs attention'),
      open: calendarItems.filter(i => i.status === 'Open now'),
      upcoming: calendarItems.filter(i => i.status === 'Upcoming'),
      other: calendarItems.filter(i => i.status !== 'Needs attention' && i.status !== 'Open now' && i.status !== 'Upcoming')
    };
  }, [calendarItems]);

  const renderSection = (title: string, items: CalendarItem[], emptyMsg: string) => (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>{title}</h2>
        <div className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text3)]">{items.length} items</span>
      </div>
      
      {items.length === 0 ? (
        <p className="py-4 font-sans text-sm italic text-[var(--color-text3)]">{emptyMsg}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => (
            <Link 
              key={item.id} 
              to={item.to}
              className={`group relative flex flex-col rounded-lg border p-4 transition-all hover:shadow-md ${
                item.critical 
                  ? 'border-red-200 bg-red-50/30 hover:bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10' 
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface2)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-text3)]">
                  {item.type}
                </span>
                <StatusBadge status={item.status} critical={item.critical} />
              </div>
              
              <h3 className="mt-2 line-clamp-1 font-sans text-[15px] font-bold text-[var(--color-text)]">
                {item.title}
              </h3>
              
              <p className="mt-1 line-clamp-2 font-sans text-[12px] leading-relaxed text-[var(--color-text2)]">
                {item.note}
              </p>
              
              {(item.date || item.deadline) && (
                <div className="mt-auto pt-4">
                  <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--color-text3)]">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3 w-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    {item.deadline ? 'Deadline: ' : ''}
                    {format(item.date || item.deadline!, 'MMM d, yyyy')}
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Content Calendar" />

      <div className="border-b px-6 py-6 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-5xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text3)' }}>
            Admin workflow
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            Content Calendar
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            Plan upcoming website updates and review content health. Derives status from events, applications, and academic terms.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="py-20 text-center font-sans text-sm text-[var(--color-text3)]">
            Analyzing content schedule...
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-12">
            {renderSection('Needs Attention', groupedItems.attention, 'No urgent content issues detected.')}
            {renderSection('Open Now', groupedItems.open, 'No active application windows.')}
            {renderSection('Upcoming This Month', groupedItems.upcoming, 'No scheduled events this month.')}
            {renderSection('Review & Reminders', groupedItems.other, 'No secondary reminders.')}

            <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="font-serif text-lg font-bold text-[var(--color-text)]">More coming soon</h3>
              <p className="mx-auto mt-2 max-w-sm font-sans text-xs leading-relaxed text-[var(--color-text3)]">
                Future versions will include drag-and-drop planning, completion states, and automated cabinet transition checks.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, critical }: { status: CalendarItem['status'], critical?: boolean }) {
  const styles = {
    'Needs attention': critical ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'Open now': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'Upcoming': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'Review': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    'Later': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  };

  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}
