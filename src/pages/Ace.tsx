import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

// ─────────────────────────────────────────────────────────────────────────────
// ACE PROGRAM CONFIG
// Update these values each cycle. All other page copy is evergreen and requires
// no editing from year to year.
// ─────────────────────────────────────────────────────────────────────────────
const ACE_CONFIG = {
  // Set to true to show the "Applications Open" banner in the CTA section.
  applicationsOpen: true,
  // Optional link shown when applicationsOpen is true.
  applicationLink: 'https://tr.ee/RMTKBTRUPi',
  // Optional short label shown in the CTA, e.g. "Fall 2025 Cycle"
  cycleLabel: 'Spring 2026 Cycle',
  // Optional contact override. Leave empty to fall back to the VSA Instagram.
  contactNote: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC EVERGREEN CONTENT
// These arrays are intentionally free of year-specific details. Only update
// them if the program's structure, values, or terminology actually changes.
// ─────────────────────────────────────────────────────────────────────────────

const roles = [
  {
    role: 'Big',
    viet: 'Anh / Chị',
    emoji: '🌳',
    desc: 'A supportive VSA member who helps guide and welcome their Little into the community. Think of your Big as an older sibling, mentor, or trusted friend.',
  },
  {
    role: 'Little',
    viet: 'Em',
    emoji: '🌱',
    desc: 'Someone who receives support and guidance from their Big. As a Little, you gain a built-in support system and a connection to an entire fam.',
  },
  {
    role: 'Fam',
    viet: 'Gia Đình',
    emoji: '🏡',
    desc: 'The family line built through the Big/Little system. When a Big picks up a Little and that Little later picks up their own Little, the line grows into a multi-generation family tree.',
  },
];

const steps = [
  {
    num: '01',
    title: 'Attend VSA Events',
    desc: 'Get involved in VSA early. Both Bigs and Littles are expected to meet participation requirements before applications open — details are announced each cycle.',
  },
  {
    num: '02',
    title: 'Meet the Community',
    desc: 'Connect with potential Bigs or Littles at VSA events, Welcome Week activities, and ACE-hosted socials and mixers throughout the quarter.',
  },
  {
    num: '03',
    title: 'Apply When Ready',
    desc: 'When applications open, Littles share their intro materials and Bigs submit a profile. Application timelines and materials are announced each cycle.',
  },
  {
    num: '04',
    title: 'ACE Reveal & Fam Life',
    desc: "Your Big is revealed! You're officially part of a fam — with connections to a multi-generation lineage and seasonal programming throughout the year.",
  },
];

const perks = [
  {
    icon: '🤝',
    title: 'Mentorship & Guidance',
    desc: 'Your Big has walked the path you are on. Get honest advice, insider knowledge, and a trusted support system.',
  },
  {
    icon: '💛',
    title: 'Friendship & Belonging',
    desc: 'ACE is designed to make VSA feel smaller, warmer, and more connected — a family away from home.',
  },
  {
    icon: '🌏',
    title: 'Shared Culture & Connection',
    desc: 'Connect with people who share your interests, backgrounds, values, and career goals.',
  },
  {
    icon: '🏡',
    title: 'A Family Lineage',
    desc: 'Become part of a multi-generation fam with unique traditions, inside jokes, and a shared history that grows every year.',
  },
];

const experienceTypes = [
  {
    emoji: '🤸',
    title: 'Welcome Mixers',
    desc: 'Low-pressure social events at the start of each ACE cycle designed to help potential Bigs and Littles meet, mingle, and make connections in a fun setting.',
  },
  {
    emoji: '💛',
    title: 'Big Appreciation',
    desc: 'Seasonal programming dedicated to celebrating the Bigs who show up for their Littles — because being a mentor deserves recognition.',
  },
  {
    emoji: '🏅',
    title: 'Fam Competitions',
    desc: 'Fams go head-to-head in friendly challenges and games throughout the year, building team spirit and fam pride along the way.',
  },
  {
    emoji: '🌸',
    title: 'Reveals & Seasonal Events',
    desc: 'Each cycle concludes with an ACE reveal. Programming continues across quarters to keep fams active, bonded, and engaged year-round.',
  },
];

const faqs = [
  {
    q: 'What is ACE?',
    a: 'ACE stands for Anh Chị Em — Vietnamese for "older brother, older sister, younger sibling." It is VSA\'s Big/Little family program, built to help members find mentorship, community, and a family away from home.',
  },
  {
    q: 'What is a Big?',
    a: 'A Big (Anh/Chị) is a supportive VSA member who helps guide and welcome their Little into the community. Think of a Big as an older sibling, mentor, or trusted friend.',
  },
  {
    q: 'What is a Little?',
    a: 'A Little (Em) is someone who receives support and guidance from their Big during their VSA experience. As a Little, you gain a built-in support system and a connection to a fam.',
  },
  {
    q: 'What is a Fam?',
    a: 'A Fam is the family line created through the Big/Little system. When a Big picks up a Little, and that Little later picks up their own Little, the line grows into a multi-generation family tree.',
  },
  {
    q: 'How do I meet potential Bigs or Littles?',
    a: 'Attend VSA events and ACE socials throughout the quarter. Welcome Week and early-quarter mixers are a great time to meet people. Following VSA on Instagram is the best way to stay up to date on upcoming ACE programming.',
  },
  {
    q: 'Do requirements change each cycle?',
    a: 'Yes — eligibility requirements, event attendance expectations, and application materials may vary from cycle to cycle. Always refer to current VSA announcements for the latest details.',
  },
  {
    q: 'How do I know when applications open?',
    a: 'Application dates are announced through VSA\'s Instagram and other official channels at the start of each ACE cycle. Follow @vsaatucsd to stay informed.',
  },
  {
    q: 'Who should I contact for current ACE questions?',
    a: 'Reach out to VSA through Instagram (@vsaatucsd) or speak with a board member. The current ACE Chair is identified through VSA\'s official announcements each year.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export function Ace() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageTitle title="ACE Program" />
      <div className="min-h-screen bg-slate-950">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/70 via-orange-950/40 to-slate-950" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/8 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-600/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <Link
                to="/get-involved"
                className="inline-flex items-center gap-1.5 text-amber-400/60 hover:text-amber-400 text-sm mb-8 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Get Involved
              </Link>

              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="text-5xl">🫂</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-amber-400 font-semibold border border-amber-500/25 rounded-full px-3 py-1.5 bg-amber-500/8">
                  Big / Little Family Program
                </span>
                {ACE_CONFIG.applicationsOpen && (
                  <span className="text-[10px] tracking-[0.25em] uppercase text-emerald-400 font-semibold border border-emerald-500/25 rounded-full px-3 py-1.5 bg-emerald-500/8">
                    Applications Open{ACE_CONFIG.cycleLabel ? ` · ${ACE_CONFIG.cycleLabel}` : ''}
                  </span>
                )}
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(3rem, 9vw, 5.5rem)' }}>
                Anh Chị Em
              </h1>
              <p className="text-amber-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                ACE · UCSD VSA
              </p>
              <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                VSA's Big/Little family system designed to build community, connection, and belonging. By pairing people based on shared interests, backgrounds, values, and goals, ACE creates opportunities for mentorship, support, and lasting friendships.
              </p>
            </motion.div>
          </div>
        </div>

        {/* ── What is ACE ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <h2 className="font-heading font-bold text-3xl text-white mb-4">What is ACE?</h2>
            <p className="text-slate-400 leading-relaxed max-w-2xl mb-4">
              ACE stands for <span className="text-amber-300 font-medium">Anh Chị Em</span> — Vietnamese for "older brother, older sister, younger sibling." It is VSA's Big/Little family program built to help members find mentorship, community, and a family away from home.
            </p>
            <p className="text-slate-400 leading-relaxed max-w-2xl">
              Whether you are new to VSA or returning, ACE helps you find your place and your people. Members are paired based on shared interests, backgrounds, values, and career goals — and those connections grow into multi-generation family lines that last long after graduation.
            </p>
          </div>
        </RevealOnScrollWrapper>

        {/* ── Why Join ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">Why Join ACE?</h2>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  ACE is meant to make VSA feel smaller, warmer, and more connected.
                </p>
              </div>
            </RevealOnScrollWrapper>
            <div className="grid sm:grid-cols-2 gap-4">
              {perks.map((perk) => (
                <RevealOnScrollWrapper key={perk.title}>
                  <div className="flex gap-4 p-5 rounded-xl border border-slate-800 hover:border-amber-500/20 bg-slate-900/30 transition-colors">
                    <span className="text-3xl flex-shrink-0 mt-0.5">{perk.icon}</span>
                    <div>
                      <h3 className="font-heading font-semibold text-white mb-1.5 text-sm">{perk.title}</h3>
                      <p className="text-slate-500 text-xs leading-relaxed">{perk.desc}</p>
                    </div>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── Roles ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">Big, Little & Fam</h2>
              <p className="text-slate-500 text-sm">The three building blocks of the ACE family system.</p>
            </div>
          </RevealOnScrollWrapper>
          <div className="grid sm:grid-cols-3 gap-5">
            {roles.map((r) => (
              <RevealOnScrollWrapper key={r.role}>
                <div className="p-6 rounded-xl border border-slate-800 hover:border-amber-500/25 bg-slate-900/40 transition-colors h-full">
                  <div className="text-4xl mb-3">{r.emoji}</div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <h3 className="font-heading font-bold text-white text-lg">{r.role}</h3>
                    <span className="text-slate-600 text-xs italic">{r.viet}</span>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">{r.desc}</p>
                </div>
              </RevealOnScrollWrapper>
            ))}
          </div>
        </div>

        {/* ── How It Works ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">How ACE Works</h2>
                <p className="text-slate-500 text-sm">From events to reveal — your path into a VSA fam.</p>
              </div>
            </RevealOnScrollWrapper>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {steps.map((step) => (
                <RevealOnScrollWrapper key={step.num}>
                  <motion.div
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="relative p-5 rounded-xl border border-slate-800 hover:border-amber-500/25 bg-slate-900/40 transition-colors"
                  >
                    <div className="font-heading font-bold text-amber-500/25 mb-3 leading-none text-5xl">
                      {step.num}
                    </div>
                    <h3 className="font-heading font-semibold text-white mb-2 text-sm">{step.title}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
                  </motion.div>
                </RevealOnScrollWrapper>
              ))}
            </div>
            <RevealOnScrollWrapper>
              <p className="text-slate-600 text-xs text-center mt-8">
                Eligibility requirements, event expectations, and application timelines are announced each cycle.
                Follow <span className="text-slate-500">@vsaatucsd</span> for current ACE details.
              </p>
            </RevealOnScrollWrapper>
          </div>
        </div>

        {/* ── Experience / Events ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">The ACE Experience</h2>
              <p className="text-slate-500 text-sm">ACE programming spans the whole year — there is always something to look forward to.</p>
            </div>
          </RevealOnScrollWrapper>
          <div className="grid sm:grid-cols-2 gap-5">
            {experienceTypes.map((ev) => (
              <RevealOnScrollWrapper key={ev.title}>
                <div className="p-6 rounded-xl border border-slate-800 hover:border-amber-500/20 bg-slate-900/30 transition-colors h-full">
                  <div className="text-3xl mb-3">{ev.emoji}</div>
                  <h3 className="font-heading font-semibold text-white mb-2 text-sm">{ev.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{ev.desc}</p>
                </div>
              </RevealOnScrollWrapper>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">FAQ</h2>
                <p className="text-slate-500 text-sm">Common questions about how ACE works.</p>
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
                        className="text-amber-400/60 flex-shrink-0 ml-4 text-lg leading-none"
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
            <div className="rounded-2xl bg-gradient-to-br from-amber-900/25 to-orange-900/15 border border-amber-500/20 p-8 sm:p-10 text-center">
              <p className="text-4xl mb-4">🌟</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Ready to Find Your Family?</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-7">
                {ACE_CONFIG.contactNote
                  ? ACE_CONFIG.contactNote
                  : 'Follow our Instagram for the latest ACE announcements, application info, and updates each cycle.'}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {ACE_CONFIG.applicationsOpen && ACE_CONFIG.applicationLink ? (
                  <a
                    href={ACE_CONFIG.applicationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors text-sm"
                  >
                    Apply Now{ACE_CONFIG.cycleLabel ? ` · ${ACE_CONFIG.cycleLabel}` : ''}
                  </a>
                ) : null}
                <a
                  href="https://www.instagram.com/vsaatucsd/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors text-sm"
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
