import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

const steps = [
  {
    num: '01',
    title: 'Applications Open',
    desc: 'Fill out the litto application — share your personality, interests, and what you hope to find in your big.',
  },
  {
    num: '02',
    title: 'Meet & Match',
    desc: 'Attend curated mixer events to meet potential bigs. Find the person who just feels right.',
  },
  {
    num: '03',
    title: 'Big Reveal',
    desc: "The moment you've been waiting for — your big is unveiled in a ceremony you'll never forget.",
  },
  {
    num: '04',
    title: 'Build Your Family',
    desc: "Get absorbed into your big's lineage and meet your extended VSA family: pseudos, siblings, and grands.",
  },
];

const perks = [
  {
    icon: '🌱',
    title: 'Mentorship',
    desc: "Your big has walked the path you're on. Get honest advice, insider knowledge, and a trusted friend.",
  },
  {
    icon: '🌳',
    title: 'Family Lineage',
    desc: 'Become part of a lineage spanning years — unique traditions, inside jokes, and a shared history.',
  },
  {
    icon: '🎉',
    title: 'Exclusive Hangouts',
    desc: 'Families host their own game nights, food runs, and adventures throughout the year.',
  },
  {
    icon: '💌',
    title: 'Gifts & Surprises',
    desc: 'Bigs love spoiling their littos with thoughtful gifts and planned surprises.',
  },
];

const familyRoles = [
  { role: 'Grand-big', viet: 'Ông/Bà', isYou: false },
  { role: 'Big', viet: 'Anh/Chị', isYou: false },
  { role: 'YOU (Litto)', viet: 'Em', isYou: true },
  { role: 'Future Littos', viet: 'Em nhỏ hơn', isYou: false },
];

export function Ace() {
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

              <div className="flex items-center gap-3 mb-5">
                <span className="text-5xl">🫂</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-amber-400 font-semibold border border-amber-500/25 rounded-full px-3 py-1.5 bg-amber-500/8">
                  Mentorship Program
                </span>
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(3rem, 9vw, 5.5rem)' }}>
                Anh Chị Em
              </h1>
              <p className="text-amber-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                ACE · Big-Little Program
              </p>
              <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                Find your family away from home. ACE is where strangers become siblings and bonds become lifelong.
              </p>
            </motion.div>
          </div>
        </div>

        {/* ── What is ACE ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <div className="grid md:grid-cols-5 gap-10 items-center">
              <div className="md:col-span-3 space-y-4">
                <h2 className="font-heading font-bold text-3xl text-white">What is ACE?</h2>
                <p className="text-slate-400 leading-relaxed">
                  ACE stands for <span className="text-amber-300 font-medium">Anh Chị Em</span> — Vietnamese for "older brother, older sister, younger sibling." Each year, new members (littos) match with upperclassmen (bigs) to form a lasting mentorship relationship.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Pairings grow into deep friendships within unique family lineages — complete with bigs, pseudos, siblings, and grands. Your ACE family becomes your support network long after graduation.
                </p>
              </div>

              <div className="md:col-span-2">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-900/8 p-6">
                  <div className="text-center mb-4">
                    <span className="text-3xl">🌳</span>
                    <h3 className="font-heading font-semibold text-white text-sm mt-2 mb-4 tracking-widest uppercase">The Family Tree</h3>
                  </div>
                  <div className="space-y-1.5">
                    {familyRoles.map((item) => (
                      <div
                        key={item.role}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
                          item.isYou
                            ? 'bg-amber-500/20 border border-amber-500/30'
                            : 'border border-transparent'
                        }`}
                      >
                        <span className={item.isYou ? 'text-amber-300 font-semibold' : 'text-slate-400'}>
                          {item.isYou && '⭐ '}{item.role}
                        </span>
                        <span className="text-slate-600 text-xs italic">{item.viet}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </RevealOnScrollWrapper>

        {/* ── How It Works ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">How ACE Works</h2>
                <p className="text-slate-500 text-sm">From application to family — four steps to your VSA family.</p>
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
          </div>
        </div>

        {/* ── Perks ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">Why Join ACE?</h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                Being part of ACE means joining something bigger than yourself.
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

        {/* ── CTA ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
            <div className="rounded-2xl bg-gradient-to-br from-amber-900/25 to-orange-900/15 border border-amber-500/20 p-8 sm:p-10 text-center">
              <p className="text-4xl mb-4">🌟</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Ready to Find Your Big?</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-7">
                Applications open at the start of each school year. Follow our Instagram to stay updated on when ACE kicks off.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="https://www.instagram.com/ucsd.vsa/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors text-sm"
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
