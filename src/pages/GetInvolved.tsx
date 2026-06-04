import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
import { NewMemberChecklist } from '../components/features/onboarding/NewMemberChecklist';

const programs = [
  {
    id: 'ace',
    tag: 'Mentorship',
    title: 'Anh Chi Em',
    description: 'Meet your future bigs, build lifelong bonds, and become part of a unique lineage. Bigs, pseudos, siblings, and grands make ACE feel like chosen family.',
    link: '/ace',
    details: ['Big-Little Matching', 'Family Lineages', 'Year-Long Bonds'],
  },
  {
    id: 'house',
    tag: 'Competition',
    title: 'House Program',
    description: 'Join a House for friendly rivalries, close-knit events, and a year-long battle for the ultimate prize.',
    link: '/house-system',
    details: ['House Reveal', 'Points Competition', 'Exclusive Events'],
  },
  {
    id: 'intern',
    tag: 'Leadership',
    title: 'Intern Program',
    description: 'Shadow the cabinet, build real leadership experience, and see exactly what it takes to run VSA from the inside out.',
    link: '/intern-program',
    details: ['Board Shadowing', 'Leadership Skills', 'Real Impact'],
  },
  {
    id: 'vcn',
    tag: 'Performance',
    title: 'Vietnamese Culture Night',
    description: 'Step into VSA culture through the annual student-led show, from performance and acting to production and behind-the-scenes committees.',
    link: '/vcn',
    details: ['Annual Show', 'Dance & Theatre', 'Production Teams'],
  },
  {
    id: 'wnc',
    tag: 'Showcase',
    title: "Wild N' Culture",
    description: "Join the crowd for VSA at UCSD's intercollegiate comedy competition and keep up with each year's event updates.",
    link: '/wild-n-culture',
    details: ['Comedy Night', 'Campus Teams', 'Crowd Energy'],
  },
  {
    id: 'events',
    tag: 'Start Here',
    title: 'Events Calendar',
    description: 'Find the next GBM, social, cultural program, or fundraiser and show up when you are ready.',
    link: '/events',
    details: ['GBMs', 'Socials', 'Cultural Events'],
  },
];

const extraLinks = [
  { label: 'VCN Current Show', link: '/vcn/current' },
  { label: 'VCN Archive', link: '/vcn/archive' },
  { label: 'SoCal VSA Network', link: '/uvsa-network' },
  { label: 'Leaderboard', link: '/leaderboard' },
];

export function GetInvolved() {
  return (
    <>
      <PageTitle title="Get Involved" />

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <span className="scrapbook-sticker scrapbook-sticker-teal mb-4">Choose Your Path</span>
          <h1 className="vsa-page-title">Get <em>Involved</em></h1>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            Not sure where to start? Try an event, join a program, or explore what VSA does throughout the year.
          </p>
        </div>
      </div>

      <div className="vsa-container py-8 lg:py-10">
        <div className="mb-16">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] xl:gap-8">
            <div className="scrapbook-paper overflow-hidden p-5 sm:p-6 lg:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <Label className="text-[var(--accent)]">New Member Start Here</Label>
                <span className="scrapbook-sticker scrapbook-sticker-coral">Start Here</span>
              </div>
              <h2 className="vsa-section-title mb-5">
                Your VSA
                <br />
                <em>Passport.</em>
              </h2>
              <p className="max-w-[58ch] font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
                New here or trying to get more involved? Use this checklist as a starting point.
                Try what sounds fun, skip what does not, and go at your own pace.
              </p>

              <div className="mt-6 rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--accent)' }}>
                    Route preview
                  </span>
                  <span className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ borderColor: 'var(--border2)', color: 'var(--gold-t)' }}>
                    VSA Passport
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {['Show up', 'Join in', 'Give back'].map((step, index) => (
                    <div key={step} className="flex items-center gap-2 rounded-md border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                      <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--brand)' }}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="font-sans text-[12px] font-semibold" style={{ color: 'var(--text)' }}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-xs">
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
                  <span className="block font-serif text-3xl leading-none" style={{ color: 'var(--text)' }}>01</span>
                  <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text2)' }}>Start step</span>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
                  <span className="block font-serif text-3xl leading-none" style={{ color: 'var(--text)' }}>08</span>
                  <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text2)' }}>Tasks</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/events" className="vsa-btn-primary px-4 py-2.5 text-[13px]">
                  View Events
                </Link>
                <Link to="/leaderboard" className="vsa-btn-ghost px-4 py-2.5 text-[13px]">
                  Check Points
                </Link>
              </div>
            </div>
            <div className="min-w-0">
              <NewMemberChecklist />
            </div>
          </div>
        </div>

        <div id="programs" className="mb-10">
          <Label className="mb-6 text-[var(--accent)]">Programs</Label>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {programs.map((program, index) => (
              <Link
                key={program.id}
                to={program.link}
                className={`scrapbook-paper group flex min-h-full flex-col items-start gap-4 p-5 transition-transform duration-150 scrapbook-hover-tilt sm:p-6 ${index % 2 === 0 ? 'scrapbook-rotate-sm-left' : 'scrapbook-rotate-sm-right'}`}
              >
                <span className="scrapbook-pin" aria-hidden />
                <div className="flex w-full min-w-0 items-start gap-4 sm:gap-6">
                  <div className="w-[28px] shrink-0 pt-1">
                    <span className="font-mono text-[11px]" style={{ color: 'var(--accent)' }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <span className="min-w-0 font-sans text-[17px] font-semibold" style={{ color: 'var(--text)' }}>
                        {program.title}
                      </span>
                      <span className="scrapbook-sticker scrapbook-sticker-coral">
                        {program.tag}
                      </span>
                    </div>
                    <p className="max-w-[560px] break-words font-sans text-sm leading-[1.7]" style={{ color: 'var(--text2)' }}>
                      {program.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {program.details.map((detail) => (
                        <span
                          key={detail}
                          className="rounded-sm border px-2 py-0.5 font-sans text-[11px]"
                          style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}
                        >
                          {detail}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <span className="mt-auto font-sans text-sm transition-colors duration-150 group-hover:text-[var(--brand)]" style={{ color: 'var(--text3)' }}>
                  Learn more -&gt;
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="border-t pt-8" style={{ borderColor: 'var(--border)' }}>
          <Label className="mb-5 text-[var(--accent)]">More Ways to Get Involved</Label>
          <div className="flex flex-wrap gap-2.5">
            {extraLinks.map((item) => (
              <Link
                key={item.link}
                to={item.link}
                className="inline-flex max-w-full items-center rounded-lg border px-4 py-2 font-sans text-sm text-left transition-colors duration-150 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text2)' }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
