import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';

// ─────────────────────────────────────────────────────────────────────────────
// INTERN PROGRAM CONFIG — Update these values each cycle.
// ─────────────────────────────────────────────────────────────────────────────
const INTERN_CONFIG = {
  applicationsOpen: false,
  applicationLink: '',
  cycleLabel: '',
  announcement: '',
  contactRole: 'the VSA Internal Vice President',
};

const pillars = [
  { title: 'Social', desc: 'Build lasting friendships with fellow interns and cabinet. Bond through GBMs, aftersocials, externals, and VSA events throughout the year.' },
  { title: 'Cultural', desc: 'Stay connected to Vietnamese culture and AAPI identity. Participate in events like Vietnamese Culture Night, Tet Fest, and other cultural programming.' },
  { title: 'Community', desc: "Help create a welcoming space for Vietnamese and non-Vietnamese students alike. Contribute to VSA's broader community and philanthropic work." },
  { title: 'Academic & Professional', desc: 'Build communication, planning, and leadership skills. Learn to balance commitment with your academic and personal goals.' },
];

const whatYouDo = [
  { title: 'Attend Meetings & Events', desc: 'Participate in intern meetings, cabinet meetings, GBMs, aftersocials, and major VSA events across the year.' },
  { title: 'Cabinet Interviews', desc: 'Connect one-on-one with cabinet members to learn what each role does, how they lead, and what the day-to-day looks like behind the scenes.' },
  { title: 'Shadow Cabinet Positions', desc: 'Work directly with cabinet to learn planning, operations, communication, and event execution. Shadowing helps you figure out where you want to grow.' },
  { title: 'Support VSA Programming', desc: 'Help with event production, logistics, promotion, and execution across cultural, social, and community-focused VSA programming.' },
  { title: 'Lead an Intern Project', desc: 'Collaborate with your fellow interns on a major team initiative — such as an intern-led fundraiser — from idea to execution.' },
  { title: "Learn VSA's Systems", desc: "Get hands-on with the tools and processes that keep VSA running: shared drives, calendars, planning forms, reimbursements, and cross-team communication." },
];

const shadowAreas = [
  { title: 'Treasurer', desc: 'Budgeting, money handling, reimbursements, funding resources, grants, and sponsorships.' },
  { title: 'Secretary', desc: 'Room booking, venue logistics, attendance tracking, meeting minutes, and planning communication.' },
  { title: 'ICC / External', desc: 'External event coordination, union-wide collaboration, externals promotion, and ride organizing.' },
  { title: 'ACE', desc: 'Fam event planning, ACE content creation, fam relations, and spring sorting support.' },
  { title: 'Events', desc: 'Event planning, delegation, logistics, working with media, and real-time problem solving.' },
  { title: 'Media', desc: 'Social media, graphics, marketing strategy, promotion, and digital content.' },
  { title: 'Vietnamese Culture Night', desc: 'Committee coordination, promotion, production logistics, props, scheduling, and show day support.' },
  { title: 'Community Relations', desc: 'House events, sortings, check-ins, member communications, and event calendars.' },
  { title: 'Culture & Philanthropy', desc: 'Cultural programming, culture corners, and major community-centered events.' },
  { title: 'Fundraising', desc: 'Fundraiser planning and aftersocials, merchant relationships, and sponsorship support.' },
  { title: 'Historian', desc: 'Photo and video capture, media archiving, and storytelling across VSA events.' },
];

const faqs = [
  { q: 'Who should apply?', a: 'Students who want to grow as leaders, get more involved in VSA, build community, and learn how a student organization runs behind the scenes. You do not need prior experience — the program is designed to teach and mentor you.' },
  { q: 'How much time does it take?', a: 'Expect roughly 4–8 hours per week, depending on the time of quarter and upcoming events. The program spans Fall, Winter, and Spring quarters, so the commitment varies throughout the year.' },
  { q: 'What will I actually do?', a: 'Attend meetings and events, build relationships with cabinet through one-on-one interviews, shadow cabinet positions to learn how VSA operates, help support event production and logistics, and collaborate with fellow interns on a team-led project.' },
  { q: 'What skills will I build?', a: 'Leadership, communication, teamwork, event planning, logistics, professionalism, and cultural engagement. Interns also gain practical experience with the organizational systems VSA uses day to day.' },
  { q: 'Will I get mentorship?', a: 'Yes. The program is built around learning directly from cabinet members through cab interviews, shadowing, collaborative projects, and ongoing feedback throughout the year.' },
  { q: 'What positions can I shadow?', a: 'Interns may have the opportunity to shadow a range of cabinet positions, including Events, Media, Treasurer, Secretary, ACE, VCN, Fundraising, Historian, Community Relations, Culture & Philanthropy, and ICC/External, among others. Which positions are available may vary by cycle.' },
  { q: 'How do I apply?', a: 'Applications typically open in Fall Quarter and include a written questionnaire followed by an interview process. Check our Instagram or current announcements for the latest application details.' },
  { q: 'Who do I contact with questions?', a: 'Reach out to VSA through Instagram (@vsaatucsd) or speak with a board member. For program-specific questions, contact the Internal Vice President through official VSA channels.' },
];

export function Internship() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageTitle title="Intern Program" />

      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <div className="flex items-center gap-2 mb-3">
          <Link to="/get-involved" className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>Get Involved</Link>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>→</span>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text2)' }}>Intern Program</span>
        </div>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>Intern Program</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>
          Leadership development · UCSD VSA
          {INTERN_CONFIG.applicationsOpen && (
            <span className="ml-3 font-sans text-[11px] font-semibold text-brand-600 dark:text-brand-400">
              Applications Open{INTERN_CONFIG.cycleLabel ? ` · ${INTERN_CONFIG.cycleLabel}` : ''}
            </span>
          )}
        </p>
      </div>

      <div style={{ padding: '40px 52px' }}>

        {/* CTA */}
        {INTERN_CONFIG.applicationsOpen && INTERN_CONFIG.applicationLink && (
          <div className="border rounded p-5 mb-8 flex items-center justify-between" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div>
              <div className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>Applications are now open</div>
              {INTERN_CONFIG.cycleLabel && <div className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text3)' }}>{INTERN_CONFIG.cycleLabel}</div>}
            </div>
            <a href={INTERN_CONFIG.applicationLink} target="_blank" rel="noopener noreferrer" className="font-sans text-sm font-medium px-4 py-2 rounded border border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-white dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-400 dark:hover:text-zinc-950 transition-colors duration-150">
              Apply Now →
            </a>
          </div>
        )}

        {/* About */}
        <div className="mb-10">
          <Label className="mb-4">About the Program</Label>
          <p className="font-sans text-sm leading-[1.75]" style={{ color: 'var(--color-text2)', maxWidth: 640 }}>
            The UCSD VSA Internship Program is a year-long leadership development experience within the Vietnamese Student Association. It gives students the opportunity to grow as leaders, contribute directly to the VSA community, and learn how the organization operates behind the scenes.
          </p>
          <p className="font-sans text-sm leading-[1.75] mt-3" style={{ color: 'var(--color-text2)', maxWidth: 640 }}>
            Interns are an active part of cabinet — not just helpers. The program is built around mentorship, collaboration, and hands-on involvement across VSA's four pillars: Social, Cultural, Community, and Academic & Professional.
          </p>
        </div>

        {/* Four Pillars */}
        <div className="mb-10">
          <Label className="mb-4">Four Pillars</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
            {pillars.map((p) => (
              <div key={p.title} className="border-l px-5 pb-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="font-sans text-sm font-semibold mb-1.5" style={{ color: 'var(--color-text)' }}>{p.title}</div>
                <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What You'll Do */}
        <div className="mb-10">
          <Label className="mb-4">What You'll Do</Label>
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {whatYouDo.map((item) => (
              <div key={item.title} className="flex items-start gap-6 border-b last:border-b-0" style={{ padding: '14px 20px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="font-sans text-sm font-semibold shrink-0" style={{ color: 'var(--color-text)', width: 180 }}>{item.title}</div>
                <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Shadow Areas */}
        <div className="mb-10">
          <Label className="mb-4">Shadow Areas</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 32px' }}>
            {shadowAreas.map((area) => (
              <div key={area.title} className="border-t py-3" style={{ borderColor: 'var(--color-border)' }}>
                <div className="font-sans text-sm font-semibold mb-0.5" style={{ color: 'var(--color-text)' }}>{area.title}</div>
                <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>{area.desc}</p>
              </div>
            ))}
          </div>
          <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />
        </div>

        {/* FAQ */}
        <div className="mb-10">
          <Label className="mb-4">FAQ</Label>
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {faqs.map((faq, i) => (
              <div key={i} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between text-left"
                  style={{ padding: '14px 20px', background: 'var(--color-surface)', border: 'none', cursor: 'pointer' }}
                >
                  <span className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>{faq.q}</span>
                  <span style={{ color: 'var(--color-text3)', transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block', fontSize: 18, marginLeft: 16, flexShrink: 0 }}>+</span>
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

        <div className="border-t pt-6 flex gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="font-sans text-sm font-medium px-4 py-2 rounded" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}>
            Follow @vsaatucsd
          </a>
          <Link to="/get-involved" className="font-sans text-sm px-4 py-2 rounded border" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}>
            ← All Programs
          </Link>
        </div>

      </div>
    </>
  );
}
