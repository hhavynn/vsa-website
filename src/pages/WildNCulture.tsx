import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';

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

  return (
    <>
      <PageTitle title="Wild N' Culture" />

      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>Wild N' Culture</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>
          Annual intercollegiate comedy competition · UCSD VSA
        </p>
        {WNC_CONFIG.eventActive && (
          <div className="flex items-center gap-3 mt-4">
            {WNC_CONFIG.date && (
              <span className="font-mono text-[11px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                {WNC_CONFIG.date}{WNC_CONFIG.venue ? ` · ${WNC_CONFIG.venue}` : ''}
              </span>
            )}
            {WNC_CONFIG.ticketsAvailable && WNC_CONFIG.ticketLink && (
              <a
                href={WNC_CONFIG.ticketLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans text-sm font-medium px-4 py-2 rounded"
                style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}
              >
                Get Tickets →
              </a>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '40px 52px' }}>

        {/* About */}
        <div className="mb-10">
          <Label className="mb-4">About WNC</Label>
          <p className="font-sans text-sm leading-[1.75]" style={{ color: 'var(--color-text2)', maxWidth: 640 }}>
            Wild N' Culture is UCSD VSA's annual intercollegiate comedy competition. Inspired by Wild 'N Out, it brings together Vietnamese Student Associations and Asian American student groups from across Southern California for a night of live improv-style games, roast battles, and pure crowd energy.
          </p>
          <p className="font-sans text-sm leading-[1.75] mt-3" style={{ color: 'var(--color-text2)', maxWidth: 640 }}>
            WNC is more than a competition — it's a celebration of shared culture, community, and the kind of chaotic fun that only a packed auditorium can produce.
          </p>
        </div>

        {/* What to Expect */}
        <div className="mb-10">
          <Label className="mb-4">What to Expect</Label>
          <div className="flex flex-wrap gap-2">
            {whatToExpect.map(item => (
              <span
                key={item}
                className="font-sans text-xs border rounded-sm px-3 py-1.5"
                style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Past highlights */}
        {WNC_ARCHIVE.length > 0 && (
          <div className="mb-10">
            <Label className="mb-4">Past Events</Label>
            <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
              {WNC_ARCHIVE.map((entry) => (
                <div key={entry.year} className="border-b last:border-b-0" style={{ background: 'var(--color-surface)' }}>
                  <div style={{ padding: '16px 20px' }}>
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline gap-3">
                        <span className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{entry.label || `WNC ${entry.year}`}</span>
                        {entry.date && <span className="font-mono text-[10px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>{entry.date}</span>}
                      </div>
                      {entry.winner && (
                        <span className="font-sans text-xs font-medium text-brand-600 dark:text-brand-400">Winner: {entry.winner}</span>
                      )}
                    </div>
                    {entry.venue && <p className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>{entry.venue}</p>}
                    {entry.schools && entry.schools.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {entry.schools.map(s => (
                          <span key={s} className="font-sans text-[11px] border rounded-sm px-2 py-0.5" style={{ color: 'var(--color-text3)', borderColor: 'var(--color-border)' }}>{s}</span>
                        ))}
                      </div>
                    )}
                    {entry.note && <p className="font-sans text-xs italic mt-2" style={{ color: 'var(--color-text3)' }}>{entry.note}</p>}
                    {entry.trailerUrl && (
                      <div className="border rounded overflow-hidden aspect-video mt-3" style={{ borderColor: 'var(--color-border)', maxWidth: 400 }}>
                        <iframe src={entry.trailerUrl} title={`WNC ${entry.year} recap`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="mb-10">
          <Label className="mb-4">FAQ</Label>
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {faqs.map((faq, i) => (
              <div key={i} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between text-left"
                  style={{ padding: '14px 20px', background: 'var(--color-surface)', border: 'none', cursor: 'pointer' }}
                >
                  <span className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>{faq.q}</span>
                  <span style={{ color: 'var(--color-text3)', transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block', fontSize: 18, marginLeft: 16, flexShrink: 0 }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="border-t" style={{ padding: '12px 20px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                    <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6 flex gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="font-sans text-sm font-medium px-4 py-2 rounded" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}>
            Follow @vsaatucsd
          </a>
          <Link to="/events" className="font-sans text-sm px-4 py-2 rounded border" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}>
            ← Events
          </Link>
        </div>

      </div>
    </>
  );
}
