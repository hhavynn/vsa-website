import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';

const ACE_CONFIG = {
  applicationsOpen: false,
  applicationLink: '',
  cycleLabel: 'Spring 2026 Cycle',
  contactNote: '',
};

const roles = [
  { role: 'Big', viet: 'Anh / Chị', desc: 'A supportive VSA member who helps guide and welcome their Little into the community. Think of your Big as an older sibling, mentor, or trusted friend.' },
  { role: 'Little', viet: 'Em', desc: 'Someone who receives support and guidance from their Big. As a Little, you gain a built-in support system and a connection to an entire fam.' },
  { role: 'Fam', viet: 'Gia Đình', desc: 'The family line built through the Big/Little system. When a Big picks up a Little and that Little later picks up their own Little, the line grows into a multi-generation family tree.' },
];

const steps = [
  { num: '01', title: 'Attend VSA Events', desc: 'Get involved in VSA early. Both Bigs and Littles are expected to meet participation requirements before applications open — details are announced each cycle.' },
  { num: '02', title: 'Meet the Community', desc: 'Connect with potential Bigs or Littles at VSA events, Welcome Week activities, and ACE-hosted socials and mixers throughout the quarter.' },
  { num: '03', title: 'Apply When Ready', desc: 'When applications open, Littles share their intro materials and Bigs submit a profile. Application timelines and materials are announced each cycle.' },
  { num: '04', title: 'ACE Reveal & Fam Life', desc: "Your Big is revealed! You're officially part of a fam — with connections to a multi-generation lineage and seasonal programming throughout the year." },
];

const perks = [
  { title: 'Mentorship & Guidance', desc: 'Your Big has walked the path you are on. Get honest advice, insider knowledge, and a trusted support system.' },
  { title: 'Friendship & Belonging', desc: 'ACE is designed to make VSA feel smaller, warmer, and more connected — a family away from home.' },
  { title: 'Shared Culture & Connection', desc: 'Connect with people who share your interests, backgrounds, values, and career goals.' },
  { title: 'A Family Lineage', desc: 'Become part of a multi-generation fam with unique traditions, inside jokes, and a shared history that grows every year.' },
];

const experienceTypes = [
  { title: 'Welcome Mixers', desc: 'Low-pressure social events at the start of each ACE cycle designed to help potential Bigs and Littles meet, mingle, and make connections.' },
  { title: 'Big Appreciation', desc: 'Seasonal programming dedicated to celebrating the Bigs who show up for their Littles — because being a mentor deserves recognition.' },
  { title: 'Fam Competitions', desc: 'Fams go head-to-head in friendly challenges and games throughout the year, building team spirit and fam pride along the way.' },
  { title: 'Reveals & Seasonal Events', desc: 'Each cycle concludes with an ACE reveal. Programming continues across quarters to keep fams active, bonded, and engaged year-round.' },
];

const faqs = [
  { q: 'What is ACE?', a: 'ACE stands for Anh Chị Em — Vietnamese for "older brother, older sister, younger sibling." It is VSA\'s Big/Little family program, built to help members find mentorship, community, and a family away from home.' },
  { q: 'What is a Big?', a: 'A Big (Anh/Chị) is a supportive VSA member who helps guide and welcome their Little into the community. Think of a Big as an older sibling, mentor, or trusted friend.' },
  { q: 'What is a Little?', a: 'A Little (Em) is someone who receives support and guidance from their Big during their VSA experience. As a Little, you gain a built-in support system and a connection to a fam.' },
  { q: 'What is a Fam?', a: 'A Fam is the family line created through the Big/Little system. When a Big picks up a Little, and that Little later picks up their own Little, the line grows into a multi-generation family tree.' },
  { q: 'How do I meet potential Bigs or Littles?', a: 'Attend VSA events and ACE socials throughout the quarter. Welcome Week and early-quarter mixers are a great time to meet people. Following VSA on Instagram is the best way to stay up to date.' },
  { q: 'Do requirements change each cycle?', a: 'Yes — eligibility requirements, event attendance expectations, and application materials may vary from cycle to cycle. Always refer to current VSA announcements for the latest details.' },
  { q: 'How do I know when applications open?', a: "Application dates are announced through VSA's Instagram and other official channels at the start of each ACE cycle. Follow @vsaatucsd to stay informed." },
  { q: 'Who should I contact for current ACE questions?', a: 'Reach out to VSA through Instagram (@vsaatucsd) or speak with a board member. The current ACE Chair is identified through VSA\'s official announcements each year.' },
];

export function Ace() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageTitle title="ACE Program" />

      {/* Page header */}
      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <div className="flex items-center gap-2 mb-3">
          <Link to="/get-involved" className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>Get Involved</Link>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>→</span>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text2)' }}>ACE</span>
        </div>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>Anh Chị Em</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>
          VSA's Big/Little family program · {ACE_CONFIG.cycleLabel}
          {ACE_CONFIG.applicationsOpen && (
            <span className="ml-3 inline-flex items-center font-sans text-[11px] font-semibold text-brand-600 dark:text-brand-400">
              Applications Open
            </span>
          )}
        </p>
      </div>

      <div style={{ padding: '40px 52px' }}>

        {/* CTA if apps open */}
        {ACE_CONFIG.applicationsOpen && ACE_CONFIG.applicationLink && (
          <div className="border rounded p-5 mb-8 flex items-center justify-between" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div>
              <div className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>Applications are now open</div>
              <div className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text3)' }}>{ACE_CONFIG.cycleLabel}</div>
            </div>
            <a
              href={ACE_CONFIG.applicationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-sm font-medium px-4 py-2 rounded border border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-white dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-400 dark:hover:text-zinc-950 transition-colors duration-150"
            >
              Apply Now →
            </a>
          </div>
        )}

        {/* What is ACE */}
        <div className="mb-10">
          <Label className="mb-4">What is ACE?</Label>
          <p className="font-sans text-sm leading-[1.75]" style={{ color: 'var(--color-text2)', maxWidth: 640 }}>
            ACE stands for <span className="font-medium" style={{ color: 'var(--color-text)' }}>Anh Chị Em</span> — Vietnamese for "older brother, older sister, younger sibling." It is VSA's Big/Little family program built to help members find mentorship, community, and a family away from home.
          </p>
          <p className="font-sans text-sm leading-[1.75] mt-3" style={{ color: 'var(--color-text2)', maxWidth: 640 }}>
            Whether you are new to VSA or returning, ACE helps you find your place and your people. Members are paired based on shared interests, backgrounds, values, and career goals — and those connections grow into multi-generation family lines that last long after graduation.
          </p>
        </div>

        {/* Roles */}
        <div className="mb-10">
          <Label className="mb-4">Big, Little & Fam</Label>
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {roles.map((r, i) => (
              <div
                key={r.role}
                className="border-b last:border-b-0"
                style={{ padding: '16px 20px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono text-[10px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{r.role}</span>
                  <span className="font-sans text-xs italic" style={{ color: 'var(--color-text3)' }}>{r.viet}</span>
                </div>
                <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Why Join */}
        <div className="mb-10">
          <Label className="mb-4">Why Join ACE?</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {perks.map(p => (
              <div key={p.title} className="border-l pl-5" style={{ borderColor: 'var(--color-border)' }}>
                <div className="font-sans text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{p.title}</div>
                <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="mb-10">
          <Label className="mb-4">How ACE Works</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
            {steps.map((step, i) => (
              <div
                key={step.num}
                className="border-l px-5 pb-4"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="font-serif leading-none mb-3" style={{ fontSize: 32, color: 'var(--color-text3)' }}>{step.num}</div>
                <div className="font-sans text-sm font-semibold mb-1.5" style={{ color: 'var(--color-text)' }}>{step.title}</div>
                <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
          <p className="font-sans text-xs mt-4" style={{ color: 'var(--color-text3)' }}>
            Eligibility requirements and application timelines are announced each cycle. Follow @vsaatucsd for current details.
          </p>
        </div>

        {/* ACE Experience */}
        <div className="mb-10">
          <Label className="mb-4">The ACE Experience</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {experienceTypes.map(ev => (
              <div key={ev.title} className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="font-sans text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{ev.title}</div>
                <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>{ev.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-10">
          <Label className="mb-4">FAQ</Label>
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {faqs.map((faq, i) => (
              <div key={i} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between text-left transition-colors duration-150"
                  style={{ padding: '14px 20px', background: 'var(--color-surface)', border: 'none', cursor: 'pointer' }}
                >
                  <span className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>{faq.q}</span>
                  <span className="font-sans text-lg ml-4 shrink-0" style={{ color: 'var(--color-text3)', transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="border-t" style={{ padding: '12px 20px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                    <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer links */}
        <div className="border-t pt-6 flex gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <a
            href="https://www.instagram.com/vsaatucsd/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-sm font-medium px-4 py-2 rounded transition-colors duration-150"
            style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}
          >
            Follow @vsaatucsd
          </a>
          <Link
            to="/get-involved"
            className="font-sans text-sm px-4 py-2 rounded border transition-colors duration-150"
            style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}
          >
            ← All Programs
          </Link>
        </div>

      </div>
    </>
  );
}
