import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { useProgramContent } from '../hooks/useProgramContent';
import {
  getProgramMetaParts,
  hasPrimaryProgramLink,
  isProgramContentHidden,
  PROGRAM_STATUS_LABELS,
} from '../lib/programContent';

// ─────────────────────────────────────────────────────────────────────────────
// WNC CONFIG — Update these fields each year for the upcoming event.
// ─────────────────────────────────────────────────────────────────────────────

const WNC_CONFIG = {
  eventActive: false,
  eventLabel: '',
  date: '',
  venue: '',
  ticketsAvailable: false,
  ticketLink: '',
  ticketNote: '',
  announcement: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// PAST EVENTS ARCHIVE — Add a new entry after each WNC.
// ─────────────────────────────────────────────────────────────────────────────

interface WNCArchiveEntry {
  year: string;
  label?: string;
  date?: string;
  venue?: string;
  winner?: string;
  schools?: string[];
  note?: string;
  trailerUrl?: string;
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

const whatToExpect = [
  'School Teams', 'Improv Games', 'Roast Battles', 'Crowd Energy',
  'Winner Crowned', 'Raffles & Shoutouts', 'Multi-Campus Community', 'Non-Stop Hype',
];

const faqs = [
  { q: "What is Wild N' Culture?", a: "Wild N' Culture (WNC) is UCSD VSA's annual intercollegiate comedy competition — inspired by Wild 'N Out and rooted in Vietnamese and Asian American culture. Schools face off in a series of live improv-style games and roast battles judged by the crowd and guest judges." },
  { q: 'Which schools participate?', a: "Participating schools vary each year. WNC brings together Vietnamese Student Associations and student groups from across Southern California and UC campuses. Follow @vsaatucsd for each year's lineup." },
  { q: 'How is the winner decided?', a: 'Schools earn points through game rounds. A combination of judge scoring and crowd energy typically determines the winner, though the exact format may vary by year.' },
  { q: 'Is the event free?', a: "WNC is typically a ticketed event. Ticket prices and availability are announced each year through VSA's Instagram and the event's page." },
  { q: "Can anyone attend?", a: "Yes — WNC is open to everyone. You don't need to be a VSA member or affiliated with a participating school to come and enjoy the show." },
];

export function WildNCulture() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { content: eventContent } = useProgramContent('wnc');
  const dynamicEventVisible = !!eventContent && !isProgramContentHidden(eventContent);
  const eventMeta = eventContent ? getProgramMetaParts(eventContent) : [];
  const eventStatusLabel = eventContent ? PROGRAM_STATUS_LABELS[eventContent.status] : '';

  return (
    <>
      <PageTitle title="Wild N' Culture" />

      <div className="program-app">
        <div className="program-breadcrumb">
          <Link to="/get-involved">Get Involved</Link>
          <span>→</span>
          <span style={{ color: 'var(--color-text2)' }}>Wild N' Culture</span>
        </div>

        <section className="program-hero">
          <div className="program-hero-grain" />
          <div className="program-hero-inner">
            <span className="program-hero-kicker">Event Flyer</span>
            <h1 className="program-title">
              Wild N' <span className="program-title-script">Culture</span>
            </h1>
            <p className="program-hero-meta">
              Annual intercollegiate comedy competition · UCSD VSA
            </p>
            {(dynamicEventVisible || (!eventContent && WNC_CONFIG.eventActive)) && (
              <div className="program-hero-actions">
                {dynamicEventVisible && eventStatusLabel && (
                  <span className="scrapbook-sticker scrapbook-sticker-coral">
                    {eventStatusLabel}{eventContent.title ? ` · ${eventContent.title}` : ''}
                  </span>
                )}
                {dynamicEventVisible && eventMeta.length > 0 && (
                  <span className="scrapbook-sticker scrapbook-sticker-gold">
                    {eventMeta.join(' · ')}
                  </span>
                )}
                {dynamicEventVisible && hasPrimaryProgramLink(eventContent) && (
                  <a
                    href={eventContent.primary_link_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vsa-btn-primary font-sans text-sm font-medium"
                  >
                    {eventContent.primary_link_label || 'Get Tickets'} →
                  </a>
                )}
                {dynamicEventVisible && eventContent.body && (
                  <span className="scrapbook-sticker">{eventContent.body}</span>
                )}
                {!eventContent && WNC_CONFIG.date && (
                  <span className="scrapbook-sticker scrapbook-sticker-gold">
                    {WNC_CONFIG.date}{WNC_CONFIG.venue ? ` · ${WNC_CONFIG.venue}` : ''}
                  </span>
                )}
                {!eventContent && WNC_CONFIG.ticketsAvailable && WNC_CONFIG.ticketLink && (
                  <a
                    href={WNC_CONFIG.ticketLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vsa-btn-primary font-sans text-sm font-medium"
                  >
                    Get Tickets →
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="program-watermark">wnc</div>
        </section>

        <section className="program-section">
          <div className="program-section-inner program-section-narrow">
            <div className="program-eyebrow">About WNC</div>
            <p className="program-body">
              Wild N' Culture is UCSD VSA's annual intercollegiate comedy competition. Inspired by Wild 'N Out, it brings together Vietnamese Student Associations and Asian American student groups from across Southern California for a night of live improv-style games, roast battles, and pure crowd energy.
            </p>
            <p className="program-body">
              WNC is more than a competition — it's a celebration of shared culture, community, and the kind of chaotic fun that only a packed auditorium can produce.
            </p>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">What to Expect</div>
            <div className="flex flex-wrap gap-2">
              {whatToExpect.map(item => (
                <span key={item} className="scrapbook-sticker">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {WNC_ARCHIVE.length > 0 && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">Past Events</div>
              <div className="program-list">
                {WNC_ARCHIVE.map((entry) => (
                  <div key={entry.year} className="program-list-row">
                    <div className="program-list-title">
                      {entry.label || `WNC ${entry.year}`}
                      {entry.date && <div className="mt-1 font-mono text-[10px] font-normal tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>{entry.date}</div>}
                    </div>
                    <div className="program-list-copy">
                      {entry.winner && (
                        <div className="mb-2 font-semibold text-brand-600 dark:text-brand-400">Winner: {entry.winner}</div>
                      )}
                      {entry.venue && <p>{entry.venue}</p>}
                      {entry.schools && entry.schools.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {entry.schools.map(s => (
                            <span key={s} className="scrapbook-sticker">{s}</span>
                          ))}
                        </div>
                      )}
                      {entry.note && <p className="mt-2 italic" style={{ color: 'var(--color-text3)' }}>{entry.note}</p>}
                      {entry.trailerUrl && (
                        <div className="program-poster-card aspect-video mt-3 max-w-[420px]">
                          <iframe src={entry.trailerUrl} title={`WNC ${entry.year} recap`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">FAQ</div>
            <div className="program-faq-card">
              {faqs.map((faq, i) => (
                <div key={i} className="program-faq-row">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="program-faq-button"
                  >
                    <span className="program-faq-question">{faq.q}</span>
                    <span className={`program-faq-plus ${openFaq === i ? 'is-open' : ''}`}>+</span>
                  </button>
                  {openFaq === i && (
                    <div className="program-faq-answer">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-footer-actions-rich">
              <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="vsa-btn-primary font-sans text-sm font-medium">
                Follow @vsaatucsd
              </a>
              <Link to="/events" className="vsa-btn-ghost font-sans text-sm">
                ← Events
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
