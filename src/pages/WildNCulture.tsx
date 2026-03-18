import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

const acts = [
  { icon: '🕺', title: 'Traditional Dances', desc: 'Classical Vietnamese dance forms performed with authentic costumes and storytelling.' },
  { icon: '🎤', title: 'Modern Performances', desc: 'K-pop covers, rap, spoken word, and contemporary acts that reflect who we are today.' },
  { icon: '🎭', title: 'Cultural Skits', desc: 'Short comedic and dramatic sketches that spotlight Vietnamese-American life and identity.' },
  { icon: '🎪', title: 'Variety Acts', desc: 'Unexpected performances that keep the energy alive and the crowd on their feet all night.' },
];

const ways = [
  {
    icon: '🌟',
    title: 'Perform',
    desc: "Audition for a dance, music, or theatre act. All skill levels welcome — what matters is your heart.",
    cta: 'Audition Info',
  },
  {
    icon: '🎬',
    title: 'Help with Production',
    desc: 'Join the production crew: lighting, sound, video, set design, costuming, and more.',
    cta: 'Crew Sign-Up',
  },
  {
    icon: '📣',
    title: 'Promote & Support',
    desc: 'Help spread the word, sell tickets, and make sure your whole friend group shows up.',
    cta: 'Get Involved',
  },
];

export function WildNCulture() {
  return (
    <>
      <PageTitle title="Wild n' Culture" />
      <div className="min-h-screen bg-slate-950">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950/70 via-fuchsia-950/40 to-slate-950" />
          <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-fuchsia-600/8 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <Link
                to="/events"
                className="inline-flex items-center gap-1.5 text-violet-400/60 hover:text-violet-400 text-sm mb-8 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Events
              </Link>

              <div className="flex items-center gap-3 mb-5">
                <span className="text-5xl">🎪</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-violet-400 font-semibold border border-violet-500/25 rounded-full px-3 py-1.5 bg-violet-500/8">
                  Cultural Showcase
                </span>
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(3rem, 9vw, 5.5rem)' }}>
                Wild n'<br />
                <span className="text-gradient">Culture</span>
              </h1>
              <p className="text-violet-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                Annual Cultural Showcase
              </p>
              <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                VSA's annual showcase that fuses traditional Vietnamese performances with modern entertainment. One night. Every culture. Limitless energy.
              </p>

              <div className="flex flex-wrap gap-3 mt-8">
                {[
                  { val: 'Annual', label: 'Frequency' },
                  { val: 'All Night', label: 'Duration' },
                  { val: 'Open Stage', label: 'Format' },
                  { val: 'Everyone', label: 'Audience' },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-500/15 bg-violet-500/5">
                    <span className="text-violet-400 text-xs font-semibold">{f.val}</span>
                    <span className="text-slate-600 text-xs">{f.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── About ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="space-y-4">
                <h2 className="font-heading font-bold text-3xl text-white">What is Wild n' Culture?</h2>
                <p className="text-slate-400 leading-relaxed">
                  Wild n' Culture is VSA's annual cultural showcase that combines traditional Vietnamese performances with modern entertainment. It's a night of celebration, learning, and fun for the entire community.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Unlike VCN's theatrical narrative, Wild n' Culture is a high-energy variety show — think K-pop covers next to classical dances, comedy skits alongside spoken word poetry. It's culture, but make it electric.
                </p>
              </div>

              <div className="relative rounded-2xl border border-violet-500/20 bg-violet-900/8 p-6 overflow-hidden">
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, #8b5cf6 0%, transparent 70%)' }} />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { num: '10+', label: 'Acts per Show' },
                    { num: '100+', label: 'Performers' },
                    { num: '∞', label: 'Good Vibes' },
                    { num: '1', label: 'Unforgettable Night' },
                  ].map(stat => (
                    <div key={stat.label} className="text-center py-4 px-3 rounded-xl bg-white/3 border border-white/5">
                      <div className="font-heading font-bold text-2xl text-violet-300 mb-1">{stat.num}</div>
                      <div className="text-slate-500 text-xs">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </RevealOnScrollWrapper>

        {/* ── What's On Stage ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">What's On Stage</h2>
                <p className="text-slate-500 text-sm">From the ancient to the contemporary — it all belongs here.</p>
              </div>
            </RevealOnScrollWrapper>

            <div className="grid sm:grid-cols-2 gap-4">
              {acts.map((act) => (
                <RevealOnScrollWrapper key={act.title}>
                  <motion.div
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    className="flex gap-4 p-5 rounded-xl border border-slate-800 hover:border-violet-500/20 bg-slate-900/40 transition-colors"
                  >
                    <span className="text-3xl flex-shrink-0 mt-0.5">{act.icon}</span>
                    <div>
                      <h3 className="font-heading font-semibold text-white mb-1.5 text-sm">{act.title}</h3>
                      <p className="text-slate-500 text-xs leading-relaxed">{act.desc}</p>
                    </div>
                  </motion.div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── How to Get Involved ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">How to Get Involved</h2>
              <p className="text-slate-500 text-sm">Whether you're on stage or in the crowd, there's a role for you.</p>
            </div>
          </RevealOnScrollWrapper>

          <div className="grid sm:grid-cols-3 gap-4">
            {ways.map((way) => (
              <RevealOnScrollWrapper key={way.title}>
                <div className="p-6 rounded-xl border border-slate-800 hover:border-violet-500/20 bg-slate-900/30 transition-colors flex flex-col">
                  <div className="text-3xl mb-3">{way.icon}</div>
                  <h3 className="font-heading font-semibold text-white mb-2 text-sm">{way.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed flex-grow">{way.desc}</p>
                  <div className="mt-4">
                    <span className="text-violet-400 text-xs font-semibold">→ {way.cta}</span>
                  </div>
                </div>
              </RevealOnScrollWrapper>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
            <div className="rounded-2xl bg-gradient-to-br from-violet-900/25 to-fuchsia-900/15 border border-violet-500/20 p-8 sm:p-10 text-center">
              <p className="text-4xl mb-4">🎪</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Ready to Go Wild?</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-7">
                Follow our Instagram for show dates, audition info, and all the Wild n' Culture hype.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="https://www.instagram.com/ucsd.vsa/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-bold rounded-xl transition-colors text-sm"
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
