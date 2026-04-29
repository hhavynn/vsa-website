import { format } from 'date-fns';
import { useState } from 'react';
import { PageLoader } from '../components/common/PageLoader';
import { PageTitle } from '../components/common/PageTitle';
import { Badge, BadgeColor } from '../components/ui/Badge';
import { Label } from '../components/ui/Label';
import { AddToCalendarButton } from '../components/features/events/AddToCalendarButton';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { useEvents } from '../hooks/useEvents';
import { Event } from '../types';

type FilterKey = 'all' | Event['event_type'];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'gbm', label: 'GBM' },
  { key: 'mixer', label: 'Mixer' },
  { key: 'vcn', label: 'VCN' },
  { key: 'winter_retreat', label: 'Retreat' },
  { key: 'wildn_culture', label: "Wild n' Culture" },
  { key: 'external_event', label: 'External' },
  { key: 'other', label: 'Other' },
];

const TYPE_COLOR: Record<string, BadgeColor> = {
  gbm: 'green',
  mixer: 'blue',
  vcn: 'purple',
  wildn_culture: 'purple',
  winter_retreat: 'blue',
  other: 'gray',
  external_event: 'gray',
};


function EventImage({
  event,
  className,
  titleClassName,
}: {
  event: Event;
  className: string;
  titleClassName: string;
}) {
  if (event.image_url) {
    return <img src={event.image_url} alt={event.name} className={className} />;
  }

  return (
    <div
      className={`flex items-center justify-center border ${className}`}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
    >
      <span className={titleClassName} style={{ color: 'var(--color-text2)' }}>
        {event.name}
      </span>
    </div>
  );
}

export function Events() {
  const { events, loading, error } = useEvents();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const upcomingAll = events
    .filter((event: Event) => new Date(event.date) >= oneDayAgo)
    .sort((a: Event, b: Event) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastAll = events
    .filter((event: Event) => new Date(event.date) < oneDayAgo)
    .sort((a: Event, b: Event) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filterFn = (event: Event) => activeFilter === 'all' || event.event_type === activeFilter;
  const upcomingEvents = upcomingAll.filter(filterFn);
  const pastEvents = pastAll.filter(filterFn);
  const [featured, ...rest] = upcomingEvents;

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
        <div className="mx-auto max-w-4xl px-8 py-20 text-center">
          <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
            Error loading events: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Events" />

      <div className="border-b px-5 py-8 sm:px-8 lg:px-[52px]" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>
              Events
            </h1>
            <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
              {upcomingAll.length} upcoming / {pastAll.length} past
            </p>
          </div>

          <div className="flex flex-wrap overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)' }}>
            {FILTERS.filter((filter) => filter.key === 'all' || events.some((event) => event.event_type === filter.key)).map(
              (filter, index) => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className="font-sans text-xs transition-colors duration-150"
                  style={{
                    padding: '7px 14px',
                    fontWeight: activeFilter === filter.key ? 500 : 400,
                    background: activeFilter === filter.key ? 'var(--color-surface2)' : 'transparent',
                    color: activeFilter === filter.key ? 'var(--color-text)' : 'var(--color-text2)',
                    borderLeft: index > 0 ? '1px solid var(--color-border)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {filter.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-8 sm:px-8 lg:px-[52px] lg:py-10">
        {featured && (
          <>
            <Label className="mb-5 text-brand-600 dark:text-brand-400">Next Up</Label>
            <div
              className="mb-9 overflow-hidden rounded border lg:grid lg:grid-cols-[minmax(0,1.35fr)_320px]"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="border-b p-5 sm:p-8 lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--color-border)' }}>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Badge
                    label={EVENT_TYPE_LABELS[featured.event_type] ?? featured.event_type}
                    color={TYPE_COLOR[featured.event_type] ?? 'gray'}
                  />
                  <span className="font-mono text-[11px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                    {format(new Date(featured.date), 'MMM d / EEEE / h:mm a').toUpperCase()}
                  </span>
                </div>
                <h2 className="mb-3 font-serif text-[28px] leading-[1.1] tracking-[-0.02em] sm:text-[30px]" style={{ color: 'var(--color-text)' }}>
                  {featured.name}
                </h2>
                {featured.description && (
                  <p className="mb-5 font-sans text-sm leading-[1.65]" style={{ color: 'var(--color-text2)' }}>
                    {featured.description}
                  </p>
                )}
                {featured.location && (
                  <p className="mb-5 font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                    {featured.location}
                  </p>
                )}
                <AddToCalendarButton event={featured} variant="ghost" align="left" />
              </div>

              <div className="relative h-[220px] sm:h-[260px] lg:h-full lg:min-h-[260px] lg:max-h-[340px]">
                <EventImage
                  event={featured}
                  className="h-full w-full object-cover"
                  titleClassName="px-8 text-center font-serif italic leading-[1.04] tracking-[-0.03em] text-[34px]"
                />
                <div
                  className="absolute bottom-5 left-5 rounded border px-4 py-3 backdrop-blur-sm"
                  style={{ borderColor: 'rgba(255,255,255,0.32)', background: 'rgba(5, 9, 18, 0.58)' }}
                >
                  <div className="font-serif leading-none tracking-[-0.03em] text-brand-400" style={{ fontSize: 44 }}>
                    {format(new Date(featured.date), 'd')}
                  </div>
                  <div className="mt-1 font-mono text-[10px] tracking-[.08em] text-white/75">
                    {format(new Date(featured.date), 'MMMM yyyy').toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {rest.length > 0 && (
          <>
            <Label className="mb-0">All Upcoming</Label>
            <div className="mt-5 mb-10 border-y" style={{ borderColor: 'var(--color-border)' }}>
              {rest.map((event: Event) => (
                <div
                  key={event.id}
                  className="grid gap-4 border-t py-5 first:border-t-0 sm:grid-cols-[88px_minmax(0,1fr)] lg:grid-cols-[88px_156px_minmax(0,1fr)_auto]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="border-r pr-4 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="font-mono text-[10px] uppercase tracking-[.08em]" style={{ color: 'var(--color-text3)' }}>
                      {format(new Date(event.date), 'MMM')}
                    </div>
                    <div className="mt-1 font-serif text-[38px] leading-none" style={{ color: 'var(--color-text)' }}>
                      {format(new Date(event.date), 'd')}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[.08em]" style={{ color: 'var(--color-text3)' }}>
                      {format(new Date(event.date), 'EEE')}
                    </div>
                  </div>

                  <EventImage
                    event={event}
                    className="aspect-[4/3] w-full rounded border object-cover"
                    titleClassName="px-4 text-center font-serif italic leading-[1.08] tracking-[-0.03em] text-[24px]"
                  />

                  <div className="min-w-0 sm:col-span-2 lg:col-auto">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <Badge
                        label={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                        color={TYPE_COLOR[event.event_type] ?? 'gray'}
                      />
                      <span className="font-mono text-[11px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                        {format(new Date(event.date), 'MMM d / h:mm a').toUpperCase()}
                      </span>
                    </div>
                    <h3 className="font-sans text-[18px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--color-text)' }}>
                      {event.name}
                    </h3>
                    {event.description && (
                      <p className="mt-2 max-w-2xl font-sans text-sm leading-[1.7]" style={{ color: 'var(--color-text2)' }}>
                        {event.description}
                      </p>
                    )}
                    {event.location && (
                      <p className="mt-2 font-sans text-xs uppercase tracking-[.06em]" style={{ color: 'var(--color-text3)' }}>
                        {event.location}
                      </p>
                    )}
                  </div>

                  <div className="flex items-start sm:col-span-2 lg:col-auto lg:justify-end">
                    <AddToCalendarButton event={event} align="right" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {upcomingEvents.length === 0 && (
          <div
            className="mb-10 rounded border p-10 text-center"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
              No upcoming events - check back soon.
            </p>
          </div>
        )}

        {pastEvents.length > 0 && (
          <>
            <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />
            <div className="mt-7" style={{ opacity: 0.72 }}>
              <Label className="mb-4">Past Events / {pastEvents.length}</Label>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {pastEvents.map((event: Event) => (
                  <div
                    key={event.id}
                    className="overflow-hidden rounded border"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                  >
                    <EventImage
                      event={event}
                      className="aspect-[5/3] w-full object-cover"
                      titleClassName="px-5 text-center font-serif italic leading-[1.08] tracking-[-0.03em] text-[22px]"
                    />
                    <div className="flex items-center justify-between gap-4 border-t px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                      <span className="font-sans text-sm" style={{ color: 'var(--color-text)' }}>
                        {event.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                        {format(new Date(event.date), 'MMM d')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
