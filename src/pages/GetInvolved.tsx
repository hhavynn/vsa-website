import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';

const programs = [
  {
    id: 'ace',
    tag: 'Mentorship',
    title: 'Anh Chị Em',
    subtitle: 'Your Family Away From Home',
    description: 'Meet your future bigs, build lifelong bonds, and become part of a unique lineage. Bigs, pseudos, siblings, and grands — ACE is chosen family.',
    link: '/ace',
    details: ['Big-Little Matching', 'Family Lineages', 'Year-Long Bonds'],
  },
  {
    id: 'house',
    tag: 'Competition',
    title: 'House Program',
    subtitle: 'Compete. Connect. Conquer.',
    description: 'Join one of four houses for friendly rivalries, close-knit events, and a year-long battle for the ultimate prize.',
    link: '/house-system',
    details: ['4 Houses', 'Points Competition', 'Exclusive Events'],
  },
  {
    id: 'intern',
    tag: 'Leadership',
    title: 'Intern Program',
    subtitle: 'Step Behind the Scenes',
    description: 'Shadow the cabinet, build actual leadership experience, and see exactly what it takes to run VSA from the inside out.',
    link: '/intern-program',
    details: ['Board Shadowing', 'Leadership Skills', 'Real Impact'],
  },
];

const extraLinks = [
  { label: 'Vietnamese Culture Night', link: '/vcn' },
  { label: "Wild n' Culture", link: '/wild-n-culture' },
  { label: 'Events Calendar', link: '/events' },
];

export function GetInvolved() {
  return (
    <>
      <PageTitle title="Get Involved" />

      <div className="border-b px-5 py-8 sm:px-8 lg:px-[52px]" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>Get Involved</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>
          Three pathways to find your place and build your community at UCSD
        </p>
      </div>

      <div className="px-5 py-8 sm:px-8 lg:px-[52px] lg:py-10">

        {/* Programs */}
        <div className="mb-10">
          <Label className="mb-6">Programs</Label>
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {programs.map((prog, i) => (
              <Link
                key={prog.id}
                to={prog.link}
                className="group flex flex-col items-start gap-4 border-b last:border-b-0 transition-colors duration-150 lg:flex-row lg:items-center lg:justify-between"
                style={{
                  padding: '20px 24px',
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-surface)',
                }}
              >
                <div className="flex w-full items-start gap-4 sm:gap-6">
                  <div className="w-[28px] shrink-0 pt-0.5">
                    <span className="font-mono text-[10px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-sans font-semibold text-[15px] tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                        {prog.title}
                      </span>
                      <span className="font-mono text-[10px] tracking-[.04em] uppercase" style={{ color: 'var(--color-text3)' }}>
                        {prog.tag}
                      </span>
                    </div>
                    <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)', maxWidth: 480 }}>
                      {prog.description}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {prog.details.map(d => (
                        <span
                          key={d}
                          className="font-sans text-[11px] border rounded-sm px-2 py-0.5"
                          style={{ color: 'var(--color-text3)', borderColor: 'var(--color-border)' }}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <span
                  className="font-sans text-sm shrink-0 transition-colors duration-150 lg:ml-8"
                  style={{ color: 'var(--color-text3)' }}
                >
                  Learn more →
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* More opportunities */}
        <div className="border-t pt-8" style={{ borderColor: 'var(--color-border)' }}>
          <Label className="mb-5">More Ways to Get Involved</Label>
          <div className="flex flex-wrap gap-2.5">
            {extraLinks.map(item => (
              <Link
                key={item.link}
                to={item.link}
                className="inline-flex items-center border rounded px-4 py-2 font-sans text-sm transition-colors duration-150"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
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
