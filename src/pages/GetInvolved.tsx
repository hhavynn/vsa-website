import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';

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
    description: 'Join one of four houses for friendly rivalries, close-knit events, and a year-long battle for the ultimate prize.',
    link: '/house-system',
    details: ['4 Houses', 'Points Competition', 'Exclusive Events'],
  },
  {
    id: 'intern',
    tag: 'Leadership',
    title: 'Intern Program',
    description: 'Shadow the cabinet, build real leadership experience, and see exactly what it takes to run VSA from the inside out.',
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

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <h1 className="vsa-page-title">Get <em>Involved</em></h1>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            Three pathways to find your place and build your community at UCSD.
          </p>
        </div>
      </div>

      <div className="vsa-container py-8 lg:py-10">
        <div className="mb-10">
          <Label className="mb-6 text-[var(--accent)]">Programs</Label>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
            {programs.map((program, index) => (
              <Link
                key={program.id}
                to={program.link}
                className="group flex flex-col items-start gap-5 border-b transition-colors duration-150 last:border-b-0 lg:flex-row lg:items-center lg:justify-between"
                style={{
                  padding: '28px 32px',
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <div className="flex w-full items-start gap-5 sm:gap-6">
                  <div className="w-[28px] shrink-0 pt-1">
                    <span className="font-mono text-[11px]" style={{ color: 'var(--accent)' }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <span className="font-sans text-[17px] font-semibold" style={{ color: 'var(--text)' }}>
                        {program.title}
                      </span>
                      <span className="rounded-full border px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}>
                        {program.tag}
                      </span>
                    </div>
                    <p className="max-w-[560px] font-sans text-sm leading-[1.7]" style={{ color: 'var(--text2)' }}>
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
                <span className="shrink-0 font-sans text-sm transition-colors duration-150 group-hover:text-[var(--brand)] lg:ml-8" style={{ color: 'var(--text3)' }}>
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
                className="inline-flex items-center rounded-lg border px-4 py-2 font-sans text-sm transition-colors duration-150 hover:border-[var(--brand)] hover:text-[var(--brand)]"
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
