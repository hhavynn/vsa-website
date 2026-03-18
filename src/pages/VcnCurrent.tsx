import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

// ─────────────────────────────────────────────────────────────────────────────
// VCN CURRENT YEAR — Update all fields in this config each production cycle.
// This file is the only thing that needs editing for a new VCN year.
// ─────────────────────────────────────────────────────────────────────────────

const VCN_CURRENT = {
  // Set to true when this year's show details are ready to publish.
  active: true,

  // Year label shown on the page.
  year: '2026',

  // Show title / theme (Vietnamese or English, your choice).
  title: 'Tình Yêu Thầm Lặng',

  // One or two sentence synopsis of this year's story.
  synopsis: 'Tình Yêu Thầm Lặng explores unspoken love within a Vietnamese household, highlighting family sacrifice, generational misunderstanding, and the quiet ways care is expressed through action rather than words.',

  // Show details — leave empty strings to hide that field.
  date: 'Saturday, April 18, 2026',
  time: '', // Assuming evening but not specified, so leaving empty for now
  venue: '', // Not specified in prompt so leaving empty

  // Ticketing — set ticketsAvailable: true and add a link to enable the ticket button.
  ticketsAvailable: false,
  ticketLink: '',
  ticketNote: '', // e.g. "General admission · Doors open at 6:30 PM"

  // Optional promotional image URL (poster, banner, etc.)
  posterUrl: '',

  // Trailer embed URL (YouTube embed URL format)
  trailerUrl: '',

  // Dances — add each dance with its title and optional choreographer name(s).
  // Leave choreographer empty if not publishing names publicly.
  dances: [] as Array<{ title: string; choreographer?: string }>,

  // Sponsors for this year — name and optional website.
  sponsors: [] as Array<{ name: string; url?: string }>,

  // Optional short message for the audience from this year's production team.
  messageFromTeam: '',
};

// ─────────────────────────────────────────────────────────────────────────────

export function VCNCurrent() {
  if (!VCN_CURRENT.active) {
    return (
      <>
        <PageTitle title="VCN — This Year's Show" />
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-6">🎭</div>
            <h1 className="font-heading font-bold text-3xl text-white mb-4">
              VCN {VCN_CURRENT.year || 'Coming Soon'}
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Details for this year's Vietnamese Culture Night production are coming soon. Follow{' '}
              <a
                href="https://www.instagram.com/vsaatucsd/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                @vsaatucsd
              </a>{' '}
              on Instagram for the latest announcements.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/vcn"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors text-sm"
              >
                ← About VCN
              </Link>
              <Link
                to="/vcn/archive"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
              >
                Past Productions
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={`VCN ${VCN_CURRENT.year}${VCN_CURRENT.title ? ` — ${VCN_CURRENT.title}` : ''}`} />
      <div className="min-h-screen bg-slate-950">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/80 via-rose-950/40 to-slate-950" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <Link
                to="/vcn"
                className="inline-flex items-center gap-1.5 text-red-400/60 hover:text-red-400 text-sm mb-8 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Vietnamese Culture Night
              </Link>

              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="text-5xl">🎭</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-red-400 font-semibold border border-red-500/25 rounded-full px-3 py-1.5 bg-red-500/8">
                  VCN {VCN_CURRENT.year}
                </span>
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)' }}>
                {VCN_CURRENT.title || 'Vietnamese Culture Night'}
              </h1>
              <p className="text-red-300/50 text-sm font-medium tracking-[0.2em] uppercase mb-6">
                UCSD VSA · {VCN_CURRENT.year}
              </p>

              {VCN_CURRENT.synopsis && (
                <p className="text-slate-300 text-lg leading-relaxed max-w-xl mb-8">{VCN_CURRENT.synopsis}</p>
              )}

              {/* Show details */}
              {(VCN_CURRENT.date || VCN_CURRENT.venue) && (
                <div className="flex flex-wrap gap-3 mb-8">
                  {VCN_CURRENT.date && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/15 bg-red-500/5">
                      <span className="text-red-400 text-xs font-semibold">{VCN_CURRENT.date}</span>
                      {VCN_CURRENT.time && <span className="text-slate-600 text-xs">·</span>}
                      {VCN_CURRENT.time && <span className="text-slate-500 text-xs">{VCN_CURRENT.time}</span>}
                    </div>
                  )}
                  {VCN_CURRENT.venue && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/15 bg-red-500/5">
                      <span className="text-red-400 text-xs font-semibold">{VCN_CURRENT.venue}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Ticket CTA */}
              {VCN_CURRENT.ticketsAvailable && VCN_CURRENT.ticketLink && (
                <div className="flex flex-wrap gap-3">
                  <a
                    href={VCN_CURRENT.ticketLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors text-sm"
                  >
                    Get Tickets
                  </a>
                  {VCN_CURRENT.ticketNote && (
                    <p className="text-slate-500 text-xs self-center">{VCN_CURRENT.ticketNote}</p>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* ── Poster / Trailer ── */}
        {(VCN_CURRENT.posterUrl || VCN_CURRENT.trailerUrl) && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
            <div className="grid md:grid-cols-2 gap-6">
              {VCN_CURRENT.posterUrl && (
                <RevealOnScrollWrapper>
                  <img
                    src={VCN_CURRENT.posterUrl}
                    alt={`VCN ${VCN_CURRENT.year} poster`}
                    className="rounded-xl border border-slate-800 w-full object-cover"
                  />
                </RevealOnScrollWrapper>
              )}
              {VCN_CURRENT.trailerUrl && (
                <RevealOnScrollWrapper>
                  <div className="rounded-xl overflow-hidden border border-slate-800 aspect-video">
                    <iframe
                      src={VCN_CURRENT.trailerUrl}
                      title={`VCN ${VCN_CURRENT.year} trailer`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </RevealOnScrollWrapper>
              )}
            </div>
          </div>
        )}

        {/* ── Dances ── */}
        {VCN_CURRENT.dances.length > 0 && (
          <div className="border-y border-slate-800/50 py-16 bg-slate-900/20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <RevealOnScrollWrapper>
                <div className="text-center mb-12">
                  <h2 className="font-heading font-bold text-3xl text-white mb-2">This Year's Dances</h2>
                </div>
              </RevealOnScrollWrapper>
              <div className="grid sm:grid-cols-2 gap-3">
                {VCN_CURRENT.dances.map((dance, i) => (
                  <RevealOnScrollWrapper key={i}>
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-800 hover:border-red-500/20 bg-slate-900/30 transition-colors">
                      <span className="text-red-400/40 font-heading font-bold text-2xl leading-none mt-0.5">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="text-white font-medium text-sm">{dance.title}</p>
                        {dance.choreographer && (
                          <p className="text-slate-600 text-xs mt-0.5">Choreography by {dance.choreographer}</p>
                        )}
                      </div>
                    </div>
                  </RevealOnScrollWrapper>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Sponsors ── */}
        {VCN_CURRENT.sponsors.length > 0 && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
            <RevealOnScrollWrapper>
              <div className="text-center mb-10">
                <h2 className="font-heading font-bold text-2xl text-white mb-2">Thank You to Our Sponsors</h2>
                <p className="text-slate-500 text-sm">VCN is made possible with the generous support of our community partners.</p>
              </div>
            </RevealOnScrollWrapper>
            <div className="flex flex-wrap justify-center gap-3">
              {VCN_CURRENT.sponsors.map((s, i) => (
                <RevealOnScrollWrapper key={i}>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg border border-slate-800 hover:border-red-500/20 bg-slate-900/40 text-slate-300 text-sm font-medium transition-colors"
                    >
                      {s.name}
                    </a>
                  ) : (
                    <span className="px-4 py-2 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 text-sm font-medium">
                      {s.name}
                    </span>
                  )}
                </RevealOnScrollWrapper>
              ))}
            </div>
          </div>
        )}

        {/* ── Message from the Team ── */}
        {VCN_CURRENT.messageFromTeam && (
          <div className="border-t border-slate-800/50 py-16 bg-slate-900/20">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
              <RevealOnScrollWrapper>
                <div className="text-4xl mb-4">💌</div>
                <h2 className="font-heading font-bold text-2xl text-white mb-4">From the Production Team</h2>
                <p className="text-slate-400 text-sm leading-relaxed italic">"{VCN_CURRENT.messageFromTeam}"</p>
              </RevealOnScrollWrapper>
            </div>
          </div>
        )}

        {/* ── Footer nav ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24 pt-8">
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/vcn"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
            >
              ← About VCN
            </Link>
            <Link
              to="/vcn/archive"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
            >
              Past Productions
            </Link>
          </div>
        </div>

      </div>
    </>
  );
}
