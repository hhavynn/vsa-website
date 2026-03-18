import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { useEvents } from '../hooks/useEvents';
import { EventCard } from '../components/features/events/EventCard';
import { Event } from '../types';
import { PageLoader } from '../components/common/PageLoader';

export function Events() {
  const { events, loading, error } = useEvents();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const upcomingEvents = events
    .filter((event: Event) => new Date(event.date) >= oneDayAgo)
    .sort((a: Event, b: Event) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastEvents = events
    .filter((event: Event) => new Date(event.date) < oneDayAgo)
    .sort((a: Event, b: Event) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) {
    return (
      <>
        <PageTitle title="Events" />
        <PageLoader message="Loading events..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageTitle title="Events" />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <p className="text-red-400">
            Error loading events: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Events" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <RevealOnScrollWrapper>
          <div className="mb-12">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight mb-1">Events</h1>
            <p className="text-zinc-500 text-sm">
              {upcomingEvents.length} upcoming · {pastEvents.length} past
            </p>
          </div>
        </RevealOnScrollWrapper>

        {/* Upcoming */}
        <section className="mb-16">
          <RevealOnScrollWrapper>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Upcoming</h2>
              <span className="px-2 py-0.5 text-xs font-medium border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 rounded">
                {upcomingEvents.length}
              </span>
            </div>
          </RevealOnScrollWrapper>

          {upcomingEvents.length === 0 ? (
            <RevealOnScrollWrapper>
              <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-10 text-center">
                <p className="text-zinc-500 mb-1">No upcoming events at this time.</p>
                <p className="text-zinc-400 text-sm">Check back soon for new events!</p>
              </div>
            </RevealOnScrollWrapper>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map((event: Event, i: number) => (
                <RevealOnScrollWrapper key={event.id} delay={i * 0.06}>
                  <EventCard event={event} onCheckIn={() => {}} />
                </RevealOnScrollWrapper>
              ))}
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 my-12" />

        {/* Past */}
        <section>
          <RevealOnScrollWrapper>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-base font-semibold text-zinc-500">Past Events</h2>
              <span className="px-2 py-0.5 text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-500 rounded">
                {pastEvents.length}
              </span>
            </div>
          </RevealOnScrollWrapper>

          {pastEvents.length === 0 ? (
            <RevealOnScrollWrapper>
              <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-8 text-center">
                <p className="text-zinc-500">No past events yet.</p>
              </div>
            </RevealOnScrollWrapper>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 opacity-70">
              {pastEvents.map((event: Event, i: number) => (
                <RevealOnScrollWrapper key={event.id} delay={i * 0.04}>
                  <EventCard event={event} onCheckIn={() => {}} />
                </RevealOnScrollWrapper>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
