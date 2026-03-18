import { motion, type Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

const programs = [
  {
    id: 'ace',
    tag: 'MENTORSHIP',
    title: 'ANH CHỊ EM',
    subtitle: 'Your Family Away From Home',
    description:
      'Meet your future bigs, build lifelong bonds, and become part of a unique lineage. Bigs, pseudos, siblings, and grands — ACE is chosen family.',
    image: '/images/get-involved/ace.jpg',
    link: '/ace',
    gradientFrom: 'from-amber-950/80',
    gradientVia: 'via-orange-950/50',
    accent: '#f59e0b',
    details: ['Big-Little Matching', 'Family Lineages', 'Year-Long Bonds'],
    emoji: '🫂',
  },
  {
    id: 'house',
    tag: 'COMPETITION',
    title: 'HOUSE PROGRAM',
    subtitle: 'Compete. Connect. Conquer.',
    description:
      'Get sorted into one of four houses and compete for glory. Close-knit events, friendly rivalries, and a semester-long battle for the House Cup.',
    image: '/images/get-involved/house.jpg',
    link: '/house-system',
    gradientFrom: 'from-emerald-950/80',
    gradientVia: 'via-teal-950/50',
    accent: '#10b981',
    details: ['4 Houses', 'Points Competition', 'Exclusive Events'],
    emoji: '🏆',
  },
  {
    id: 'intern',
    tag: 'LEADERSHIP',
    title: 'INTERN PROGRAM',
    subtitle: 'Shape the Future of VSA',
    description:
      'Go behind the scenes. Learn how VSA operates, build real leadership skills, and leave your mark on the organization you love.',
    image: '/images/get-involved/intern.jpg',
    link: '/intern-program',
    gradientFrom: 'from-indigo-950/80',
    gradientVia: 'via-violet-950/50',
    accent: '#818cf8',
    details: ['Board Shadowing', 'Leadership Skills', 'Real Impact'],
    emoji: '🚀',
  },
];

const extraLinks = [
  { label: 'Vietnamese Culture Night', link: '/vcn', emoji: '🎭' },
  { label: "Wild n' Culture", link: '/wild-n-culture', emoji: '🎪' },
  { label: 'Events Calendar', link: '/events', emoji: '📅' },
];

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
};

export function GetInvolved() {
  return (
    <>
      <PageTitle title="Get Involved" />
      <div className="min-h-screen bg-slate-950">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden pt-24 pb-20 px-4 text-center">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-indigo-700/8 rounded-full blur-[80px]" />
            <div className="absolute top-20 right-1/4 w-72 h-72 bg-violet-600/6 rounded-full blur-3xl" />
          </div>

          <motion.div initial="hidden" animate="show" variants={stagger} className="relative z-10 max-w-2xl mx-auto">
            <motion.div variants={fadeUp} className="mb-5">
              <span className="inline-block text-[11px] tracking-[0.3em] uppercase text-indigo-400 font-semibold border border-indigo-500/25 rounded-full px-4 py-1.5 bg-indigo-500/5">
                UCSD Vietnamese Student Association
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-heading font-bold leading-none mb-5"
              style={{ fontSize: 'clamp(3.5rem, 10vw, 6.5rem)' }}
            >
              <span className="text-white block">Get</span>
              <span className="text-gradient block">Involved</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-slate-400 text-lg leading-relaxed max-w-md mx-auto">
              Three unique pathways to find your place, build your community, and shape who you become at UCSD.
            </motion.p>
          </motion.div>
        </div>

        {/* ── Program Cards ── */}
        <div className="max-w-5xl mx-auto px-4 pb-20 space-y-5">
          {programs.map((prog, i) => (
            <motion.div
              key={prog.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.65, delay: i * 0.08, ease: 'easeOut' }}
            >
              <Link to={prog.link} className="group block relative rounded-2xl overflow-hidden">
                {/* Image */}
                <div className="relative h-64 sm:h-72">
                  <img
                    src={prog.image}
                    alt={prog.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${prog.gradientFrom} ${prog.gradientVia} to-transparent`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                  {/* Fallback background */}
                  <div className="absolute inset-0 -z-10 bg-slate-900" />
                </div>

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-7 sm:p-10">
                  <div className="flex items-end justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{prog.emoji}</span>
                        <span
                          className="text-[10px] tracking-[0.25em] uppercase font-bold px-2.5 py-1 rounded-full"
                          style={{
                            color: prog.accent,
                            backgroundColor: `${prog.accent}18`,
                            border: `1px solid ${prog.accent}35`,
                          }}
                        >
                          {prog.tag}
                        </span>
                      </div>

                      <h2 className="font-heading font-bold text-white leading-tight mb-1" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}>
                        {prog.title}
                      </h2>
                      <p className="text-slate-400 text-xs font-medium mb-3 tracking-wide">{prog.subtitle}</p>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4 max-w-lg">{prog.description}</p>

                      <div className="flex flex-wrap gap-2">
                        {prog.details.map(d => (
                          <span
                            key={d}
                            className="text-xs text-slate-400 bg-white/5 border border-white/8 rounded-full px-3 py-1"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* CTA pill */}
                    <div
                      className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 group-hover:scale-105"
                      style={{
                        backgroundColor: prog.accent,
                        color: '#0f172a',
                        boxShadow: `0 0 24px ${prog.accent}35`,
                      }}
                    >
                      Explore
                      <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Hover border glow */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                  style={{ border: `1px solid ${prog.accent}40` }}
                />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* ── More Opportunities ── */}
        <RevealOnScrollWrapper>
          <div className="border-t border-slate-800/60 py-16 px-4">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-2xl mb-3">✨</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">More Ways to Get Involved</h2>
              <p className="text-slate-500 text-sm mb-8">
                Beyond programs, VSA hosts events that celebrate Vietnamese culture all year long.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {extraLinks.map(item => (
                  <Link
                    key={item.link}
                    to={item.link}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all duration-200 text-sm font-medium"
                  >
                    <span>{item.emoji}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </RevealOnScrollWrapper>

      </div>
    </>
  );
}
