import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

const skills = [
  { icon: '🎤', title: 'Communication', desc: 'Present ideas, run meetings, and learn to speak with clarity and confidence.' },
  { icon: '🤝', title: 'Leadership', desc: 'Lead initiatives, take ownership, and inspire others around a shared mission.' },
  { icon: '🌐', title: 'Networking', desc: 'Build relationships with board members, alumni, and the broader VSA community.' },
  { icon: '📋', title: 'Event Planning', desc: "Get hands-on experience organizing VSA's events from concept to execution." },
  { icon: '💡', title: 'Creative Input', desc: 'Your ideas have real impact — interns actively shape the member experience.' },
  { icon: '🚀', title: 'Career Growth', desc: 'Add meaningful leadership experience to your resume and LinkedIn.' },
];

const timeline = [
  { phase: 'Week 1–2', title: 'Onboarding', desc: 'Meet your board mentor, learn the org structure, and get oriented on current projects.' },
  { phase: 'Week 3–6', title: 'Active Collaboration', desc: 'Shadow board members, contribute to ongoing projects, and attend internal meetings.' },
  { phase: 'Week 7–10', title: 'Lead a Project', desc: 'Take ownership of a VSA initiative — plan it, run it, and see the impact firsthand.' },
  { phase: 'Week 11+', title: 'Reflect & Grow', desc: 'Share takeaways with the board and consider running for a board position yourself.' },
];

export function Internship() {
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

              <div className="flex items-center gap-3 mb-5">
                <span className="text-5xl">🚀</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-indigo-400 font-semibold border border-indigo-500/25 rounded-full px-3 py-1.5 bg-indigo-500/8">
                  Leadership Program
                </span>
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(3rem, 9vw, 5.5rem)' }}>
                Intern Program
              </h1>
              <p className="text-indigo-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                Lead · Build · Impact
              </p>
              <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                Go behind the scenes. Learn how VSA operates, develop real leadership skills, and become the future of UCSD VSA.
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
                  The VSA Intern Program is designed for members with an interest in learning how VSA operates and the behind-the-scenes work that board members do.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  You'll work alongside interns and board members, contribute real ideas, and have a tangible impact on the general member experience. We hope for you to become the future of UCSD VSA.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Program Length', value: 'One Semester' },
                  { label: 'Time Commitment', value: 'Flexible' },
                  { label: 'Open To', value: 'All VSA Members' },
                  { label: 'Applications', value: 'Each Semester' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2.5 px-4 rounded-lg border border-slate-800 bg-slate-900/30">
                    <span className="text-slate-500 text-xs">{item.label}</span>
                    <span className="text-indigo-300 text-xs font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </RevealOnScrollWrapper>

        {/* ── Skills You'll Build ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">What You'll Build</h2>
                <p className="text-slate-500 text-sm">Real skills. Real experience. Real impact.</p>
              </div>
            </RevealOnScrollWrapper>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((skill) => (
                <RevealOnScrollWrapper key={skill.title}>
                  <motion.div
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    className="p-5 rounded-xl border border-slate-800 hover:border-indigo-500/25 bg-slate-900/40 transition-colors"
                  >
                    <span className="text-2xl block mb-3">{skill.icon}</span>
                    <h3 className="font-heading font-semibold text-white mb-1.5 text-sm">{skill.title}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">{skill.desc}</p>
                  </motion.div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── Timeline ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <RevealOnScrollWrapper>
            <div className="text-center mb-12">
              <h2 className="font-heading font-bold text-3xl text-white mb-2">Your Intern Journey</h2>
              <p className="text-slate-500 text-sm">A typical semester as a VSA intern.</p>
            </div>
          </RevealOnScrollWrapper>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/30 via-indigo-500/20 to-transparent" />

            <div className="space-y-6 pl-16">
              {timeline.map((item, i) => (
                <RevealOnScrollWrapper key={item.phase}>
                  <div className="relative">
                    {/* Dot */}
                    <div className="absolute -left-[3.25rem] top-1 w-3 h-3 rounded-full bg-indigo-500/40 border border-indigo-500/60 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-indigo-400" />
                    </div>
                    <div className="p-5 rounded-xl border border-slate-800 hover:border-indigo-500/20 bg-slate-900/30 transition-colors">
                      <span className="text-[10px] tracking-widest uppercase text-indigo-400/60 font-semibold">{item.phase}</span>
                      <h3 className="font-heading font-semibold text-white mt-1 mb-2">{item.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-900/25 to-violet-900/15 border border-indigo-500/20 p-8 sm:p-10 text-center">
              <p className="text-4xl mb-4">🚀</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Ready to Build VSA's Future?</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-7">
                Applications open each semester. Follow our Instagram to stay updated on intern program announcements.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="https://www.instagram.com/ucsd.vsa/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition-colors text-sm"
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
