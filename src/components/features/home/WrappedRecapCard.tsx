import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { VietnameseText } from "../../common/VietnameseText";
import { CURRENT_WRAPPED_YEAR_LABEL as EDITION } from "../../../data/wrappedEdition";

type Tone = "teal" | "coral" | "gold";

const STICKER_CLASS: Record<Tone, string> = {
  teal: "scrapbook-sticker-teal",
  coral: "scrapbook-sticker-coral",
  gold: "scrapbook-sticker-gold",
};

const TAPE_CLASS: Record<Tone, string> = {
  teal: "scrapbook-tape-teal",
  coral: "scrapbook-tape-coral",
  gold: "scrapbook-tape-gold",
};

function GhostNumber({ value }: { value: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-0 top-2 select-none font-serif text-[96px] font-black leading-none text-text-primary opacity-[0.06] sm:text-[150px]"
    >
      {value}
    </span>
  );
}

function ChapterHeader({
  tone,
  badge,
  heading,
  lead,
}: {
  tone: Tone;
  badge: string;
  heading: string;
  lead?: string;
}) {
  return (
    <>
      <span className={`scrapbook-sticker ${STICKER_CLASS[tone]}`}>{badge}</span>
      <h2 className="mt-4 font-serif text-[32px] font-black leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[40px]">
        {heading}
      </h2>
      {lead && (
        <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8] text-text-secondary">{lead}</p>
      )}
    </>
  );
}

function WrappedNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex touch:min-h-11 items-center justify-center rounded-full border border-border-strong bg-surface2 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-text-secondary transition-colors duration-150 hover:border-[var(--brand)] hover:bg-[var(--glow)] hover:text-[var(--brand)]"
    >
      {children}
    </Link>
  );
}

function StatPaper({ value, label, rotate }: { value: string; label: string; rotate: number }) {
  return (
    <div className="scrapbook-paper scrapbook-tape-teal relative p-5" style={{ transform: `rotate(${rotate}deg)` }}>
      <span
        aria-hidden
        className="scrapbook-pin"
        style={{ left: "24px", top: "-8px", transform: "none" }}
      />
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary">
        {label}
      </div>
      <div className="mt-1 font-serif text-[42px] font-black leading-none tracking-[-0.02em] text-[var(--brand)]">
        {value}
      </div>
    </div>
  );
}

interface YearBlock {
  emoji: string;
  title: string;
  heading: ReactNode;
  blurb: string;
  tone: Tone;
  rotate: number;
}

const YEAR_BLOCKS: YearBlock[] = [
  {
    emoji: "🎭",
    title: "VCN",
    heading: <VietnameseText>Tình Yêu Thầm Lặng</VietnameseText>,
    blurb: "Months of rehearsals and late nights for one night on stage.",
    tone: "teal",
    rotate: -0.9,
  },
  {
    emoji: "🏕️",
    title: "Winter Retreat",
    heading: "The trip where everyone came back closer",
    blurb: "Games, late-night talks, and very questionable sleep schedules.",
    tone: "coral",
    rotate: 0.9,
  },
  {
    emoji: "🌱",
    title: "ACE Reveal",
    heading: "Everyone found their fam",
    blurb: "Bigs revealed, hugs happened, and new ACE lines were born.",
    tone: "gold",
    rotate: 0.7,
  },
  {
    emoji: "🌎",
    title: "Wild N’ Culture",
    heading: "Culture and competition got loud",
    blurb: "Schools got competitive, and the chaos stayed mostly on theme.",
    tone: "teal",
    rotate: -0.7,
  },
];

function YearBlockCard({ block }: { block: YearBlock }) {
  return (
    <article
      className={`scrapbook-paper ${TAPE_CLASS[block.tone]} h-full p-6`}
      style={{ transform: `rotate(${block.rotate}deg)` }}
    >
      <div className="text-[30px] leading-none" aria-hidden>
        {block.emoji}
      </div>
      <h3 className="mt-4 font-serif text-[26px] font-black leading-[1.1] tracking-[-0.01em] text-text-primary">
        {block.title}
      </h3>
      <p className="mt-2.5 font-sans text-[16px] font-bold leading-[1.5] text-text-primary">{block.heading}</p>
      <p className="mt-3.5 font-sans text-[14px] leading-[1.75] text-text-secondary">{block.blurb}</p>
    </article>
  );
}

interface Award {
  emoji: string;
  title: string;
  winner: string;
  blurb: string;
  tone: Tone;
  rotate: number;
}

const AWARDS: Award[] = [
  {
    emoji: "🎤",
    title: "Biggest Main Character Moment",
    winner: "VCN",
    blurb: "Months of work turned into one night on stage.",
    tone: "coral",
    rotate: -0.8,
  },
  {
    emoji: "🌪️",
    title: "Most Chaotic Energy",
    winner: "Wild N’ Culture",
    blurb: "Loud and mostly on purpose.",
    tone: "teal",
    rotate: 0.7,
  },
  {
    emoji: "🥧",
    title: "Most Dangerous Place to Be Cabinet",
    winner: "Pie-A-Cab",
    blurb: "No title helped.",
    tone: "gold",
    rotate: -0.6,
  },
  {
    emoji: "🎮",
    title: "Best Ongoing Rivalry",
    winner: "The House race",
    blurb: "The leaderboard stayed worth checking all year.",
    tone: "teal",
    rotate: 0.8,
  },
  {
    emoji: "🎉",
    title: "Biggest Plot Twist",
    winner: "Welcome Week Mixer",
    blurb: "Welcome Week started with a bigger social kickoff.",
    tone: "gold",
    rotate: -0.7,
  },
  {
    emoji: "🤝",
    title: "Most “This Is Why We Do VSA” Moment",
    winner: "The people who kept showing up",
    blurb: "People kept coming back and bringing friends with them.",
    tone: "coral",
    rotate: 0.6,
  },
];

function AwardCard({ award }: { award: Award }) {
  return (
    <article
      className={`scrapbook-paper ${TAPE_CLASS[award.tone]} h-full p-5`}
      style={{ transform: `rotate(${award.rotate}deg)` }}
    >
      <div className="text-[26px] leading-none" aria-hidden>
        {award.emoji}
      </div>
      <h3 className="mt-3 font-serif text-[22px] font-black leading-[1.15] tracking-[-0.01em] text-text-primary">
        {award.title}
      </h3>
      <p className="mt-2 font-sans text-[14px] font-bold leading-[1.4] text-[color:var(--color-accent-text)]">{award.winner}</p>
      <p className="mt-3 font-sans text-[13.5px] leading-[1.7] text-text-secondary">{award.blurb}</p>
    </article>
  );
}

const LAST_THINGS: { emoji: string; text: string }[] = [
  { emoji: "🍄", text: "Mario Houses" },
  { emoji: "🎭", text: "VCN" },
  { emoji: "🌎", text: "WNC" },
  { emoji: "🏕️", text: "retreat" },
  { emoji: "🥧", text: "pies" },
  { emoji: "📸", text: "photos" },
  { emoji: "❤️", text: "reasons to come back" },
]

export function WrappedRecapCard() {
  return (
    <section id="wrapped" className="scrapbook-board scroll-mt-24 border-t border-[var(--border)]">
      <div className="vsa-container py-12 sm:py-16">
        {/* Hero */}
        <div className="grid gap-9 lg:grid-cols-[1fr_minmax(0,360px)] lg:items-end">
          <div>
            <span className="scrapbook-sticker scrapbook-sticker-coral">🎁 Year in Review</span>
            <h2 className="mt-5 font-serif text-[42px] font-black leading-[0.98] tracking-[-0.02em] text-text-primary sm:text-[58px]">
              VSA Wrapped {EDITION}
            </h2>
            <p className="mt-5 max-w-2xl font-sans text-[18px] font-bold leading-[1.7] text-text-primary">
              A quick look back at {EDITION} — the year, the chaos, and everyone who kept showing up.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <WrappedNavLink to="/events">Events</WrappedNavLink>
              <WrappedNavLink to="/gallery">Gallery</WrappedNavLink>
              <WrappedNavLink to="/house">Houses</WrappedNavLink>
              <WrappedNavLink to="/get-involved">Get involved</WrappedNavLink>
            </div>
          </div>

          <div className="grid gap-4">
            <StatPaper value="35" label="events counted" rotate={-1.1} />
            <StatPaper value="15" label="gallery albums" rotate={0.8} />
            <StatPaper value="4" label="House communities" rotate={-0.6} />
          </div>
        </div>

        {/* Chapter One — The year, basically */}
        <section className="relative mt-[72px] border-t border-dashed border-[var(--border2)] pt-11">
          <GhostNumber value="01" />
          <ChapterHeader tone="teal" badge="Chapter One" heading="The year, basically" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {YEAR_BLOCKS.map((block) => (
              <YearBlockCard key={block.title} block={block} />
            ))}
          </div>
        </section>

        {/* Chapter Two — House race */}
        <section className="relative mt-[72px] border-t border-dashed border-[var(--border2)] pt-11">
          <GhostNumber value="02" />
          <span className="scrapbook-sticker scrapbook-sticker-gold">Chapter Two · House Race</span>
          <div className="mt-6 grid gap-9 lg:grid-cols-[0.85fr_1fr] lg:items-start">
            <div>
              <div className="text-[34px] leading-none" aria-hidden>
                🍄
              </div>
              <h2 className="mt-3.5 font-serif text-[32px] font-black leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[40px]">
                The Super Mario Era
              </h2>
              <p className="mt-4 max-w-sm font-sans text-[15px] leading-[1.8] text-text-secondary">
                Four houses, one leaderboard, and a race that stayed worth checking all year long.
              </p>
              <p className="mt-4 font-sans text-[15px] font-bold leading-[1.7] text-text-primary">
                Official House standings are announced at GBMs, not published on the website.
              </p>
            </div>

            <div className="scrapbook-paper scrapbook-tape-teal p-6">
              <p className="font-serif text-2xl font-bold text-text-primary">Four Houses. One community.</p>
              <p className="mt-3 font-sans text-sm leading-relaxed text-text-secondary">
                Catch the official standings announcements at VSA general body meetings.
              </p>
            </div>
          </div>
        </section>

        {/* Chapter Three — Superlatives */}
        <section className="relative mt-[72px] border-t border-dashed border-[var(--border2)] pt-11">
          <GhostNumber value="03" />
          <ChapterHeader
            tone="coral"
            badge="Chapter Three · Superlatives"
            heading="A few things that defined the year"
          />
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {AWARDS.map((award) => (
              <AwardCard key={award.title} award={award} />
            ))}
          </div>
        </section>

        {/* Chapter Four — Afterglow */}
        <section className="relative mt-[72px] border-t border-dashed border-[var(--border2)] pt-11">
          <GhostNumber value="04" />
          <div className="grid gap-9 lg:grid-cols-[0.9fr_1fr] lg:items-start">
            <div>
              <span className="scrapbook-sticker scrapbook-sticker-teal">Chapter Four · Afterglow</span>
              <h2 className="mt-4 font-serif text-[32px] font-black leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[40px]">
                A Night of Memories
              </h2>
            </div>
            <div className="scrapbook-note p-6" style={{ transform: "rotate(-0.7deg)" }}>
              <p className="font-sans text-[15.5px] leading-[1.85] text-text-secondary">
                We closed out {EDITION} with{" "}
                <strong className="font-bold text-text-primary">Afterglow</strong> and a whole lot of people to
                celebrate.
              </p>
              <p className="mt-3.5 font-sans text-[15.5px] leading-[1.85] text-text-secondary">
                To everyone who showed up:
              </p>
              <p className="mt-3.5 font-serif text-[24px] font-black leading-[1.15] text-text-primary">
                thank you for being part of it.
              </p>
            </div>
          </div>
        </section>

        {/* Chapter Five — One last thing */}
        <section className="relative mt-[72px] border-t border-dashed border-[var(--border2)] pt-11">
          <GhostNumber value="05" />
          <ChapterHeader tone="gold" badge="Chapter Five · One Last Thing" heading={`${EDITION} gave us`} />
          <div className="mt-6 flex flex-wrap gap-3">
            {LAST_THINGS.map((item) => (
              <span
                key={item.text}
                className="inline-flex items-center gap-2 rounded-full border py-2 pl-3 pr-4 font-sans text-[14px] font-semibold text-text-primary"
                style={{
                  borderColor: "var(--paper-edge)",
                  background: "var(--surface)",
                  boxShadow: "var(--paper-shadow)",
                }}
              >
                <span className="text-[17px] leading-none" aria-hidden>
                  {item.emoji}
                </span>
                {item.text}
              </span>
            ))}
          </div>
          <p className="mt-9 font-serif text-[26px] font-black leading-[1.2] text-text-primary">
            Same VSA. New year loading.
          </p>
          <p className="mt-2.5 font-sans text-[15px] leading-[1.8] text-text-secondary">See you in Fall. 🌱</p>
        </section>
      </div>
    </section>
  );
}
