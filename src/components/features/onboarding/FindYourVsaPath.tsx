import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublicApplicationLinks } from '../../../hooks/useApplicationLinks';
import type { ApplicationKey, PublicApplicationLink } from '../../../types';
import { cn } from '../../../lib/utils';

type PathId = 'events' | 'house' | 'ace' | 'intern' | 'vcn' | 'wnc';

type Path = {
  id: PathId;
  prompt: string;
  title: string;
  description: string;
  commitment: string;
  recruitment: string;
  href: string;
  keys: ApplicationKey[];
};

const PATHS: Path[] = [
  {
    id: 'events',
    prompt: 'Just want to show up',
    title: 'Start with VSA events',
    description: 'GBMs, socials, cultural events, and fundraisers are a great way to meet people. You can attend events without committing to a formal program.',
    commitment: 'Drop in when an event interests you.',
    recruitment: 'No application window for attending public events. Check the live calendar for dates.',
    href: '/events',
    keys: [],
  },
  {
    id: 'house',
    prompt: 'Find a smaller community',
    title: 'Explore the House System',
    description: 'Houses are smaller groups within VSA that meet up, build friendships, and join a friendly year-long points competition. House is NOT the same as ACE mentorship.',
    commitment: 'Ongoing participation, at your own pace.',
    recruitment: 'House applications have separate fall, winter, and spring cycles. Confirm the current window on the Get Involved page.',
    href: '/house-system',
    keys: ['house_fall', 'house_winter', 'house_spring'],
  },
  {
    id: 'ace',
    prompt: 'Find a mentor or mentee',
    title: 'Get to know ACE',
    description: 'Anh Chi Em (ACE) pairs students into mentorship families and lineages. It is a relationship-focused program, separate from House competitions.',
    commitment: 'Build connections over the academic year.',
    recruitment: 'ACE applications run in a dedicated cycle; check the live window before planning to apply.',
    href: '/ace',
    keys: ['ace_application'],
  },
  {
    id: 'intern',
    prompt: 'Try out leadership',
    title: 'Explore the Intern Program',
    description: 'Work alongside VSA cabinet to learn how events and programs are organized and what leadership involves.',
    commitment: 'Regular involvement during the internship term; exact responsibilities vary.',
    recruitment: 'Intern applications have their own window, announced by cabinet.',
    href: '/intern-program',
    keys: ['intern_application', 'cabinet_application'],
  },
  {
    id: 'vcn',
    prompt: 'Create or perform',
    title: 'Explore Vietnamese Culture Night',
    description: 'Participate in a student-led cultural production through performing or helping behind the scenes, depending on the role.',
    commitment: 'Project-based rehearsals or production work; requirements depend on the team.',
    recruitment: 'VCN teams recruit on different schedules; check for current stage and props interest forms.',
    href: '/vcn',
    keys: ['vcn_stage_ninja_interest', 'vcn_props_team_interest'],
  },
  {
    id: 'wnc',
    prompt: 'Support cultural showcases',
    title: 'Explore Wild N’ Culture',
    description: 'Learn about VSA’s collegiate comedy showcase and opportunities to join the team or attend.',
    commitment: 'Attend as an audience member or join a team when applications are available.',
    recruitment: 'Team interest forms are seasonal; public show details may be available outside recruitment.',
    href: '/wild-n-culture',
    keys: ['wnc_team_form'],
  },
];

export function getPathWindowStatus(keys: ApplicationKey[], links: PublicApplicationLink[]): string | null {
  if (keys.length === 0) return null;
  const matching = links.filter((link) => keys.includes(link.application_key));
  if (matching.some((link) => link.status === 'open' && link.target_url)) return 'Application or interest form open now';
  if (matching.some((link) => link.status === 'not_open')) return 'Application window announced, not open yet';
  if (matching.some((link) => link.status === 'closed')) return 'This application cycle has closed';
  return 'No application window announced yet';
}

/** An informational path finder, never a replacement for admin-controlled application windows. */
export function FindYourVsaPath() {
  const [selectedId, setSelectedId] = useState<PathId>('events');
  const { links, loading, error } = usePublicApplicationLinks();
  const selected = PATHS.find((path) => path.id === selectedId) ?? PATHS[0];
  const windowStatus = !loading && !error ? getPathWindowStatus(selected.keys, links) : null;

  return (
    <section aria-labelledby="find-vsa-path-heading" className="scrapbook-paper overflow-hidden p-5 sm:p-6">
      <h2 id="find-vsa-path-heading" className="vsa-section-title">
        Find your <em>VSA path</em>
      </h2>
      <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-[var(--text2)]">
        Not sure where to start? Pick what interests you. There is no wrong starting point, and you can explore more than one program.
      </p>
      <div role="group" aria-label="Choose what interests you" className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PATHS.map((path) => (
          <button
            key={path.id}
            type="button"
            aria-pressed={selectedId === path.id}
            onClick={() => setSelectedId(path.id)}
            className={cn(
              'min-h-[44px] rounded-lg border px-3 py-3 text-left font-sans text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
              selectedId === path.id
                ? 'border-[var(--brand)] bg-[var(--surface2)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] hover:border-[var(--brand)]',
            )}
          >
            {path.prompt}
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-lg border p-4 sm:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }} aria-live="polite" aria-atomic="true">
        <h3 className="font-serif text-xl font-bold text-[var(--text)]">{selected.title}</h3>
        <p className="mt-2 font-sans text-sm leading-relaxed text-[var(--text2)]">{selected.description}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">Time commitment</dt>
            <dd className="mt-1 font-sans text-sm leading-relaxed text-[var(--text)]">{selected.commitment}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">When to join</dt>
            <dd className="mt-1 font-sans text-sm leading-relaxed text-[var(--text)]">{selected.recruitment}</dd>
          </div>
        </dl>
        {windowStatus && (
          <p className="mt-3 font-sans text-xs font-semibold text-[var(--text2)]" role="status">
            {windowStatus}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={selected.href} className="vsa-btn-primary min-h-[44px] items-center px-4 py-2.5 font-sans text-sm">
            {selected.id === 'events' ? 'See upcoming events' : 'Learn about this program'}
          </Link>
          {selected.id !== 'events' && (
            <Link to="/get-involved#open-opportunities" className="vsa-btn-ghost min-h-[44px] items-center px-4 py-2.5 font-sans text-sm">
              See what’s open now
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
