import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

// ─────────────────────────────────────────────────────────────────────────────
// HOUSE PROGRAM CONFIG — Update this section each year.
// All other page copy is evergreen and requires no annual editing.
// ─────────────────────────────────────────────────────────────────────────────

/** Set to true to show the "Applications Open" badge and Apply button. */
const APPLICATIONS_OPEN = false;
const APPLICATION_LINK = '';
/** Optional label shown in the badge, e.g. "Fall 2026 Cycle" */
const CYCLE_LABEL = '';
/** Optional one-line announcement in the CTA. Leave empty for default copy. */
const ANNOUNCEMENT = '';

/**
 * The four houses for the current year.
 * Update name, meaning (theme), color, emoji, description, and trait each cycle.
 * Colors should be valid CSS hex values.
 * bg/border/glow use Tailwind utility strings — update to match the chosen color.
 */
const HOUSES: House[] = [
  {
    name: 'House Boo',
    meaning: 'Ghost',
    color: '#e2e8f0',
    bg: 'from-slate-800/60 to-transparent',
    border: 'border-slate-500/25',
    glow: '#e2e8f018',
    emoji: '👻',
    trait: 'Sneaky & Spooky',
    desc: 'The house that lurks in the shadows — always watching, always ready. Strength lies in the element of surprise.',
  },
  {
    name: 'House Bowser',
    meaning: 'Koopa King',
    color: '#f97316',
    bg: 'from-orange-950/60 to-transparent',
    border: 'border-orange-500/25',
    glow: '#f9731618',
    emoji: '🐢',
    trait: 'Fierce & Mighty',
    desc: 'Bold, powerful, and unapologetically competitive. House Bowser comes to win every single time.',
  },
  {
    name: 'House Toad',
    meaning: 'Mushroom Retainer',
    color: '#ef4444',
    bg: 'from-red-950/60 to-transparent',
    border: 'border-red-500/25',
    glow: '#ef444418',
    emoji: '🍄',
    trait: 'Loyal & Cheerful',
    desc: 'Warm, welcoming, and endlessly enthusiastic. House Toad is the beating heart of every event.',
  },
  {
    name: 'House Donkey Kong',
    meaning: 'Jungle King',
    color: '#eab308',
    bg: 'from-yellow-950/60 to-transparent',
    border: 'border-yellow-500/25',
    glow: '#eab30818',
    emoji: '🦍',
    trait: 'Strong & Wild',
    desc: 'Raw energy, unstoppable momentum, and house pride that shakes the whole jungle.',
  },
];

/**
 * House Parents for the current year.
 * Update names, house, bio, and optionally photo each cycle.
 * photo: provide a URL string or leave empty to show an emoji avatar.
 */
const HOUSE_PARENTS: HouseParent[] = [
  // Example — replace with actual House Parents each year:
  // { name: 'First Last', house: 'House Boo', emoji: '👻', bio: 'Short bio here.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

interface House {
  name: string;
  meaning: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  emoji: string;
  trait: string;
  desc: string;
}

interface HouseParent {
  name: string;
  house: string;
  emoji: string;
  bio: string;
  photo?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC EVERGREEN CONTENT
// Update only if the program's structure or values actually change year to year.
// ─────────────────────────────────────────────────────────────────────────────

const steps = [
  {
    icon: '📝',
    title: 'Join the Program',
    desc: 'Sign up when applications or sign-ups open each year. Check VSA\'s Instagram for the latest announcements.',
  },
  {
    icon: '🏠',
    title: 'Get Sorted',
    desc: 'You are placed into one of four houses. A house reveal kicks off the year and introduces you to your new community.',
  },
  {
    icon: '🤝',
    title: 'Meet Your House',
    desc: 'Connect with your House Parents and fellow house members through socials, bonding events, and activities throughout the year.',
  },
  {
    icon: '🏆',
    title: 'Earn Points & Compete',
    desc: 'Show up, participate, and earn points for your house. The house with the most points at year\'s end wins a special reward.',
  },
];

const eventTypes = [
  { emoji: '🎉', label: 'House Reveal' },
  { emoji: '👋', label: 'Meet & Greet' },
  { emoji: '🎮', label: 'Game Nights' },
  { emoji: '📚', label: 'Study Jams' },
  { emoji: '🏖️', label: 'Beach Outings' },
  { emoji: '🎤', label: 'Karaoke' },
  { emoji: '🍜', label: 'House Dinners' },
  { emoji: '🎨', label: 'DIY Activities' },
  { emoji: '🎬', label: 'Movie Nights' },
  { emoji: '🤝', label: 'Inter-House Collabs' },
  { emoji: '🏅', label: 'Competitions' },
  { emoji: '✨', label: 'End-of-Year Celebration' },
];

const faqs = [
  {
    q: 'What is the House Program?',
    a: 'The House Program is a year-long community experience within VSA. Members are placed into one of four houses and participate in socials, bonding activities, and VSA events to earn points and build friendships throughout the year.',
  },
  {
    q: 'Do I need to already know people in VSA to join?',
    a: 'Not at all. The program is specifically designed to help members meet new people and feel more connected — especially if you are newer to VSA or looking for a tighter-knit community within the organization.',
  },
  {
    q: 'What kinds of events are part of the program?',
    a: 'Events vary by house and cycle but may include house reveals, meet-and-greets, bonding socials, study jams, beach outings, karaoke, DIY activities, movie nights, inter-house collaborations, and competitions.',
  },
  {
    q: 'What do House Parents do?',
    a: 'House Parents lead their house throughout the year. They plan socials and bonding activities, communicate with members, encourage participation, and help create a welcoming environment for everyone in the house.',
  },
  {
    q: 'Is there competition between houses?',
    a: 'Yes. Houses earn points through participation in events and activities across the year. At the end of the year, the house with the most points receives a special reward.',
  },
  {
    q: 'When do sign-ups or applications open?',
    a: 'Sign-up timelines are announced at the start of each year through VSA\'s official channels. Follow @vsaatucsd on Instagram to stay up to date.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export function House() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageTitle title="House Program" />
      <div className="min-h-screen bg-slate-950">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/60 via-teal-950/30 to-slate-950" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/8 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-teal-600/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <Link
                to="/get-involved"
                className="inline-flex items-center gap-1.5 text-emerald-400/60 hover:text-emerald-400 text-sm mb-8 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Get Involved
              </Link>

              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="text-5xl">🏠</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-emerald-400 font-semibold border border-emerald-500/25 rounded-full px-3 py-1.5 bg-emerald-500/8">
                  Community Program
                </span>
                {APPLICATIONS_OPEN && (
                  <span className="text-[10px] tracking-[0.25em] uppercase text-amber-400 font-semibold border border-amber-500/25 rounded-full px-3 py-1.5 bg-amber-500/8">
                    Sign-Ups Open{CYCLE_LABEL ? ` · ${CYCLE_LABEL}` : ''}
                  </span>
                )}
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(3rem, 9vw, 5.5rem)' }}>
                House Program
              </h1>
              <p className="text-emerald-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                UCSD VSA · Community & Competition
              </p>
              <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                Find your people within VSA. The House Program places you into a tight-knit community of members who bond through events, earn points together, and compete for a year-end reward.
              </p>
            </motion.div>
          </div>
        </div>

        {/* ── About ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <h2 className="font-heading font-bold text-3xl text-white mb-4">About the Program</h2>
            <p className="text-slate-400 leading-relaxed max-w-2xl mb-4">
              The VSA House Program is a year-long community experience that places members into one of four houses, each led by two House Parents. Through socials, bonding activities, and participation in VSA events, members build friendships, earn house points, and compete for a special end-of-year reward.
            </p>
            <p className="text-slate-400 leading-relaxed max-w-2xl">
              The program is designed to make a large organization feel smaller, more welcoming, and easier to get involved in. Whether you are new to VSA or a returning member looking for a closer community, the House Program is a great way to stay connected throughout the year.
            </p>
          </div>
        </RevealOnScrollWrapper>

        {/* ── How It Works ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">How It Works</h2>
                <p className="text-slate-500 text-sm">A year of community, competition, and memories — four steps to get started.</p>
              </div>
            </RevealOnScrollWrapper>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {steps.map((step, i) => (
                <RevealOnScrollWrapper key={step.title}>
                  <div className="relative p-5 rounded-xl border border-slate-800 hover:border-emerald-500/20 bg-slate-900/40 transition-colors text-center">
                    <div className="text-3xl mb-3">{step.icon}</div>
                    <div className="text-emerald-500/30 font-heading font-bold text-2xl mb-2 leading-none">0{i + 1}</div>
                    <h3 className="font-heading font-semibold text-white mb-2 text-sm">{step.title}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── The Four Houses ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">The Four Houses</h2>
              <p className="text-slate-500 text-sm">
                Each year the houses may carry a new theme. Which one will you call home?
              </p>
            </div>
          </RevealOnScrollWrapper>
          <div className="grid sm:grid-cols-2 gap-4">
            {HOUSES.map((house) => (
              <RevealOnScrollWrapper key={house.name}>
                <motion.div
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={`relative p-6 rounded-xl border ${house.border} transition-all duration-200`}
                  style={{ background: `radial-gradient(ellipse at top left, ${house.glow}, transparent 60%)` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-4xl">{house.emoji}</span>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ color: house.color, backgroundColor: `${house.color}15`, border: `1px solid ${house.color}30` }}
                    >
                      {house.trait}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-white text-lg mb-1">{house.name}</h3>
                  <p className="text-slate-600 text-xs tracking-widest uppercase mb-3">{house.meaning}</p>
                  <p className="text-slate-500 text-sm leading-relaxed">{house.desc}</p>
                </motion.div>
              </RevealOnScrollWrapper>
            ))}
          </div>
        </div>

        {/* ── House Parents ── */}
        {HOUSE_PARENTS.length > 0 && (
          <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <RevealOnScrollWrapper>
                <div className="text-center mb-12">
                  <h2 className="font-heading font-bold text-3xl text-white mb-2">Meet the House Parents</h2>
                  <p className="text-slate-500 text-sm">The people who lead each house throughout the year.</p>
                </div>
              </RevealOnScrollWrapper>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {HOUSE_PARENTS.map((hp) => (
                  <RevealOnScrollWrapper key={hp.name}>
                    <div className="p-5 rounded-xl border border-slate-800 hover:border-emerald-500/20 bg-slate-900/30 transition-colors text-center">
                      {hp.photo ? (
                        <img src={hp.photo} alt={hp.name} className="w-16 h-16 rounded-full object-cover mx-auto mb-3" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-3xl mx-auto mb-3">
                          {hp.emoji}
                        </div>
                      )}
                      <h3 className="font-heading font-semibold text-white text-sm mb-0.5">{hp.name}</h3>
                      <p className="text-emerald-400/60 text-xs mb-2">{hp.house}</p>
                      <p className="text-slate-600 text-xs leading-relaxed">{hp.bio}</p>
                    </div>
                  </RevealOnScrollWrapper>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── What to Expect ── */}
        <div className={HOUSE_PARENTS.length > 0 ? 'max-w-4xl mx-auto px-4 sm:px-6 py-16' : 'border-y border-slate-800/50 py-16 bg-slate-900/20'}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">What to Expect</h2>
                <p className="text-slate-500 text-sm">Events and activities may vary by cycle — here's a taste of what House life looks like.</p>
              </div>
            </RevealOnScrollWrapper>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {eventTypes.map((ev) => (
                <RevealOnScrollWrapper key={ev.label}>
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-slate-800 hover:border-emerald-500/15 bg-slate-900/30 transition-colors">
                    <span className="text-xl flex-shrink-0">{ev.emoji}</span>
                    <span className="text-slate-400 text-xs font-medium">{ev.label}</span>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── Points & Competition ── */}
        <div className={HOUSE_PARENTS.length > 0 ? 'border-y border-slate-800/50 py-16 bg-slate-900/20' : 'max-w-4xl mx-auto px-4 sm:px-6 py-16'}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-2 gap-6">
              <RevealOnScrollWrapper>
                <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30 h-full">
                  <div className="text-3xl mb-4">⭐</div>
                  <h3 className="font-heading font-bold text-xl text-white mb-3">House Points</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">
                    Points are earned through participation in house events and VSA activities. Every member's involvement contributes to the overall house score throughout the year.
                  </p>
                  <div className="space-y-2">
                    {['Attend house socials and events', 'Participate in house activities', 'Engage in inter-house collaborations', 'Show up for your house throughout the year'].map(item => (
                      <div key={item} className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-1 h-1 rounded-full bg-emerald-500/60 flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </RevealOnScrollWrapper>
              <RevealOnScrollWrapper>
                <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30 h-full">
                  <div className="text-3xl mb-4">🏆</div>
                  <h3 className="font-heading font-bold text-xl text-white mb-3">Year-End Competition</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">
                    Houses compete across the full year, building points through consistent participation. At the end of the year, the house with the most points earns a special reward — and bragging rights.
                  </p>
                  <div className="space-y-2">
                    {['Friendly competition throughout the year', 'Points reset each program cycle', 'Winning house receives an end-of-year reward', 'Houses may also collaborate across the year'].map(item => (
                      <div key={item} className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-1 h-1 rounded-full bg-emerald-500/60 flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </RevealOnScrollWrapper>
            </div>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">FAQ</h2>
              <p className="text-slate-500 text-sm">Common questions about the House Program.</p>
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
                      className="text-emerald-400/60 flex-shrink-0 ml-4 text-lg leading-none"
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

        {/* ── CTA ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-900/25 to-teal-900/15 border border-emerald-500/20 p-8 sm:p-10 text-center">
              <p className="text-4xl mb-4">🏠</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Find Your House</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-7">
                {ANNOUNCEMENT
                  ? ANNOUNCEMENT
                  : 'Sign-ups open at the start of each year. Follow @vsaatucsd on Instagram for the latest House Program announcements.'}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {APPLICATIONS_OPEN && APPLICATION_LINK ? (
                  <a
                    href={APPLICATION_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors text-sm"
                  >
                    Sign Up Now{CYCLE_LABEL ? ` · ${CYCLE_LABEL}` : ''}
                  </a>
                ) : null}
                <a
                  href="https://www.instagram.com/vsaatucsd/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors text-sm"
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
