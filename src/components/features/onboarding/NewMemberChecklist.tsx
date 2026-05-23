import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils';

interface ChecklistItemProps {
  step: number;
  title: string;
  description: string;
  link: string;
  completed?: boolean;
}

function ChecklistItem({ step, title, description, link, completed }: ChecklistItemProps) {
  return (
    <Link
      to={link}
      className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
    >
      <div className="group flex min-h-[76px] items-start gap-3 rounded-lg border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:bg-[var(--surface)] hover:shadow-sm sm:gap-4 sm:p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold transition-colors',
          completed
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-[var(--border2)] text-[var(--brand)] group-hover:border-[var(--brand)] group-hover:bg-[var(--brand)] group-hover:text-[#f8fbfb]'
        )}>
          {completed ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            String(step).padStart(2, '0')
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-sans text-[15px] font-semibold leading-tight text-[var(--text)] transition-colors group-hover:text-[var(--brand)]">
              {title}
            </h4>
            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.1em] opacity-80 transition-opacity group-hover:opacity-100" style={{ color: 'var(--gold-t)' }}>
              Open
            </span>
          </div>
          <p className="mt-1.5 font-sans text-[12px] leading-relaxed sm:text-xs" style={{ color: 'var(--text2)' }}>
            {description}
          </p>
        </div>

        <span className="pt-0.5 font-sans text-lg leading-none opacity-60 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" style={{ color: 'var(--brand)' }} aria-hidden>
          -&gt;
        </span>
      </div>
    </Link>
  );
}

export function NewMemberChecklist() {
  const items = [
    {
      title: 'Attend an Event',
      description: 'Check the calendar for upcoming GBMs, socials, and cultural programs.',
      link: '/events',
    },
    {
      title: 'Join the House System',
      description: 'Find your smaller community within VSA and compete for the House Cup.',
      link: '/house-system',
    },
    {
      title: 'Sign up for ACE',
      description: 'Get paired with a mentor or mentee in our lineage program.',
      link: '/ace',
    },
    {
      title: 'Check the Leaderboard',
      description: 'See how points work and track your journey as a VSA member.',
      link: '/leaderboard',
    },
    {
      title: 'Explore the Intern Program',
      description: 'Shadow cabinet and build leadership skills from the inside.',
      link: '/intern-program',
    },
    {
      title: 'Learn About VCN',
      description: 'Step into our annual culture show and production traditions.',
      link: '/vcn',
    },
    {
      title: "Visit Wild N' Culture",
      description: 'Keep up with the collegiate comedy night and showcase updates.',
      link: '/wild-n-culture',
    },
    {
      title: 'Submit Feedback',
      description: 'Have a question or suggestion? We want to hear from you.',
      link: '/feedback',
    },
  ];

  return (
    <div className="vsa-animate-slide-up scrapbook-paper relative overflow-hidden p-0">
      <div className="relative overflow-hidden border-b px-5 py-4 sm:px-6" style={{ borderColor: 'var(--border)', background: 'var(--brand)' }}>
        <div className="absolute right-5 top-0 h-12 w-28 opacity-35" aria-hidden>
          <div
            className="h-full w-full rotate-[-1deg]"
            style={{ background: 'repeating-linear-gradient(45deg, rgba(248,251,251,0.32) 0 7px, transparent 7px 14px)' }}
          />
        </div>
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#f8fbfb]/80">
              Passport Stop 01
            </p>
            <h3 className="mt-1 font-serif text-xl leading-none text-[#f8fbfb] sm:text-2xl">
              New Member <span className="italic">Checklist</span>
            </h3>
          </div>
          <span className="scrapbook-sticker scrapbook-sticker-gold shrink-0">Passport</span>
        </div>
      </div>

      <div className="grid gap-2.5 p-3 sm:p-4">
        {items.map((item, index) => (
          <ChecklistItem key={item.link} step={index + 1} {...item} />
        ))}
      </div>

      <div className="border-t px-5 py-4 sm:px-6" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-sans text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Ready when you are.
          </p>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>
            8 stamps to start your VSA story
          </p>
        </div>
      </div>
      <span className="scrapbook-pin" aria-hidden />
    </div>
  );
}
