import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { PageTitle } from '../components/common/PageTitle';
import { Badge, BadgeColor } from '../components/ui/Badge';
import { useEvents } from '../hooks/useEvents';
import { usePresidentsContent } from '../hooks/usePresidentsContent';
import { Event } from '../types';

const pillars = [
  { n: '01', label: 'Social', desc: 'Bonds through the ACE Program and House System' },
  { n: '02', label: 'Community', desc: 'A safe space for Vietnamese and all students alike' },
  { n: '03', label: 'Academic', desc: 'Growth alongside cultural engagement every year' },
  { n: '04', label: 'Cultural', desc: 'Heritage through VCN, Black April, and more' },
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

const PRESIDENTS_MESSAGE = {
  names: 'Gracie Nguyen & Phuong Le',
  role: 'Co-Presidents',
  greeting: 'Hello and welcome to the VSA family! 💕',
  quote: 'VSA at UC San Diego is not just a student org. It is a home away from home.',
  body: [
    'We are Gracie and Phuong, and we are beyond excited to serve as your Co-Presidents this year. Over the summer, our passionate cabinet has been planning a year full of fun, meaningful, and memorable events that we are so excited to share with you.',
    'VSA at UC San Diego is not just a student org, it is a home away from home. It is a place where strangers become close friends, and where you will find support, community, and endless opportunities to grow. Whether you are here to embrace Vietnamese culture, meet new people, or just find your place on campus, VSA has something special for you.',
    'Some of our most cherished college memories and lifelong friendships started right here. And we cannot wait for you to experience the same kind of magic.',
    'So come hang out with us. Join our events, connect with our amazing members, and become a part of something truly meaningful. We are so excited to meet you and welcome you into the family.',
    'Let us make this year one to remember, together. 🧡',
  ],
  signOff: 'With love, Gracie & Phuong',
  signature: 'Co-Presidents | VSA at UC San Diego',
};

function EventRow({ event }: { event: Event }) {
  const d = new Date(event.date);

  return (
    <div className="flex items-start gap-5 border-t py-4" style={{ borderColor: 'var(--color-border)' }}>
      <div className="w-[52px] shrink-0 border-r pr-4 text-center" style={{ borderColor: 'var(--color-border)' }}>
        <div className="font-mono text-[10px] uppercase tracking-[.06em]" style={{ color: 'var(--color-text3)' }}>
          {format(d, 'MMM')}
        </div>
        <div className="mt-0.5 font-serif text-[28px] leading-none" style={{ color: 'var(--color-text)' }}>
          {format(d, 'd')}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-sans text-[15px] font-medium leading-snug" style={{ color: 'var(--color-text)', letterSpacing: '-.01em' }}>
          {event.name}
        </div>
        {event.location && (
          <div className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
            {event.location}
          </div>
        )}
      </div>
      <Badge label={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type} color={TYPE_COLOR[event.event_type] ?? 'gray'} />
    </div>
  );
}

export function Home() {
  const { events } = useEvents();
  const { content: presidentsContent } = usePresidentsContent();

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const upcomingEvents = events
    .filter((event) => new Date(event.date) >= oneDayAgo)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  return (
    <>
      <PageTitle title="Home" />

      <section style={{ background: 'var(--color-surface)' }}>
        <div className="grid lg:grid-cols-2" style={{ minHeight: 400 }}>
          <div className="flex flex-col justify-between border-b p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-[52px]" style={{ borderColor: 'var(--color-border)' }}>
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[.1em]" style={{ color: 'var(--color-text3)' }}>
              Vietnamese Student Association / UC San Diego
            </div>
            <div>
              <h1
                className="font-serif italic leading-[.9] tracking-[-0.03em]"
                style={{ fontSize: 'clamp(3.3rem, 16vw, 4.5rem)', color: 'var(--color-text)', marginBottom: 20 }}
              >
                Culture,
                <br />
                Community.
              </h1>
              <div style={{ width: 40, height: 2, background: '#5a9af0', marginBottom: 20 }} />
              <p className="max-w-[380px] font-sans leading-[1.7]" style={{ fontSize: 15, color: 'var(--color-text2)', marginBottom: 32 }}>
                Promoting and preserving Vietnamese culture since 1977 - a home for every student at UC San Diego.
              </p>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <Link
                  to="/events"
                  className="border-b pb-[3px] font-sans text-sm font-medium transition-opacity duration-150 hover:opacity-80"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border-strong)' }}
                >
                  View Events -&gt;
                </Link>
                <Link
                  to="/get-involved"
                  className="font-sans text-sm transition-opacity duration-150 hover:opacity-80"
                  style={{ color: 'var(--color-text2)' }}
                >
                  Get Involved
                </Link>
              </div>
            </div>
            <div className="font-sans text-[11px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
              Est. 1977 / Nonprofit / Open to all students
            </div>
          </div>

          <div className="relative flex flex-col justify-between overflow-hidden p-6 sm:p-8 lg:p-[52px]">
            <div
              className="absolute right-[-8px] top-4 select-none font-serif leading-none tracking-[-0.04em]"
              style={{ fontSize: 'clamp(6rem, 28vw, 10rem)', color: 'var(--color-text)', opacity: 0.05 }}
            >
              1977
            </div>
            <div className="relative z-10 font-sans text-[11px] font-semibold uppercase tracking-[.07em]" style={{ color: 'var(--color-text3)' }}>
              By the numbers
            </div>
            <div className="relative z-10">
              {[
                ['200+', 'Active members'],
                ['50+', 'Events per year'],
                ['4', 'Core pillars'],
                ['47', 'Years of community'],
              ].map(([value, label]) => (
                <div key={label} className="flex items-baseline gap-4 border-t py-4" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="font-serif leading-none" style={{ fontSize: 38, color: 'var(--color-text)' }}>
                    {value}
                  </span>
                  <span className="font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b px-5 py-10 sm:px-8 lg:px-[52px]" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="grid gap-8 lg:grid-cols-[180px_1fr] lg:items-start lg:gap-12">
          <div>
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[.07em] text-brand-600 dark:text-brand-400">Our Four Pillars</div>
            <div className="mt-2.5 h-[1.5px] w-5 bg-brand-600 dark:bg-brand-400" />
          </div>
          <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
            {pillars.map((pillar, index) => (
              <div
                key={pillar.label}
                className="border-t py-5 sm:px-5 sm:py-0 xl:border-t-0 xl:border-l xl:px-7"
                style={{
                  borderColor: 'var(--color-border)',
                  borderLeftWidth: index === 0 ? 0 : undefined,
                }}
              >
                <div className="mb-2 font-mono text-[10px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                  {pillar.n}
                </div>
                <div className="mb-2 font-sans text-base font-semibold tracking-[-0.02em]" style={{ color: 'var(--color-text)' }}>
                  {pillar.label}
                </div>
                <div className="font-sans text-xs leading-[1.6]" style={{ color: 'var(--color-text2)' }}>
                  {pillar.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="grid gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:px-[52px] lg:py-12"
        style={{ background: 'var(--color-bg)' }}
      >
        <div>
          <div className="mb-0 flex flex-wrap items-baseline justify-between gap-3">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[.07em] text-brand-600 dark:text-brand-400">Upcoming Events</div>
            <Link to="/events" className="font-sans text-xs text-brand-600 dark:text-brand-400 transition-opacity hover:opacity-80">
              All events -&gt;
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="mt-0 border-t pt-4 font-sans text-sm" style={{ color: 'var(--color-text3)', borderColor: 'var(--color-border)' }}>
              No upcoming events - check back soon.
            </p>
          ) : (
            upcomingEvents.map((event) => <EventRow key={event.id} event={event} />)
          )}
          <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
            <Link to="/events" className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-brand-600 dark:text-brand-400 transition-opacity hover:opacity-80">
              Browse all events
            </Link>
          </div>
        </div>

        <div>
          <div className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[.07em] text-brand-600 dark:text-brand-400">About VSA</div>
          <blockquote className="mb-5 font-serif italic leading-[1.15] tracking-[-0.01em]" style={{ fontSize: 26, color: 'var(--color-text)' }}>
            "A home for every student at UC San Diego."
          </blockquote>
          <p className="mb-6 font-sans text-sm leading-[1.75]" style={{ color: 'var(--color-text2)' }}>
            The Vietnamese Student Association at UC San Diego strives to promote and preserve Vietnamese culture.
            We provide resources and a safe space for students to unite as a Vietnamese-American community.
          </p>
          <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />
        </div>
      </section>

      <section className="border-t px-5 pb-10 sm:px-8 lg:px-[52px] lg:pb-14" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="border-b p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10" style={{ borderColor: 'var(--color-border)' }}>
              <div className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[.07em] text-brand-600 dark:text-brand-400">
                Presidents
              </div>
              {presidentsContent.photoUrl ? (
                <img
                  src={presidentsContent.photoUrl}
                  alt={PRESIDENTS_MESSAGE.names}
                  className="aspect-[4/5] w-full rounded border object-cover"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              ) : (
                <div
                  className="flex aspect-[4/5] w-full items-center justify-center rounded border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
                >
                  <span className="text-center font-serif italic" style={{ fontSize: 28, color: 'var(--color-text2)' }}>
                    G + P
                  </span>
                </div>
              )}
              <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="font-sans text-[18px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--color-text)' }}>
                  {PRESIDENTS_MESSAGE.names}
                </div>
                <div className="mt-1 font-sans text-xs uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                  {PRESIDENTS_MESSAGE.role}
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 lg:p-10">
              <div className="font-sans text-[11px] font-semibold uppercase tracking-[.07em] text-brand-600 dark:text-brand-400">
                Letter From The Presidents
              </div>
              <h2 className="mt-3 font-sans text-[22px] font-semibold tracking-[-0.03em] sm:text-[24px]" style={{ color: 'var(--color-text)' }}>
                {PRESIDENTS_MESSAGE.greeting}
              </h2>
              <blockquote
                className="mt-5 max-w-3xl font-serif italic leading-[1.02] tracking-[-0.03em]"
                style={{ fontSize: 'clamp(2rem, 11vw, 3.5rem)', color: 'var(--color-text)' }}
              >
                "{PRESIDENTS_MESSAGE.quote}"
              </blockquote>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {[
                  PRESIDENTS_MESSAGE.body.slice(0, 3),
                  PRESIDENTS_MESSAGE.body.slice(3),
                ].map((column, index) => (
                  <div key={index} className="space-y-4">
                    {column.map((paragraph) => (
                      <p key={paragraph} className="font-sans text-sm leading-[1.85]" style={{ color: 'var(--color-text2)' }}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-8 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                  {PRESIDENTS_MESSAGE.signOff}
                </div>
                <div className="mt-1 font-sans text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                  {PRESIDENTS_MESSAGE.signature}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
