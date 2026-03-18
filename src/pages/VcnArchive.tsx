import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';

// ─────────────────────────────────────────────────────────────────────────────
// VCN ARCHIVE DATA — Add a new entry each year after the show.
// Entries are displayed newest-first. All fields are optional except year/title.
// ─────────────────────────────────────────────────────────────────────────────

interface VCNArchiveEntry {
  year: string;
  title: string;
  synopsis?: string;
  posterUrl?: string;
  trailerUrl?: string;
  dances?: string[];
  sponsors?: string[];
  note?: string; // e.g. a reflection, award, or notable moment
}

const VCN_ARCHIVE: VCNArchiveEntry[] = [
  // Add each completed year below — most recent year first.
  // Example entry:
  // {
  //   year: '2025',
  //   title: 'Example Title',
  //   synopsis: 'A short story synopsis for the archive.',
  //   trailerUrl: 'https://www.youtube.com/embed/VIDEO_ID',
  //   posterUrl: 'https://example.com/poster.jpg',
  //   dances: ['Dance One', 'Dance Two', 'Dance Three'],
  //   sponsors: ['Sponsor A', 'Sponsor B'],
  //   note: 'Sold out in under 24 hours.',
  // },
];

// ─────────────────────────────────────────────────────────────────────────────

export function VCNArchive() {
  return (
    <>
      <PageTitle title="VCN Archive" />
      <div className="min-h-screen bg-slate-950">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/60 via-slate-950 to-slate-950" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/6 rounded-full blur-[80px] pointer-events-none" />

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

              <div className="flex items-center gap-3 mb-5">
                <span className="text-5xl">📚</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-red-400/60 font-semibold border border-red-500/20 rounded-full px-3 py-1.5 bg-red-500/5">
                  Past Productions
                </span>
              </div>

              <h1 className="font-heading font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)' }}>
                VCN Archive
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
                A record of UCSD VSA's Vietnamese Culture Night productions — each year a new story, a new cast, and a new chapter in our community's history.
              </p>
            </motion.div>
          </div>
        </div>

        {/* ── Archive entries ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          {VCN_ARCHIVE.length === 0 ? (
            <RevealOnScrollWrapper>
              <div className="text-center py-20">
                <div className="text-5xl mb-4">🎭</div>
                <p className="text-slate-500 text-sm">Archive entries will appear here after each production year.</p>
                <Link
                  to="/vcn/current"
                  className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  See This Year's Show →
                </Link>
              </div>
            </RevealOnScrollWrapper>
          ) : (
            <div className="space-y-12">
              {VCN_ARCHIVE.map((entry) => (
                <RevealOnScrollWrapper key={entry.year}>
                  <div className="rounded-2xl border border-slate-800 overflow-hidden">
                    {/* Entry header */}
                    <div className="bg-slate-900/50 px-6 py-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <span className="text-[10px] tracking-widest uppercase text-red-400/60 font-semibold">VCN {entry.year}</span>
                        <h2 className="font-heading font-bold text-white text-xl mt-0.5">{entry.title}</h2>
                      </div>
                    </div>

                    <div className="p-6 grid md:grid-cols-2 gap-6">
                      {/* Left: poster or trailer */}
                      {(entry.posterUrl || entry.trailerUrl) && (
                        <div>
                          {entry.trailerUrl ? (
                            <div className="rounded-xl overflow-hidden border border-slate-800 aspect-video">
                              <iframe
                                src={entry.trailerUrl}
                                title={`VCN ${entry.year} trailer`}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          ) : entry.posterUrl ? (
                            <img
                              src={entry.posterUrl}
                              alt={`VCN ${entry.year} poster`}
                              className="rounded-xl border border-slate-800 w-full object-cover"
                            />
                          ) : null}
                        </div>
                      )}

                      {/* Right: details */}
                      <div className="space-y-4">
                        {entry.synopsis && (
                          <p className="text-slate-400 text-sm leading-relaxed">{entry.synopsis}</p>
                        )}

                        {entry.dances && entry.dances.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Dances</p>
                            <div className="flex flex-wrap gap-1.5">
                              {entry.dances.map((d) => (
                                <span key={d} className="text-xs px-2.5 py-1 rounded-lg border border-slate-800 text-slate-400 bg-slate-900/50">
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {entry.sponsors && entry.sponsors.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Sponsors</p>
                            <div className="flex flex-wrap gap-1.5">
                              {entry.sponsors.map((s) => (
                                <span key={s} className="text-xs px-2.5 py-1 rounded-lg border border-slate-800 text-slate-500 bg-slate-900/50">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {entry.note && (
                          <p className="text-slate-600 text-xs italic border-l-2 border-red-500/20 pl-3">{entry.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </RevealOnScrollWrapper>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer nav ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/vcn/current"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors text-sm"
            >
              This Year's Show →
            </Link>
            <Link
              to="/vcn"
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
            >
              ← About VCN
            </Link>
          </div>
        </div>

      </div>
    </>
  );
}
