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

  // Split events into upcoming and past
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
          <div className="mb-12 text-center">
            <h1 className="font-heading font-bold text-4xl text-white mb-3">Events</h1>
            <p className="text-slate-400 text-sm">
              {upcomingEvents.length} upcoming · {pastEvents.length} past
            </p>
          </div>
        </RevealOnScrollWrapper>

        {/* Upcoming */}
        <section className="mb-16">
          <RevealOnScrollWrapper>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="font-heading font-semibold text-xl text-white">Upcoming</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-600/20">
                {upcomingEvents.length}
              </span>
            </div>
          </RevealOnScrollWrapper>

          {upcomingEvents.length === 0 ? (
            <RevealOnScrollWrapper>
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-10 text-center">
                <p className="text-slate-400 mb-1">No upcoming events at this time.</p>
                <p className="text-slate-500 text-sm">Check back soon for new events!</p>
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
        <div className="border-t border-slate-800/60 my-12" />

        {/* Past */}
        <section>
          <RevealOnScrollWrapper>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="font-heading font-semibold text-xl text-slate-300">Past Events</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-400 border border-slate-700/50">
                {pastEvents.length}
              </span>
            </div>
          </RevealOnScrollWrapper>

          {pastEvents.length === 0 ? (
            <RevealOnScrollWrapper>
              <div className="rounded-2xl bg-slate-900/40 border border-slate-800/60 p-8 text-center">
                <p className="text-slate-500">No past events yet.</p>
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
