import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';

// ─────────────────────────────────────────────────────────────────────────────
// EXTERNAL SHOWCASE DATA
// UCSD / Wild N' Culture is listed first as our home-hosted external.
// Order after: larger or more emphasized externals, then others.
// ─────────────────────────────────────────────────────────────────────────────

interface ExternalEntry {
  school: string;
  shortName: string;
  fullName?: string;
  event: string;
  description: string;
  points?: number;
  homeBadge?: boolean;
  hostedBadge?: boolean;
}

const EXTERNALS_2025_2026: ExternalEntry[] = [
  {
    school: 'UC San Diego',
    shortName: 'UCSD',
    event: "Wild N' Culture",
    description:
      "UCSD VSA's hosted external brings schools across SoCal together for competition, culture, performance, and community. It is one of our biggest chances to represent VSA at UCSD while welcoming the wider UVSA network to our campus.",
    points: 5,
    homeBadge: true,
    hostedBadge: true,
  },
  {
    school: 'UC Santa Barbara',
    shortName: 'UCSB',
    event: 'Pho King',
    description:
      'UCSB VSA hosts one of the most popular cooking-themed competitions in SoCal. Teams from across UVSA represent their school in a multi-round challenge that brings out creativity and a lot of crowd energy.',
    points: 4,
  },
  {
    school: 'UC Irvine',
    shortName: 'UCI',
    event: 'Rose Pageant',
    description:
      'A pageant and cultural showcase hosted by UCI VSA. Participants represent their schools through performances, interviews, and talent rounds tied to culture and community.',
    points: 4,
  },
  {
    school: 'UC Riverside',
    shortName: 'UCR',
    event: 'Viet Idol',
    description:
      'UCR VSA brings the spotlight to student performers from across the UVSA network in a singing competition inspired by the classic talent-show format with a Vietnamese cultural touch.',
    points: 4,
  },
  {
    school: 'USC',
    shortName: 'USC',
    event: 'Finding Yeu',
    description:
      'A game-show style competition hosted by USC VSA. Schools send representatives to compete in rounds that mix humor, culture, and quick thinking for their school.',
    points: 4,
  },
  {
    school: 'CSU Fullerton',
    shortName: 'CSUF',
    event: 'Get To The Point',
    description:
      'CSUF VSA hosts a fast-paced points-based competition where schools face off across multiple rounds covering trivia, performance, and crowd participation.',
    points: 4,
  },
  {
    school: 'San Diego State University',
    shortName: 'SDSU',
    event: 'Mount Jamprov',
    description:
      'An improv-focused competition hosted by SDSU VSA. Schools face off in live comedy rounds with crowd judging and a high-energy atmosphere.',
    points: 4,
  },
  {
    school: 'CSU Long Beach',
    shortName: 'CSULB',
    event: 'Long Beach Lip Sync',
    description:
      'A lip sync battle and performance night hosted by CSULB VSA. Schools choreograph and perform for a crowd that decides the winner through sheer noise.',
    points: 4,
  },
  {
    school: 'Cal Poly Pomona',
    shortName: 'CPP',
    event: 'VietWit',
    description:
      "CPP VSA's competition mixes wit, wordplay, and cultural knowledge in a fast-paced event where schools send their sharpest representatives.",
    points: 4,
  },
  {
    school: 'CSU San Marcos',
    shortName: 'CSUSM',
    event: "Gettin' Hot",
    description:
      'A high-energy competition hosted by CSUSM VSA with a mix of performance, games, and crowd interaction that keeps teams and audiences engaged throughout.',
    points: 4,
  },
  {
    school: 'Chapman University',
    shortName: 'Chapman',
    event: 'Survey Says',
    description:
      "Inspired by the classic game show format, Chapman VSA's external has schools compete in survey-style rounds with cultural themes and audience participation.",
    points: 4,
  },
  {
    school: 'CSU Northridge',
    shortName: 'CSUN',
    event: 'Cinemania',
    description:
      'A film and culture-themed competition hosted by CSUN VSA. Past editions have involved teams creating or presenting creative projects tied to Vietnamese and Asian American cinema.',
    points: 4,
  },
  {
    school: 'Cal Poly San Luis Obispo',
    shortName: 'CPSLO',
    event: 'Saigon Runway',
    description:
      'A fashion and performance show hosted by CPSLO VSA that highlights Vietnamese culture through design, movement, and student creativity.',
    points: 4,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOLS DATA
// UCSD is listed first as the home school. Rest follow regional/UVSA order.
// ─────────────────────────────────────────────────────────────────────────────

interface SchoolEntry {
  shortName: string;
  fullName: string;
  description: string;
  region: string;
  homeBadge?: boolean;
}

const UVSA_SCHOOLS: SchoolEntry[] = [
  {
    shortName: 'UCSD',
    fullName: 'UC San Diego',
    description:
      'VSA at UCSD is our home base, hosting Wild N Culture, VCN, House, ACE, retreats, and the points system that keeps members coming back.',
    region: 'San Diego',
    homeBadge: true,
  },
  {
    shortName: 'UCSB',
    fullName: 'UC Santa Barbara',
    description:
      'VSA at UCSB is one of the larger chapters in SoCal, known for Pho King and a strong community presence up the coast.',
    region: 'Santa Barbara',
  },
  {
    shortName: 'UCI',
    fullName: 'UC Irvine',
    description:
      'VSA at UCI hosts Rose Pageant and draws a large crowd from across the network each year.',
    region: 'Orange County',
  },
  {
    shortName: 'UCR',
    fullName: 'UC Riverside',
    description:
      "VSA at UCR brings the Viet Idol competition to the network and has a consistent presence at UCSD's externals.",
    region: 'Inland Empire',
  },
  {
    shortName: 'USC',
    fullName: 'USC',
    description:
      "VSA at USC hosts Finding Yeu and is one of the more active private school chapters in SoCal's UVSA circuit.",
    region: 'Los Angeles',
  },
  {
    shortName: 'CSUF',
    fullName: 'CSU Fullerton',
    description:
      'VSA at CSUF hosts Get To The Point and regularly sends strong teams to externals across the region.',
    region: 'Orange County',
  },
  {
    shortName: 'SDSU',
    fullName: 'San Diego State University',
    description:
      'VSA at SDSU is our local neighbor, hosting Mount Jamprov and trading teams with UCSD VSA throughout the year.',
    region: 'San Diego',
  },
  {
    shortName: 'CSULB',
    fullName: 'CSU Long Beach',
    description:
      'VSA at CSULB hosts Long Beach Lip Sync and is a regular presence at UCSD externals including WNC.',
    region: 'Los Angeles',
  },
  {
    shortName: 'CPP',
    fullName: 'Cal Poly Pomona',
    description:
      'VSA at CPP hosts VietWit and competes across SoCal with a chapter known for quick humor and team energy.',
    region: 'Inland Empire',
  },
  {
    shortName: 'CSUSM',
    fullName: 'CSU San Marcos',
    description:
      "VSA at CSUSM hosts Gettin' Hot and has been growing its presence in the UVSA network in recent years.",
    region: 'San Diego',
  },
  {
    shortName: 'Chapman',
    fullName: 'Chapman University',
    description:
      'VSA at Chapman hosts Survey Says and adds a smaller private-school perspective to the broader UVSA community.',
    region: 'Orange County',
  },
  {
    shortName: 'CSUN',
    fullName: 'CSU Northridge',
    description:
      'VSA at CSUN hosts Cinemania and has a chapter rooted in film and cultural programming.',
    region: 'Los Angeles',
  },
  {
    shortName: 'CPSLO',
    fullName: 'Cal Poly San Luis Obispo',
    description:
      'VSA at CPSLO hosts Saigon Runway and is the farthest chapter from San Diego, but still a consistent part of the network.',
    region: 'Central Coast',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FAQ DATA
// ─────────────────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: 'What is UVSA?',
    a: 'UVSA (Union of Vietnamese Student Associations) is the regional network that connects Vietnamese Student Associations across Southern California. It coordinates externals, facilitates cross-campus relationships, and helps VSA chapters support each other throughout the year.',
  },
  {
    q: 'What is an external?',
    a: 'An external is an intercollegiate event hosted by a VSA chapter where students from other schools come to participate or compete. Externals can look like pageants, game shows, talent competitions, showcases, or performance nights, but they are also a way for schools to support each other philanthropy projects and cultural programming.',
  },
  {
    q: 'Do I earn points for attending externals?',
    a: "Yes. Attending an external earns 4 points by default, which count toward your place on the UCSD VSA leaderboard and your house's total. Wild N' Culture may be worth 5 points because it is a major UCSD-hosted event. Cabinet members and interns do not earn leaderboard points for required work duties at these events.",
  },
  {
    q: 'Can anyone go to an external?',
    a: 'Usually yes, though some externals require registration in advance or have limited spots for participants. WNC and most others are open to general attendees who just want to watch. Check each school VSA Instagram for details closer to their event date.',
  },
  {
    q: "How do I find out when externals are happening?",
    a: "External dates are announced through VSA Instagram pages and shared in the UCSD VSA community. Keep an eye on @vsaatucsd and the UCSD VSA Events page for updates on upcoming externals and whether UCSD is sending a team.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function UVSANetwork() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageTitle title="SoCal VSA Network" />

      <div className="program-app">

        {/* Hero */}
        <section className="program-hero">
          <div className="program-hero-grain" />
          <div className="program-hero-inner">
            <span className="program-hero-kicker">UVSA SoCal</span>
            <h1 className="program-title">
              SoCal VSA <span className="program-title-script">Network</span>
            </h1>
            <p className="program-hero-meta">
              13 schools. One community. UCSD VSA is part of a broader network of Vietnamese Student Associations across Southern California.
            </p>
            <div className="program-hero-actions">
              <span className="scrapbook-sticker scrapbook-sticker-coral">Home Base: UCSD</span>
              <span className="scrapbook-sticker scrapbook-sticker-teal">13 Schools</span>
              <span className="scrapbook-sticker scrapbook-sticker-gold">UVSA SoCal</span>
            </div>
          </div>
          <div className="program-watermark">uvsa</div>
        </section>

        {/* UVSA 101 */}
        <section className="program-section">
          <div className="program-section-inner program-section-narrow">
            <div className="program-eyebrow">UVSA 101</div>
            <p className="program-body">
              UVSA (Union of Vietnamese Student Associations) is the regional network connecting Vietnamese Student Associations across Southern California. UCSD VSA is one of 13 member schools, each hosting its own events and sending representatives to externals throughout the year.
            </p>
            <p className="program-body">
              The network exists to help chapters support each other, share cultural programming, and build lasting community across campuses. Externals are the most visible part of that connection.
            </p>
            <p className="program-body">
              Many externals are also tied to philanthropy, culture, or community causes. Some feel like big competitions or showcases, but they still help connect schools and support the values behind UVSA.
            </p>
          </div>
        </section>

        {/* What Are Externals */}
        <section className="program-section">
          <div className="program-section-inner program-section-narrow">
            <div className="program-eyebrow">What Are Externals</div>
            <p className="program-body">
              Externals can look like pageants, game shows, talent competitions, showcases, or performance nights, but they are also a way for schools to support each other philanthropy projects and cultural programming. UCSD VSA sends teams to externals hosted by other schools and hosts our own each year through Wild N Culture.
            </p>
            <p className="program-body">
              Attending an external earns you points on the UCSD VSA leaderboard. Most externals are worth 4 points. Wild N Culture is worth 5 because it is our own hosted event and one of the bigger nights of the year.
            </p>
          </div>
        </section>

        {/* 2025-2026 External Showcase */}
        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">2025-2026 External Showcase</div>
            <p className="mb-6 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
              Each school in the UVSA SoCal network hosts its own external during the academic year. UCSD VSA attends many of these and may send a competing team. UCSD hosts Wild N Culture, listed first as our home event.
            </p>

            <div className="space-y-4">
              {EXTERNALS_2025_2026.map((ext) => (
                <div
                  key={ext.shortName}
                  className="program-feature-card"
                  style={ext.homeBadge ? { borderColor: 'var(--brand)', borderWidth: 2 } : undefined}
                >
                  {/* Header row */}
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text3)' }}>
                      {ext.shortName}
                    </span>
                    {ext.hostedBadge && (
                      <span className="scrapbook-sticker scrapbook-sticker-coral px-2 py-0.5 text-[9px]">
                        Hosted by VSA at UCSD
                      </span>
                    )}
                    {ext.homeBadge && !ext.hostedBadge && (
                      <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">
                        Home Base
                      </span>
                    )}
                    {ext.points && (
                      <span className="scrapbook-sticker scrapbook-sticker-gold px-2 py-0.5 text-[9px]">
                        {ext.points} pts
                      </span>
                    )}
                  </div>

                  {/* Event name */}
                  <div className="program-card-title mb-1">{ext.event}</div>
                  <div className="font-sans text-[11px] mb-2" style={{ color: 'var(--color-text3)' }}>
                    {ext.fullName ?? ext.school}
                  </div>

                  {/* Description */}
                  <p className="program-card-copy">{ext.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Explore the 13 Schools */}
        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">Explore the 13 Schools</div>
            <p className="mb-6 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
              UCSD is our home base. The other 12 schools make up the rest of the UVSA SoCal network. Each has its own culture, events, and community worth knowing.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {UVSA_SCHOOLS.map((school) => (
                <div
                  key={school.shortName}
                  className="program-feature-card"
                  style={school.homeBadge ? { borderColor: 'var(--brand)', borderWidth: 2 } : undefined}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-[11px] font-black" style={{ color: 'var(--color-text)' }}>
                      {school.shortName}
                    </span>
                    {school.homeBadge && (
                      <span className="scrapbook-sticker scrapbook-sticker-coral px-2 py-0.5 text-[9px]">
                        Home Base
                      </span>
                    )}
                    <span className="font-mono text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                      {school.region}
                    </span>
                  </div>
                  <div className="font-sans text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text2)' }}>
                    {school.fullName}
                  </div>
                  <p className="font-sans text-[12px] leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                    {school.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* External Points Explainer */}
        <section className="program-section">
          <div className="program-section-inner program-section-narrow">
            <div className="program-eyebrow">External Points</div>
            <div className="scrapbook-note p-5 space-y-3">
              <p className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                How externals count toward your leaderboard
              </p>
              <ul className="space-y-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                <li>
                  Attending any UVSA external earns <strong>4 points</strong> on the UCSD VSA leaderboard by default.
                </li>
                <li>
                  Wild N Culture earns <strong>5 points</strong> because it is a major UCSD-hosted event and one of the biggest nights of the year.
                </li>
                <li>
                  Cabinet members and interns do not earn leaderboard points for required work duties at these events. Attendance as a general member still counts.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
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
                    <div className="program-faq-answer">{faq.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-footer-actions-rich">
              <Link to="/wild-n-culture" className="vsa-btn-primary font-sans text-sm font-medium">
                Wild N Culture Info
              </Link>
              <Link to="/events" className="vsa-btn-ghost font-sans text-sm">
                See All Events
              </Link>
              <Link to="/get-involved" className="vsa-btn-ghost font-sans text-sm">
                All Programs
              </Link>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
