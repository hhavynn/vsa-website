import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

// ─────────────────────────────────────────────────────────────────────────────
// WNC CONFIG — Update these fields each year for the upcoming event.
// All other page copy is evergreen and requires no annual editing.
// ─────────────────────────────────────────────────────────────────────────────

const WNC_CONFIG = {
  // Set to true to show an "Upcoming" badge and ticket button in the CTA.
  eventActive: false,
  // Short label for the event, e.g. "WNC 2027"
  eventLabel: '',
  // Date as a display string, e.g. "Saturday, February 7, 2026"
  date: '',
  venue: '',
  ticketsAvailable: false,
  ticketLink: '',
  ticketNote: '', // e.g. "$7 presale · $10 at the door"
  // Optional one-line announcement for the CTA area.
  announcement: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// PAST EVENTS ARCHIVE — Add a new entry after each WNC.
// Entries are shown newest-first in the Past Highlights section.
// All fields except year are optional.
// ─────────────────────────────────────────────────────────────────────────────

interface WNCArchiveEntry {
  year: string;
  label?: string;       // e.g. "WNC 2026"
  date?: string;
  venue?: string;
  winner?: string;      // winning school/team name
  schools?: string[];   // participating schools
  note?: string;        // one-line recap or highlight
  trailerUrl?: string;  // YouTube embed URL
}

const WNC_ARCHIVE: WNCArchiveEntry[] = [
  {
    year: '2026',
    label: 'WNC 2026',
    date: 'February 7, 2026',
    venue: 'JEANNIE Auditorium',
    winner: 'CSULB "LeBeach"',
    schools: ['UCSD', 'UCI', 'UCR', 'UCSB', 'USC', 'Chapman', 'CPP', 'CSUF', 'CSULB', 'SDSU'],
    note: 'A high-energy night with approximately 350 attendees.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// STATIC EVERGREEN CONTENT
// ─────────────────────────────────────────────────────────────────────────────



const whatToExpect = [
  { emoji: '🏫', label: 'School Teams' },
  { emoji: '🎮', label: 'Improv Games' },
  { emoji: '🤺', label: 'Roast Battles' },
  { emoji: '📣', label: 'Crowd Energy' },
  { emoji: '🏆', label: 'Winner Crowned' },
  { emoji: '🎟️', label: 'Raffles & Shoutouts' },
  { emoji: '🌏', label: 'Multi-Campus Community' },
  { emoji: '⚡', label: 'Non-Stop Hype' },
];

const faqs = [
  {
    q: 'What is Wild N\' Culture?',
    a: 'Wild N\' Culture (WNC) is UCSD VSA\'s annual intercollegiate comedy competition — inspired by Wild \'N Out and rooted in Vietnamese and Asian American culture. Schools face off in a series of live improv-style games and roast battles judged by the crowd and guest judges.',
  },
  {
    q: 'Which schools participate?',
    a: 'Participating schools vary each year. WNC brings together Vietnamese Student Associations and student groups from across Southern California and UC campuses. Follow @vsaatucsd for each year\'s lineup.',
  },
  {
    q: 'How is the winner decided?',
    a: 'Schools earn points through game rounds. A combination of judge scoring and crowd energy typically determines the winner, though the exact format may vary by year.',
  },
  {
    q: 'Is the event free?',
    a: 'WNC is typically a ticketed event. Ticket prices and availability are announced each year through VSA\'s Instagram and the event\'s page.',
  },
  {
    q: 'Can anyone attend?',
    a: 'Yes — WNC is open to everyone. You don\'t need to be a VSA member or affiliated with a participating school to come and enjoy the show.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export function WildNCulture() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageTitle title="Wild N' Culture" />
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

              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="text-5xl">🎤</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-violet-400 font-semibold border border-violet-500/25 rounded-full px-3 py-1.5 bg-violet-500/8">
                  Annual Comedy Competition
                </span>
                {WNC_CONFIG.eventActive && (
                  <span className="text-[10px] tracking-[0.25em] uppercase text-fuchsia-400 font-semibold border border-fuchsia-500/25 rounded-full px-3 py-1.5 bg-fuchsia-500/8">
                    {WNC_CONFIG.eventLabel || 'Upcoming'}
                  </span>
                )}
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(3rem, 9vw, 5.5rem)' }}>
                Wild N'<br />
                <span className="text-gradient">Culture</span>
              </h1>
              <p className="text-violet-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                WNC · UCSD VSA · Intercollegiate
              </p>
              <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                UCSD VSA's annual intercollegiate comedy competition — inspired by Wild 'N Out and rooted in Vietnamese and Asian American culture. Schools compete live in improv games and roast battles for the crowd, the judges, and the title.
              </p>

              {/* Upcoming event details */}
              {WNC_CONFIG.eventActive && (WNC_CONFIG.date || WNC_CONFIG.venue) && (
                <div className="flex flex-wrap gap-3 mt-8">
                  {WNC_CONFIG.date && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-500/15 bg-violet-500/5">
                      <span className="text-violet-400 text-xs font-semibold">{WNC_CONFIG.date}</span>
                    </div>
                  )}
                  {WNC_CONFIG.venue && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-500/15 bg-violet-500/5">
                      <span className="text-violet-400 text-xs font-semibold">{WNC_CONFIG.venue}</span>
                    </div>
                  )}
                  {WNC_CONFIG.ticketNote && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-500/15 bg-violet-500/5">
                      <span className="text-slate-400 text-xs">{WNC_CONFIG.ticketNote}</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* ── About ── */}
        <RevealOnScrollWrapper>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <div className="max-w-2xl space-y-4">
              <h2 className="font-heading font-bold text-3xl text-white">What is Wild N' Culture?</h2>
              <p className="text-slate-400 leading-relaxed">
                Wild N' Culture is UCSD VSA's signature annual external event — a live intercollegiate comedy competition that brings together Vietnamese Student Associations and student groups from campuses across Southern California.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Inspired by the format of Wild 'N Out, WNC pits school teams against each other in a series of improv-style games, roast battles, and crowd-driven moments. The energy is loud, the humor is real, and the community is at the center of it all.
              </p>
            </div>
          </div>
        </RevealOnScrollWrapper>

        {/* ── What to Expect ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">What to Expect</h2>
                <p className="text-slate-500 text-sm">A night of competition, crowd energy, and community — here's what WNC typically includes.</p>
              </div>
            </RevealOnScrollWrapper>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {whatToExpect.map((item) => (
                <RevealOnScrollWrapper key={item.label}>
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-slate-800 hover:border-violet-500/20 bg-slate-900/30 transition-colors">
                    <span className="text-xl flex-shrink-0">{item.emoji}</span>
                    <span className="text-slate-400 text-xs font-medium">{item.label}</span>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        </div>


        {/* ── Community & Culture ── */}
        <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <h2 className="font-heading font-bold text-3xl text-white mb-4">More Than a Competition</h2>
                  <p className="text-slate-400 leading-relaxed mb-4">
                    WNC is rooted in community. While the competition is real and the roasts are unfiltered, the event is ultimately about bringing campuses together in celebration of Vietnamese and Asian American culture.
                  </p>
                  <p className="text-slate-400 leading-relaxed">
                    Each year, WNC creates a space where humor, school pride, and cultural identity intersect — and where the crowd is just as much a part of the show as the teams on stage.
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    { emoji: '🌏', label: 'Intercollegiate', desc: 'Schools from across Southern California come together on one stage.' },
                    { emoji: '🎭', label: 'Culturally Rooted', desc: 'Vietnamese and Asian American culture drives the humor and heart of WNC.' },
                    { emoji: '📣', label: 'Crowd-Powered', desc: 'The audience is part of the show — your energy shapes the night.' },
                    { emoji: '🏆', label: 'Competitive Spirit', desc: 'There\'s always a winner, but the community wins every year.' },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-800 hover:border-violet-500/15 bg-slate-900/30 transition-colors">
                      <span className="text-xl flex-shrink-0">{item.emoji}</span>
                      <div>
                        <p className="text-white text-xs font-semibold mb-0.5">{item.label}</p>
                        <p className="text-slate-600 text-xs leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScrollWrapper>
          </div>
        </div>

        {/* ── Past Highlights / Archive ── */}
        {WNC_ARCHIVE.length > 0 && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">Past Highlights</h2>
                <p className="text-slate-500 text-sm">A look back at previous WNC events.</p>
              </div>
            </RevealOnScrollWrapper>
            <div className="space-y-4">
              {WNC_ARCHIVE.map((entry) => (
                <RevealOnScrollWrapper key={entry.year}>
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <div className="bg-slate-900/50 px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-[10px] tracking-widest uppercase text-violet-400/60 font-semibold">{entry.label || `WNC ${entry.year}`}</span>
                        {entry.date && <p className="text-slate-500 text-xs mt-0.5">{entry.date}{entry.venue ? ` · ${entry.venue}` : ''}</p>}
                      </div>
                      {entry.winner && (
                        <span className="text-xs px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/8 text-amber-400 font-semibold">
                          🏆 {entry.winner}
                        </span>
                      )}
                    </div>
                    <div className="p-5 space-y-3">
                      {entry.schools && entry.schools.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Participating Schools</p>
                          <div className="flex flex-wrap gap-1.5">
                            {entry.schools.map(s => (
                              <span key={s} className="text-xs px-2.5 py-1 rounded-lg border border-slate-800 text-slate-400 bg-slate-900/50">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {entry.note && (
                        <p className="text-slate-600 text-xs italic border-l-2 border-violet-500/20 pl-3">{entry.note}</p>
                      )}
                      {entry.trailerUrl && (
                        <div className="rounded-xl overflow-hidden border border-slate-800 aspect-video mt-3">
                          <iframe
                            src={entry.trailerUrl}
                            title={`WNC ${entry.year} recap`}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        )}

        {/* ── FAQ ── */}
        <div className={WNC_ARCHIVE.length > 0 ? 'border-t border-slate-800/50 py-16 bg-slate-900/20' : 'border-y border-slate-800/50 py-16 bg-slate-900/20'}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <RevealOnScrollWrapper>
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl text-white mb-2">FAQ</h2>
                <p className="text-slate-500 text-sm">Common questions about Wild N' Culture.</p>
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
                        className="text-violet-400/60 flex-shrink-0 ml-4 text-lg leading-none"
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
            <div className="rounded-2xl bg-gradient-to-br from-violet-900/25 to-fuchsia-900/15 border border-violet-500/20 p-8 sm:p-10 text-center">
              <p className="text-4xl mb-4">🎤</p>
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Ready to Go Wild?</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-7">
                {WNC_CONFIG.announcement
                  ? WNC_CONFIG.announcement
                  : 'Follow our Instagram for event dates, ticket drops, school lineup announcements, and all the WNC hype.'}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {WNC_CONFIG.eventActive && WNC_CONFIG.ticketsAvailable && WNC_CONFIG.ticketLink ? (
                  <a
                    href={WNC_CONFIG.ticketLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold rounded-xl transition-colors text-sm"
                  >
                    Get Tickets{WNC_CONFIG.eventLabel ? ` · ${WNC_CONFIG.eventLabel}` : ''}
                  </a>
                ) : null}
                <a
                  href="https://www.instagram.com/vsaatucsd/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  Follow @vsaatucsd
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
