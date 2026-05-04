import { CSSProperties } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { PageTitle } from '../components/common/PageTitle';
import { Badge, BadgeColor } from '../components/ui/Badge';
import { useEvents } from '../hooks/useEvents';
import { usePresidentsContent } from '../hooks/usePresidentsContent';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { Event } from '../types';

const pillars = [
  {
    n: '01',
    label: 'Social',
  },
  {
    n: '02',
    label: 'Community',
  },
  {
    n: '03',
    label: 'Cultural',
  },
  {
    n: '04',
    label: 'Academic',
  },
];

const particleSeeds = [
  [14, 12, 2.5, '#3bbdb5', '-28px', 5.2, 0.2],
  [22, 31, 3.6, '#f07858', '36px', 7.1, 1.1],
  [35, 18, 2.8, '#e8a838', '14px', 6.4, 2.2],
  [47, 38, 4.3, '#2a9d8f', '-42px', 8.2, 0.8],
  [55, 20, 2.3, '#3bbdb5', '22px', 4.9, 3.6],
  [63, 44, 4.8, '#f07858', '-18px', 7.8, 1.7],
  [72, 15, 3.4, '#e8a838', '44px', 5.8, 2.9],
  [80, 34, 2.6, '#2a9d8f', '-34px', 6.9, 0.5],
  [18, 48, 4.1, '#e8a838', '30px', 8.4, 4.1],
  [40, 8, 2.2, '#3bbdb5', '-16px', 5.5, 2.7],
  [68, 52, 3.2, '#f07858', '18px', 7.4, 3.3],
  [88, 24, 2.9, '#3bbdb5', '-24px', 6.2, 1.4],
] as const;

const TYPE_COLOR: Record<string, BadgeColor> = {
  gbm: 'green',
  mixer: 'red',
  vcn: 'yellow',
  wildn_culture: 'yellow',
  winter_retreat: 'red',
  other: 'gray',
  external_event: 'gray',
};

const PRESIDENTS_MESSAGE = {
  names: 'Gracie Nguyen & Phuong Le',
  role: 'Co-Presidents',
  greeting: 'Hello and welcome to the VSA family! 💕',
  body: [
    'We’re Gracie and Phuong, and we’re beyond excited to serve as your Co-Presidents this year! Over the summer, our passionate cabinet has been planning a year full of fun, meaningful, and memorable events that we’re so excited to share with you.',
    'VSA at UC San Diego isn’t just a student org, it’s a home away from home. It’s a place where strangers become close friends, and where you’ll find support, community, and endless opportunities to grow. Whether you’re here to embrace Vietnamese culture, meet new people, or just find your place on campus, VSA has something special for you.',
    'Some of our most cherished college memories and lifelong friendships started right here. And we can’t wait for you to experience the same kind of magic.',
    'So come hang out with us! Join our events, connect with our amazing members, and become a part of something truly meaningful. We’re so excited to meet you and welcome you into the family.',
    'Let’s make this year one to remember, together. 🧡',
  ],
  signOff: 'With love,',
  signature: 'Co-Presidents | VSA at UC San Diego',
};

function EventRow({ event }: { event: Event }) {
  const d = new Date(event.date);

  return (
    <div className="vsa-event-row">
      <div className="border-r pr-4 text-center" style={{ borderColor: 'var(--border)' }}>
        <div className="font-sans text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--text3)' }}>
          {format(d, 'MMM')}
        </div>
        <div className="font-serif text-[32px] leading-[1.1]" style={{ color: 'var(--text)' }}>
          {format(d, 'd')}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-sans text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
          {event.name}
        </div>
        {event.location && (
          <div className="mt-1 truncate font-sans text-xs" style={{ color: 'var(--text3)' }}>
            {event.location}
          </div>
        )}
      </div>
      <Badge
        label={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
        color={TYPE_COLOR[event.event_type] ?? 'gray'}
        className="hidden sm:inline-flex"
      />
    </div>
  );
}

export function Home() {
  const { events } = useEvents();
  const { content: presidentsContent } = usePresidentsContent();
  const { settings: siteSettings } = useSiteSettings();
  const logoSrc = siteSettings.logoUrl || `${process.env.PUBLIC_URL || ''}/images/vsa-logo.jpg`;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const upcomingEvents = events
    .filter((event) => new Date(event.date) >= oneDayAgo)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  return (
    <>
      <PageTitle title="Home" />

      <section className="relative flex min-h-[calc(100vh-60px)] items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 60% 30%, var(--glow), transparent 70%), radial-gradient(ellipse 50% 50% at 20% 80%, var(--glow-coral), transparent 70%)',
          }}
        />
        <div className="absolute inset-0 pointer-events-none">
          {particleSeeds.map(([left, bottom, size, color, dx, duration, delay], index) => (
            <span
              key={index}
              className="vsa-particle"
              style={{
                left: `${left}%`,
                bottom: `${bottom}%`,
                width: size,
                height: size,
                background: color,
                opacity: 0.6,
                '--dx': dx,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              } as CSSProperties}
            />
          ))}
        </div>

        <div className="vsa-container relative z-10 w-full">
          <div className="grid min-h-[calc(100vh-60px)] lg:grid-cols-2">
            <div className="flex flex-col justify-center border-b py-16 lg:border-b-0 lg:border-r lg:px-12 lg:py-20 xl:px-16" style={{ borderColor: 'var(--border)' }}>
              <div className="vsa-animate-slide-up mb-6 flex items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text3)' }}>
                <span className="h-[1.5px] w-8 bg-[var(--brand)]" />
                Vietnamese Student Association / UC San Diego
              </div>
              <h1 className="vsa-animate-slide-up vsa-delay-1 font-serif text-[clamp(52px,8vw,82px)] leading-[0.9] tracking-[-0.03em]" style={{ color: 'var(--text)' }}>
                Culture,
                <br />
                <span className="italic" style={{ color: 'var(--brand)' }}>Community.</span>
              </h1>
              <p className="vsa-animate-slide-up vsa-delay-2 mt-7 max-w-[400px] font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
                Promoting and preserving Vietnamese culture since 1977. If you are new here, come to an event and let us introduce you around.
              </p>
              <div className="vsa-animate-slide-up vsa-delay-3 mt-10 flex flex-wrap gap-3">
                <Link to="/get-involved" className="vsa-btn-primary">Join VSA</Link>
                <Link to="/events" className="vsa-btn-ghost">View Events -&gt;</Link>
              </div>

              <div className="vsa-animate-fade-in vsa-delay-4 mt-12">
                <div className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text3)' }}>
                  VSA Pillars
                </div>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
                  {pillars.map((pillar) => (
                    <div
                      key={pillar.label}
                      className="flex min-h-[76px] flex-col justify-center gap-1 px-4 py-3"
                      style={{ background: 'var(--bg)' }}
                    >
                      <span className="font-mono text-[10px]" style={{ color: 'var(--accent)' }}>{pillar.n}</span>
                      <span className="font-sans text-[13px] font-semibold leading-none" style={{ color: 'var(--text)' }}>{pillar.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="vsa-animate-fade-in vsa-delay-4 mt-8 flex gap-8 border-t pt-8" style={{ borderColor: 'var(--border)' }}>
                {[
                  ['1977', 'Est.'],
                  ['500+', 'Members'],
                  ['20+', 'Events/Year'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <div className="font-serif text-[32px] leading-none" style={{ color: 'var(--text)' }}>{value}</div>
                    <div className="mt-1 font-sans text-[11px] tracking-[0.04em]" style={{ color: 'var(--text3)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden py-12 lg:p-20">
              <div className="relative aspect-square w-[min(360px,80%)]" style={{ animation: 'vsa-float 7s ease-in-out infinite' }}>
                <div
                  className="pointer-events-none absolute inset-[-20%]"
                  style={{
                    background: 'radial-gradient(circle, rgba(240,120,88,0.2) 0%, transparent 70%)',
                    animation: 'vsa-glow-pulse 3s ease-in-out infinite',
                  }}
                />
                <img
                  src={logoSrc}
                  alt={siteSettings.logoAlt || 'VSA logo lantern'}
                  className="h-full w-full object-contain"
                  style={{ filter: 'drop-shadow(0 0 60px rgba(240,120,88,0.35)) drop-shadow(0 0 120px rgba(232,98,58,0.15))' }}
                />
              </div>
              <p className="mt-8 text-center font-sans text-[13px] tracking-[0.04em]" style={{ color: 'var(--text3)' }}>
                Est. 1977 / Nonprofit / Open to all UCSD students
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="vsa-section" style={{ background: 'var(--bg)' }}>
        <div className="vsa-container">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className="vsa-section-label">Start Here If You're New</div>
              <h2 className="vsa-section-title">
                Come to our
                <br />
                <em>next event.</em>
              </h2>
              <p className="vsa-section-sub max-w-[420px]">
                All events are open to every UCSD student. No experience required, just show up.
              </p>
              <div className="mt-7">
                <Link to="/events" className="vsa-btn-primary">See All Events</Link>
              </div>
            </div>
            <div>
              <div className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text3)' }}>
                Upcoming
              </div>
              {upcomingEvents.length === 0 ? (
                <div className="border-y py-5 font-sans text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text3)' }}>
                  No upcoming events. Check back soon.
                </div>
              ) : (
                upcomingEvents.map((event) => <EventRow key={event.id} event={event} />)
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="vsa-message-section">
        <div className="vsa-container">
          <div className="grid gap-12 lg:grid-cols-[1fr_220px] lg:items-start">
            <div>
              <div className="vsa-section-label">Presidents</div>
              <h2 className="vsa-section-title max-w-[720px]">
                {PRESIDENTS_MESSAGE.greeting}
              </h2>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {PRESIDENTS_MESSAGE.body.map((paragraph) => (
                  <p key={paragraph} className="font-sans text-sm leading-[1.9]" style={{ color: 'var(--text2)' }}>
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="mt-7 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
                <div className="font-sans text-sm" style={{ color: 'var(--text3)' }}>{PRESIDENTS_MESSAGE.signOff}</div>
                <div className="mt-1 font-serif text-xl italic" style={{ color: 'var(--accent)' }}>Gracie &amp; Phuong</div>
                <div className="mt-1 font-sans text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>{PRESIDENTS_MESSAGE.signature}</div>
              </div>
            </div>
            <div>
              {presidentsContent.photoUrl ? (
                <img
                  src={presidentsContent.photoUrl}
                  alt={PRESIDENTS_MESSAGE.names}
                  className="aspect-[3/4] w-full rounded-2xl border object-cover"
                  style={{ borderColor: 'var(--border)' }}
                />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg,var(--surface2),var(--bg2))' }}>
                  <span className="font-serif text-[28px] italic" style={{ color: 'var(--text3)' }}>G + P</span>
                </div>
              )}
              <div className="mt-3 border-t py-3" style={{ borderColor: 'var(--border)' }}>
                <div className="font-sans text-sm font-semibold" style={{ color: 'var(--text)' }}>Gracie &amp; Phuong</div>
                <div className="mt-1 font-sans text-[11px] uppercase tracking-[0.07em]" style={{ color: 'var(--text3)' }}>Co-Presidents</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
