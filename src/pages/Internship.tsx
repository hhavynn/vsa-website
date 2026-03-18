import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

// ─────────────────────────────────────────────────────────────────────────────
// INTERN PROGRAM CONFIG
// Update these values each cycle. All other page copy is evergreen.
// ─────────────────────────────────────────────────────────────────────────────
const INTERN_CONFIG = {
  // Set to true to show an "Applications Open" badge and Apply button in the CTA.
  applicationsOpen: false,
  // Link to the application form shown when applicationsOpen is true.
  applicationLink: '',
  // Short label for the current cycle, e.g. "2025–2026".
  cycleLabel: '',
  // Optional short announcement shown in the CTA, e.g. "Applications open mid-Fall Quarter."
  announcement: '',
  // Contact role label shown in the CTA (keep role-based, not person-specific).
  contactRole: 'the VSA Internal Vice President',
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC EVERGREEN CONTENT
// Update only if the program's actual structure, offerings, or values change.
// ─────────────────────────────────────────────────────────────────────────────

const pillars = [
  {
    icon: '🤝',
    title: 'Social',
    desc: 'Build lasting friendships with fellow interns and cabinet. Bond through GBMs, aftersocials, externals, and VSA events throughout the year.',
  },
  {
    icon: '🌿',
    title: 'Cultural',
    desc: 'Stay connected to Vietnamese culture and AAPI identity. Participate in events like Vietnamese Culture Night, Tet Fest, and other cultural programming.',
  },
  {
    icon: '🏘️',
    title: 'Community',
    desc: 'Help create a welcoming space for Vietnamese and non-Vietnamese students alike. Contribute to VSA\'s broader community and philanthropic work.',
  },
  {
    icon: '📈',
    title: 'Academic & Professional',
    desc: 'Build communication, planning, and leadership skills. Learn to balance commitment with your academic and personal goals.',
  },
];

const whatYouDo = [
  {
    icon: '🗓️',
    title: 'Attend Meetings & Events',
    desc: 'Participate in intern meetings, cabinet meetings, GBMs, aftersocials, and major VSA events across the year.',
  },
  {
    icon: '💬',
    title: 'Cabinet Interviews',
    desc: 'Connect one-on-one with cabinet members to learn what each role does, how they lead, and what the day-to-day looks like behind the scenes.',
  },
  {
    icon: '👁️',
    title: 'Shadow Cabinet Positions',
    desc: 'Work directly with cabinet to learn planning, operations, communication, and event execution. Shadowing helps you figure out where you want to grow.',
  },
  {
    icon: '📦',
    title: 'Support VSA Programming',
    desc: 'Help with event production, logistics, promotion, and execution across cultural, social, and community-focused VSA programming.',
  },
  {
    icon: '🚀',
    title: 'Lead an Intern Project',
    desc: 'Collaborate with your fellow interns on a major team initiative — such as an intern-led fundraiser — from idea to execution.',
  },
  {
    icon: '🔧',
    title: 'Learn VSA\'s Systems',
    desc: 'Get hands-on with the tools and processes that keep VSA running: shared drives, calendars, planning forms, reimbursements, and cross-team communication.',
  },
];

const shadowAreas = [
  { emoji: '💵', title: 'Treasurer', desc: 'Budgeting, money handling, reimbursements, funding resources, grants, and sponsorships.' },
  { emoji: '📋', title: 'Secretary', desc: 'Room booking, venue logistics, attendance tracking, meeting minutes, and planning communication.' },
  { emoji: '🌐', title: 'ICC / External', desc: 'External event coordination, union-wide collaboration, externals promotion, and ride organizing.' },
  { emoji: '🫂', title: 'ACE', desc: 'Fam event planning, ACE content creation, fam relations, and spring sorting support.' },
  { emoji: '🎉', title: 'Events', desc: 'Event planning, delegation, logistics, working with media, and real-time problem solving.' },
  { emoji: '📱', title: 'Media', desc: 'Social media, graphics, marketing strategy, promotion, and digital content.' },
  { emoji: '🎭', title: 'Vietnamese Culture Night', desc: 'Committee coordination, promotion, production logistics, props, scheduling, and show day support.' },
  { emoji: '🏘️', title: 'Community Relations', desc: 'House events, sortings, check-ins, member communications, and event calendars.' },
  { emoji: '🌸', title: 'Culture & Philanthropy', desc: 'Cultural programming, culture corners, and major community-centered events.' },
  { emoji: '🏪', title: 'Fundraising', desc: 'Fundraiser planning and aftersocials, merchant relationships, and sponsorship support.' },
  { emoji: '📸', title: 'Historian', desc: 'Photo and video capture, media archiving, and storytelling across VSA events.' },
];

const faqs = [
  {
    q: 'Who should apply?',
    a: 'Students who want to grow as leaders, get more involved in VSA, build community, and learn how a student organization runs behind the scenes. You do not need prior experience — the program is designed to teach and mentor you.',
  },
  {
    q: 'How much time does it take?',
    a: 'Expect roughly 4–8 hours per week, depending on the time of quarter and upcoming events. The program spans Fall, Winter, and Spring quarters, so the commitment varies throughout the year.',
  },
  {
    q: 'What will I actually do?',
    a: 'Attend meetings and events, build relationships with cabinet through one-on-one interviews, shadow cabinet positions to learn how VSA operates, help support event production and logistics, and collaborate with fellow interns on a team-led project.',
  },
  {
    q: 'What skills will I build?',
    a: 'Leadership, communication, teamwork, event planning, logistics, professionalism, and cultural engagement. Interns also gain practical experience with the organizational systems VSA uses day to day.',
  },
  {
    q: 'Will I get mentorship?',
    a: 'Yes. The program is built around learning directly from cabinet members through cab interviews, shadowing, collaborative projects, and ongoing feedback throughout the year.',
  },
  {
    q: 'What positions can I shadow?',
    a: 'Interns may have the opportunity to shadow a range of cabinet positions, including Events, Media, Treasurer, Secretary, ACE, VCN, Fundraising, Historian, Community Relations, Culture & Philanthropy, and ICC/External, among others. Which positions are available may vary by cycle.',
  },
  {
    q: 'How do I apply?',
    a: 'Applications typically open in Fall Quarter and include a written questionnaire followed by an interview process. Check our Instagram or current announcements for the latest application details.',
  },
  {
    q: 'Who do I contact with questions?',
    a: 'Reach out to VSA through Instagram (@vsaatucsd) or speak with a board member. For program-specific questions, contact the Internal Vice President through official VSA channels.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export function Internship() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageTitle title="Internship Program" />
      <div className="min-h-screen bg-slate-950">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/70 via-violet-950/40 to-slate-950" />
          <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-indigo-500/8 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-violet-600/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <Link
                to="/get-involved"
                className="inline-flex items-center gap-1.5 text-indigo-400/60 hover:text-indigo-400 text-sm mb-8 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Get Involved
              </Link>

              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="text-5xl">🚀</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-indigo-400 font-semibold border border-indigo-500/25 rounded-full px-3 py-1.5 bg-indigo-500/8">
                  Leadership Program
                </span>
                {INTERN_CONFIG.applicationsOpen && (
                  <span className="text-[10px] tracking-[0.25em] uppercase text-emerald-400 font-semibold border border-emerald-500/25 rounded-full px-3 py-1.5 bg-emerald-500/8">
                    Applications Open{INTERN_CONFIG.cycleLabel ? ` · ${INTERN_CONFIG.cycleLabel}` : ''}
                  </span>
                )}
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(3rem, 9vw, 5.5rem)' }}>
                Intern Program
              </h1>
              <p className="text-indigo-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                UCSD VSA · Leadership & Community
              </p>
              <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                Grow as a leader, build community, and learn how VSA works behind the scenes. The internship gives you real experience, real mentorship, and a real role in shaping the VSA experience.
              </p>
            </motion.div>
          </div>
        </div>

        {/* ── About ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <div className="grid md:grid-cols-3 gap-8 items-start">
              <div className="md:col-span-2 space-y-4">
                <h2 className="font-heading font-bold text-3xl text-white">About the Program</h2>
                <p className="text-slate-400 leading-relaxed">
                  The UCSD VSA Internship Program is a year-long leadership development experience within the Vietnamese Student Association. It gives students the opportunity to grow as leaders, contribute directly to the VSA community, and learn how the organization operates behind the scenes.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Interns are an active part of cabinet — not just helpers. The program is built around mentorship, collaboration, and hands-on involvement across VSA's four pillars: <span className="text-indigo-300">Social</span>, <span className="text-indigo-300">Cultural</span>, <span className="text-indigo-300">Community</span>, and <span className="text-indigo-300">Academic & Professional</span>.
                </p>
              </div>
            </div>
          </div>
        </RevealOnScrollWrapper>

        {/* ── Four Pillars ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">What You'll Gain</h2>
                <p className="text-slate-500 text-sm">The internship is built around VSA's four pillars of growth.</p>
              </div>
            </RevealOnScrollWrapper>
            <div className="grid sm:grid-cols-2 gap-4">
              {pillars.map((p) => (
                <RevealOnScrollWrapper key={p.title}>
                  <div className="flex gap-4 p-5 rounded-xl border border-slate-800 hover:border-indigo-500/20 bg-slate-900/30 transition-colors">
                    <span className="text-3xl flex-shrink-0 mt-0.5">{p.icon}</span>
                    <div>
                      <h3 className="font-heading font-semibold text-white mb-1.5 text-sm">{p.title}</h3>
                      <p className="text-slate-500 text-xs leading-relaxed">{p.desc}</p>
                    </div>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── What You Do ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">What Interns Do</h2>
              <p className="text-slate-500 text-sm">A hands-on role in the people, planning, and projects that make VSA run.</p>
            </div>
          </RevealOnScrollWrapper>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {whatYouDo.map((item) => (
              <RevealOnScrollWrapper key={item.title}>
                <motion.div
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className="p-5 rounded-xl border border-slate-800 hover:border-indigo-500/25 bg-slate-900/40 transition-colors h-full"
                >
                  <span className="text-2xl block mb-3">{item.icon}</span>
                  <h3 className="font-heading font-semibold text-white mb-1.5 text-sm">{item.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                </motion.div>
              </RevealOnScrollWrapper>
            ))}
          </div>
        </div>

        {/* ── Shadow Areas ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">Explore Leadership Paths</h2>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  Interns may have the opportunity to shadow a range of cabinet positions. Areas vary by cycle.
                </p>
              </div>
            </RevealOnScrollWrapper>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shadowAreas.map((area) => (
                <RevealOnScrollWrapper key={area.title}>
                  <div className="flex gap-3 p-4 rounded-xl border border-slate-800 hover:border-indigo-500/15 bg-slate-900/30 transition-colors">
                    <span className="text-xl flex-shrink-0">{area.emoji}</span>
                    <div>
                      <h3 className="font-semibold text-white text-xs mb-0.5">{area.title}</h3>
                      <p className="text-slate-600 text-xs leading-relaxed">{area.desc}</p>
                    </div>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── Application Process ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">How to Apply</h2>
              <p className="text-slate-500 text-sm">Applications open in Fall Quarter each year.</p>
            </div>
          </RevealOnScrollWrapper>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/30 via-indigo-500/20 to-transparent" />
            <div className="space-y-6 pl-16">
              {[
                {
                  step: '01',
                  title: 'Follow VSA for Announcements',
                  desc: 'Applications open in Fall Quarter. Follow @vsaatucsd on Instagram and check official VSA channels for the current application timeline.',
                },
                {
                  step: '02',
                  title: 'Complete the Application',
                  desc: 'When applications open, applicants complete a written questionnaire covering their interests, goals, and reasons for wanting to join cabinet.',
                },
                {
                  step: '03',
                  title: 'Interview',
                  desc: 'Selected applicants are invited to an "internview" — a conversation with VSA board members to learn more about you and the program.',
                },
                {
                  step: '04',
                  title: 'Join the Cohort',
                  desc: 'Accepted interns are welcomed into the program and begin their year alongside cabinet, contributing from Fall through Spring.',
                },
              ].map((item) => (
                <RevealOnScrollWrapper key={item.step}>
                  <div className="relative">
                    <div className="absolute -left-[3.25rem] top-1 w-3 h-3 rounded-full bg-indigo-500/40 border border-indigo-500/60 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-indigo-400" />
                    </div>
                    <div className="p-5 rounded-xl border border-slate-800 hover:border-indigo-500/20 bg-slate-900/30 transition-colors">
                      <span className="text-[10px] tracking-widest uppercase text-indigo-400/60 font-semibold">Step {item.step}</span>
                      <h3 className="font-heading font-semibold text-white mt-1 mb-2">{item.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">FAQ</h2>
                <p className="text-slate-500 text-sm">Common questions about the internship.</p>
              </div>
            </RevealOnScrollWrapper>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <RevealOnScrollWrapper key={i}>
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      aria-expanded={openFaq === i}
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-900/40 transition-colors"
                    >
                      <span className="text-white font-medium text-sm">{faq.q}</span>
                      <motion.span
                        animate={{ rotate: openFaq === i ? 45 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-indigo-400/60 flex-shrink-0 ml-4 text-lg leading-none"
                        aria-hidden="true"
                      >
                        +
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {openFaq === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <p className="px-5 pb-4 text-slate-500 text-sm leading-relaxed border-t border-slate-800 pt-3">
                            {faq.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-900/25 to-violet-900/15 border border-indigo-500/20 p-8 sm:p-10 text-center">
              <p className="text-4xl mb-4">🚀</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Ready to Be Part of Cabinet?</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-7">
                {INTERN_CONFIG.announcement
                  ? INTERN_CONFIG.announcement
                  : `Applications open in Fall Quarter. Follow our Instagram for the latest intern program announcements and application info. Questions? Reach out to ${INTERN_CONFIG.contactRole} through official VSA channels.`}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {INTERN_CONFIG.applicationsOpen && INTERN_CONFIG.applicationLink ? (
                  <a
                    href={INTERN_CONFIG.applicationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors text-sm"
                  >
                    Apply Now{INTERN_CONFIG.cycleLabel ? ` · ${INTERN_CONFIG.cycleLabel}` : ''}
                  </a>
                ) : null}
                <a
                  href="https://www.instagram.com/vsaatucsd/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  Follow @vsaatucsd
                </a>
                <Link
                  to="/get-involved"
                  className="inline-flex items-center gap-2 px-6 py-2.5 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
                >
                  ← All Programs
                </Link>
              </div>
            </div>
          </div>
        </RevealOnScrollWrapper>

      </div>
    </>
  );
}
