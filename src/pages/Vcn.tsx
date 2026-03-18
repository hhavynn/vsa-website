import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

// ─────────────────────────────────────────────────────────────────────────────
// VCN MAIN PAGE — EVERGREEN CONTENT
// This page describes VCN in durable, year-agnostic language.
// Year-specific details (theme, date, cast, tickets) live in VcnCurrent.tsx.
// Past years are accessible through VcnArchive.tsx.
// ─────────────────────────────────────────────────────────────────────────────

const highlights = [
  {
    icon: '💃',
    title: 'Dance Performances',
    desc: 'VCN typically features multiple dance performances spanning a range of styles — from traditional Vietnamese dance to contemporary choreography.',
  },
  {
    icon: '🎭',
    title: 'Narrative Stage Production',
    desc: 'A student-produced play or theatrical performance that explores themes of Vietnamese identity, family, tradition, and the Vietnamese-American experience.',
  },
  {
    icon: '🌸',
    title: 'Cultural Storytelling',
    desc: 'VCN is built around stories — personal, cultural, and generational — told through performance, art, and community.',
  },
  {
    icon: '🤝',
    title: 'Student-Led Production',
    desc: 'Every element of VCN is conceived, built, and executed by UCSD students — on stage and behind the scenes.',
  },
];

const committees = [
  { emoji: '💃', title: 'Dance Teams', desc: 'Coordinate choreography, rehearsals, and performance prep for each dance in the show.' },
  { emoji: '🎭', title: 'Acting / Theatre', desc: 'Perform in the narrative stage production and participate in rehearsals and creative development.' },
  { emoji: '🔨', title: 'Props', desc: 'Design and build the set and prop pieces that bring the production\'s world to life.' },
  { emoji: '🎙️', title: 'Stage Management', desc: 'Coordinate backstage operations and ensure smooth execution on show day.' },
];

const faqs = [
  {
    q: 'What is VCN?',
    a: 'Vietnamese Culture Night (VCN) is UCSD VSA\'s large annual cultural production. It celebrates Vietnamese culture through storytelling, dance, theatre, and performance — all built and performed by UCSD students.',
  },
  {
    q: 'What can I expect at the show?',
    a: 'A VCN show typically includes a narrative stage production alongside multiple dance performances. Each year\'s show brings a new theme, story, and lineup of performances. The specific format and content vary by year.',
  },
  {
    q: 'Is the show free?',
    a: 'Admission details vary by year. Follow @vsaatucsd on Instagram or check the current year\'s VCN page for the latest ticketing information.',
  },
  {
    q: 'How can I get involved?',
    a: 'Students can participate on stage through dance or acting, or contribute behind the scenes through committees like props and stage management. Opportunities are announced each production cycle.',
  },
  {
    q: 'Do I need experience to audition or join a committee?',
    a: 'Requirements vary by role and year. Many committees welcome students with no prior experience who are willing to commit and learn. Auditions and committee applications are announced each cycle.',
  },
  {
    q: 'How do I find out about auditions and applications?',
    a: 'Follow @vsaatucsd on Instagram and watch for official VCN announcements each year. Applications and auditions typically open during the fall or early production cycle.',
  },
  {
    q: 'Can community members or non-VSA students attend?',
    a: 'Yes. VCN is open to the campus community and beyond. It is a celebration of Vietnamese culture that welcomes all guests.',
  },
];

export function VCN() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageTitle title="Vietnamese Culture Night" />
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

              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="text-5xl">🎭</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-red-400 font-semibold border border-red-500/25 rounded-full px-3 py-1.5 bg-red-500/8">
                  Annual Cultural Production
                </span>
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)' }}>
                Vietnamese<br />
                <span style={{ color: '#fbbf24' }}>Culture Night</span>
              </h1>
              <p className="text-red-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                VCN · UCSD VSA
              </p>
              <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                One of UCSD VSA's largest annual productions — a full evening of dance, theatre, and storytelling that celebrates Vietnamese culture and the Vietnamese-American experience.
              </p>

              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  to="/vcn/current"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  This Year's Show →
                </Link>
                <Link
                  to="/vcn/archive"
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
                >
                  Past Productions
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── What is VCN ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="space-y-4">
                <h2 className="font-heading font-bold text-3xl text-white">What is VCN?</h2>
                <p className="text-slate-400 leading-relaxed">
                  Vietnamese Culture Night (VCN) is UCSD VSA's large annual cultural production. Each year, students come together to celebrate Vietnamese culture through performance and storytelling — creating an evening that honors tradition, explores identity, and invites the broader community in.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  VCN is fully student-led: from the creative vision to the choreography, props, costumes, and show-day execution, every part of the production is built and performed by UCSD students.
                </p>
              </div>
              <div className="relative rounded-2xl border border-red-500/20 bg-red-900/8 p-8 text-center overflow-hidden">
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, #ef4444 0%, transparent 70%)' }} />
                <div className="text-6xl mb-4">🌟</div>
                <blockquote className="text-slate-300 text-sm leading-relaxed italic">
                  "A celebration of Vietnamese culture — built by students, for the community."
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
                <h2 className="font-heading font-bold text-3xl text-white mb-2">What to Expect</h2>
                <p className="text-slate-500 text-sm">The specific lineup varies each year — here's what VCN typically includes.</p>
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

        {/* ── Get Involved ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">Get Involved</h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">VCN is powered by a large student team — on stage and behind the scenes.</p>
            </div>
          </RevealOnScrollWrapper>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              { icon: '🎪', role: 'Performer', desc: 'Audition for a dance team or the theatrical production. Specific requirements and audition formats vary by year and role.' },
              { icon: '🛠️', role: 'Production Committee', desc: 'Join one of VCN\'s many behind-the-scenes committees — from props and costumes to marketing, stage management, and more.' },
              { icon: '🎟️', role: 'Audience Guest', desc: 'Experience the show as an audience member. VCN is open to the campus community and beyond. Check the current year\'s page for ticketing details.' },
            ].map(item => (
              <RevealOnScrollWrapper key={item.role}>
                <div className="p-5 rounded-xl border border-slate-800 hover:border-red-500/20 bg-slate-900/30 transition-colors text-center h-full">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-heading font-semibold text-white mb-2 text-sm">{item.role}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              </RevealOnScrollWrapper>
            ))}
          </div>

          {/* Committee breakdown */}
          <RevealOnScrollWrapper>
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
              <h3 className="font-heading font-semibold text-white mb-4 text-sm text-center">Production Committees</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {committees.map((c) => (
                  <div key={c.title} className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-800/50 hover:border-red-500/15 bg-slate-950/30 transition-colors">
                    <span className="text-lg flex-shrink-0">{c.emoji}</span>
                    <div>
                      <p className="text-white text-xs font-medium mb-0.5">{c.title}</p>
                      <p className="text-slate-600 text-[10px] leading-relaxed">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-slate-600 text-xs text-center mt-4">Committee opportunities are announced each production cycle through VSA's official channels.</p>
            </div>
          </RevealOnScrollWrapper>
        </div>

        {/* ── Production Themes ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-10">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">Themes VCN Often Explores</h2>
                <p className="text-slate-500 text-sm">Each year brings a new story — but certain threads run through VCN year after year.</p>
              </div>
            </RevealOnScrollWrapper>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { emoji: '👨‍👩‍👧', label: 'Family & Relationships' },
                { emoji: '🌿', label: 'Heritage & Tradition' },
                { emoji: '🪞', label: 'Identity & Self' },
                { emoji: '🌉', label: 'Generational Bridges' },
                { emoji: '🌍', label: 'Vietnamese-American Experience' },
                { emoji: '💌', label: 'Love & Sacrifice' },
              ].map((t) => (
                <RevealOnScrollWrapper key={t.label}>
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-slate-800 hover:border-red-500/15 bg-slate-900/30 transition-colors">
                    <span className="text-xl">{t.emoji}</span>
                    <span className="text-slate-400 text-xs font-medium">{t.label}</span>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">FAQ</h2>
              <p className="text-slate-500 text-sm">Common questions about VCN.</p>
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
                      className="text-red-400/60 flex-shrink-0 ml-4 text-lg leading-none"
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
            <div className="rounded-2xl bg-gradient-to-br from-red-900/25 to-rose-900/15 border border-red-500/20 p-8 sm:p-10 text-center">
              <p className="text-4xl mb-4">🎭</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">See You at VCN</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-7">
                Follow our Instagram for show dates, audition announcements, committee applications, and ticket info each year.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  to="/vcn/current"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  This Year's Show →
                </Link>
                <a
                  href="https://www.instagram.com/vsaatucsd/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
                >
                  Follow @vsaatucsd
                </a>
              </div>
            </div>
          </div>
        </RevealOnScrollWrapper>

      </div>
    </>
  );
}
