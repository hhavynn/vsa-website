import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

const houses = [
  {
    name: 'House Rồng',
    meaning: 'Dragon',
    color: '#ef4444',
    bg: 'from-red-950/60 to-transparent',
    border: 'border-red-500/25',
    glow: '#ef444418',
    emoji: '🐉',
    trait: 'Bold & Fearless',
  },
  {
    name: 'House Phượng',
    meaning: 'Phoenix',
    color: '#f59e0b',
    bg: 'from-amber-950/60 to-transparent',
    border: 'border-amber-500/25',
    glow: '#f59e0b18',
    emoji: '🔥',
    trait: 'Rising & Resilient',
  },
  {
    name: 'House Sen',
    meaning: 'Lotus',
    color: '#ec4899',
    bg: 'from-pink-950/60 to-transparent',
    border: 'border-pink-500/25',
    glow: '#ec489918',
    emoji: '🌸',
    trait: 'Pure & Graceful',
  },
  {
    name: 'House Ngọc',
    meaning: 'Jade',
    color: '#10b981',
    bg: 'from-emerald-950/60 to-transparent',
    border: 'border-emerald-500/25',
    glow: '#10b98118',
    emoji: '💚',
    trait: 'Steady & Strong',
  },
];

const howItWorks = [
  {
    icon: '🎯',
    title: 'Get Sorted',
    desc: 'At the start of each semester, new members are sorted into one of four houses through a matching process.',
  },
  {
    icon: '📅',
    title: 'Attend Events',
    desc: 'Houses host close-knit socials, game nights, and community activities throughout the semester.',
  },
  {
    icon: '⭐',
    title: 'Earn Points',
    desc: 'Show up, participate, and compete. Every event and activity earns points for your house.',
  },
  {
    icon: '🏆',
    title: 'Win the Cup',
    desc: 'The house with the most points at the end of the semester wins the coveted House Cup.',
  },
];

export function House() {
  return (
    <>
      <PageTitle title="House System" />
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

              <div className="flex items-center gap-3 mb-5">
                <span className="text-5xl">🏆</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-emerald-400 font-semibold border border-emerald-500/25 rounded-full px-3 py-1.5 bg-emerald-500/8">
                  Competition Program
                </span>
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(3rem, 9vw, 5.5rem)' }}>
                House System
              </h1>
              <p className="text-emerald-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                Compete · Connect · Belong
              </p>
              <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                Find your tribe. Get sorted into one of four houses and compete in a semester-long battle for glory, friendship, and the House Cup.
              </p>
            </motion.div>
          </div>
        </div>

        {/* ── The Four Houses ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">The Four Houses</h2>
              <p className="text-slate-500 text-sm">Each house draws from Vietnamese symbols of strength, beauty, and resilience.</p>
            </div>
          </RevealOnScrollWrapper>

          <div className="grid sm:grid-cols-2 gap-4">
            {houses.map((house) => (
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
                  <p className="text-slate-500 text-xs tracking-widest uppercase">{house.meaning}</p>
                </motion.div>
              </RevealOnScrollWrapper>
            ))}
          </div>
        </div>

        {/* ── How It Works ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">How It Works</h2>
                <p className="text-slate-500 text-sm">A semester of competition, community, and memories.</p>
              </div>
            </RevealOnScrollWrapper>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {howItWorks.map((item, i) => (
                <RevealOnScrollWrapper key={item.title}>
                  <div className="relative p-5 rounded-xl border border-slate-800 hover:border-emerald-500/20 bg-slate-900/40 transition-colors text-center">
                    <div className="text-3xl mb-3">{item.icon}</div>
                    <div className="text-emerald-500/30 font-heading font-bold text-2xl mb-2 leading-none">0{i + 1}</div>
                    <h3 className="font-heading font-semibold text-white mb-2 text-sm">{item.title}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── Points & Events ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid md:grid-cols-2 gap-6">
            <RevealOnScrollWrapper>
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30">
                <div className="text-3xl mb-4">⭐</div>
                <h3 className="font-heading font-bold text-xl text-white mb-3">House Points</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Points are awarded for participation in events, winning competitions, and contributing to the VSA community. Rack up points all semester — every action counts.
                </p>
                <div className="space-y-2">
                  {['Attend house events', 'Win inter-house challenges', 'Volunteer for VSA', 'Bring new members'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="w-1 h-1 rounded-full bg-emerald-500/60" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScrollWrapper>

            <RevealOnScrollWrapper>
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30">
                <div className="text-3xl mb-4">🎊</div>
                <h3 className="font-heading font-bold text-xl text-white mb-3">House Events</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Each house hosts special events throughout the semester — from intimate hangouts to campus-wide showdowns. These are the moments you'll talk about for years.
                </p>
                <div className="space-y-2">
                  {['House socials & game nights', 'Community service days', 'Inter-house competitions', 'End-of-semester celebration'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="w-1 h-1 rounded-full bg-emerald-500/60" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScrollWrapper>
          </div>
        </div>

        {/* ── CTA ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-900/25 to-teal-900/15 border border-emerald-500/20 p-8 sm:p-10 text-center">
              <p className="text-4xl mb-4">🏆</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Which House Will You Join?</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-7">
                House sorting happens at the beginning of each semester. Follow our Instagram for sign-up announcements.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="https://www.instagram.com/ucsd.vsa/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors text-sm"
                >
                  Follow @ucsd.vsa
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
