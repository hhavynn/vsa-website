import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

const highlights = [
  {
    icon: '💃',
    title: 'Traditional Dances',
    desc: 'Watch performers bring centuries-old Vietnamese dances to life — from the graceful Múa Quạt to vibrant folk performances.',
  },
  {
    icon: '🎭',
    title: 'Cultural Play',
    desc: 'A student-written and directed performance exploring the intersection of Vietnamese and Vietnamese-American identity.',
  },
  {
    icon: '🎶',
    title: 'Modern Performances',
    desc: 'Contemporary acts woven throughout the night — because culture is not just history, it is also who we are today.',
  },
  {
    icon: '🌸',
    title: 'Cultural Experience',
    desc: 'Immerse yourself in the sights, sounds, and spirit of Vietnamese culture — curated entirely by UCSD students.',
  },
];

const facts = [
  { label: 'Annual Event', value: 'Every Spring' },
  { label: 'Student-Run', value: '100%' },
  { label: 'Admission', value: 'Free' },
  { label: 'Audience', value: 'All Welcome' },
];

export function VCN() {
  return (
    <>
      <PageTitle title="VCN" />
      <div className="min-h-screen bg-slate-950">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/80 via-rose-950/40 to-slate-950" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-rose-800/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-12 right-8 sm:right-16 opacity-8 pointer-events-none select-none text-[8rem] leading-none">⭐</div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <Link
                to="/events"
                className="inline-flex items-center gap-1.5 text-red-400/60 hover:text-red-400 text-sm mb-8 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Events
              </Link>

              <div className="flex items-center gap-3 mb-5">
                <span className="text-5xl">🎭</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-red-400 font-semibold border border-red-500/25 rounded-full px-3 py-1.5 bg-red-500/8">
                  Annual Showcase
                </span>
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)' }}>
                Vietnamese<br />
                <span style={{ color: '#fbbf24' }}>Culture Night</span>
              </h1>
              <p className="text-red-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                VCN · Spring Production
              </p>
              <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                UCSD VSA's biggest event of the year — a night of traditional dances, original theatre, and a celebration of what it means to be Vietnamese-American.
              </p>

              <div className="flex flex-wrap gap-3 mt-8">
                {facts.map(f => (
                  <div key={f.label} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/15 bg-red-500/5">
                    <span className="text-red-400 text-xs font-semibold">{f.value}</span>
                    <span className="text-slate-600 text-xs">{f.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── About VCN ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="space-y-4">
                <h2 className="font-heading font-bold text-3xl text-white">What is VCN?</h2>
                <p className="text-slate-400 leading-relaxed">
                  Vietnamese Culture Night is UCSD VSA's premier annual event — a full production that pays homage to Vietnamese heritage through dance, theatre, and performance.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Everything is student-run: from the play to the choreography, each detail is meticulously crafted to deliver an authentic, moving performance. It's a celebration that honors tradition while embracing the Vietnamese-American experience.
                </p>
              </div>

              <div className="relative rounded-2xl border border-red-500/20 bg-red-900/8 p-8 text-center overflow-hidden">
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, #ef4444 0%, transparent 70%)' }} />
                <div className="text-6xl mb-4">🌟</div>
                <blockquote className="text-slate-300 text-sm leading-relaxed italic">
                  "Join UCSD VSA's biggest event and learn what it really means to be part of such a wonderful community — fun for the whole family, and free to watch."
                </blockquote>
                <div className="mt-4 text-red-400/60 text-xs tracking-widest uppercase">UCSD Vietnamese Student Association</div>
              </div>
            </div>
          </div>
        </RevealOnScrollWrapper>

        {/* ── What's in the Show ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">What's in the Show</h2>
                <p className="text-slate-500 text-sm">A full evening of culture, art, and community.</p>
              </div>
            </RevealOnScrollWrapper>

            <div className="grid sm:grid-cols-2 gap-4">
              {highlights.map((item) => (
                <RevealOnScrollWrapper key={item.title}>
                  <motion.div
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    className="flex gap-4 p-5 rounded-xl border border-slate-800 hover:border-red-500/20 bg-slate-900/40 transition-colors"
                  >
                    <span className="text-3xl flex-shrink-0 mt-0.5">{item.icon}</span>
                    <div>
                      <h3 className="font-heading font-semibold text-white mb-1.5 text-sm">{item.title}</h3>
                      <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── How to Participate ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <h2 className="font-heading font-bold text-3xl text-white mb-8 text-center">Want to Be in VCN?</h2>
          </RevealOnScrollWrapper>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: '🎪', role: 'Performer', desc: 'Audition for the dance or theatre team. No prior experience required — just passion and commitment.' },
              { icon: '🔧', role: 'Production Crew', desc: 'Work behind the scenes on lighting, sound, set design, and stage management.' },
              { icon: '🎟️', role: 'Audience Member', desc: 'The show is free and open to everyone. Come experience Vietnamese culture at its finest.' },
            ].map(item => (
              <RevealOnScrollWrapper key={item.role}>
                <div className="p-5 rounded-xl border border-slate-800 hover:border-red-500/20 bg-slate-900/30 transition-colors text-center">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-heading font-semibold text-white mb-2 text-sm">{item.role}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              </RevealOnScrollWrapper>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
            <div className="rounded-2xl bg-gradient-to-br from-red-900/25 to-rose-900/15 border border-red-500/20 p-8 sm:p-10 text-center">
              <p className="text-4xl mb-4">🎭</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">See You at VCN</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-7">
                Free admission. All are welcome. Follow our Instagram for show dates, audition announcements, and ticket info.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="https://www.instagram.com/ucsd.vsa/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  Follow @ucsd.vsa
                </a>
                <Link
                  to="/events"
                  className="inline-flex items-center gap-2 px-6 py-2.5 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
                >
                  View All Events
                </Link>
              </div>
            </div>
          </div>
        </RevealOnScrollWrapper>

      </div>
    </>
  );
}
