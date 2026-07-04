import type { ReactNode } from "react";
import { Link } from "react-router-dom";

function WrappedNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-lg border border-border-strong px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-text-primary transition-colors duration-150 hover:bg-surface2"
    >
      {children}
    </Link>
  );
}

function WrappedStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-[var(--border)] pt-4">
      <div className="font-serif text-[34px] font-black leading-none text-text-primary sm:text-[42px]">
        {value}
      </div>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
    </div>
  );
}

function WrappedBlock({
  emoji,
  title,
  heading,
  children,
}: {
  emoji: string;
  title: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <article className="scrapbook-note border border-[var(--border)] p-5">
      <div className="text-[28px]" aria-hidden>
        {emoji}
      </div>
      <h3 className="mt-3 font-serif text-[28px] font-black leading-tight text-text-primary">
        {title}
      </h3>
      <p className="mt-2 font-sans text-[16px] font-bold leading-[1.6] text-text-primary">
        {heading}
      </p>
      <div className="mt-4 space-y-3 font-sans text-[14px] leading-[1.8] text-text-secondary">
        {children}
      </div>
    </article>
  );
}

function AwardBlock({
  emoji,
  title,
  winner,
  children,
}: {
  emoji: string;
  title: string;
  winner: string;
  children: ReactNode;
}) {
  return (
    <article className="border-t border-[var(--border)] pt-5">
      <div className="text-[26px]" aria-hidden>
        {emoji}
      </div>
      <h3 className="mt-2 font-serif text-[24px] font-black leading-tight text-text-primary">
        {title}
      </h3>
      <p className="mt-2 font-sans text-[15px] font-bold text-[var(--accent)]">
        {winner}
      </p>
      <div className="mt-3 space-y-3 font-sans text-[13.5px] leading-[1.75] text-text-secondary">
        {children}
      </div>
    </article>
  );
}

export function WrappedRecapCard() {
  const finalStandings = [
    "🥇 Bowser — 247",
    "🥈 Donkey Kong — 215",
    "🥉 Toad — 158",
    "👻 Boo — 125",
  ];

  return (
    <section className="scrapbook-board border-t border-[var(--border)]">
      <div className="vsa-container py-12 sm:py-16">
        <div className="scrapbook-paper relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <span className="scrapbook-pin" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_10%,color-mix(in_srgb,var(--brand)_14%,transparent)_0%,transparent_70%),radial-gradient(48%_42%_at_86%_18%,color-mix(in_srgb,var(--accent)_12%,transparent)_0%,transparent_72%),radial-gradient(44%_48%_at_58%_92%,color-mix(in_srgb,var(--gold-t)_10%,transparent)_0%,transparent_70%)]"
            aria-hidden
          />

          <div className="relative">
            <div className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              Year in Review
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-end">
              <div>
                <h2 className="font-serif text-[40px] font-black leading-[0.98] text-text-primary sm:text-[58px]">
                  VSA Wrapped 2025–2026
                </h2>
                <p className="mt-5 max-w-2xl font-sans text-[18px] font-bold leading-[1.7] text-text-primary">
                  One year. Four Houses. Too many side quests to count.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <WrappedNavLink to="/events">Events</WrappedNavLink>
                  <WrappedNavLink to="/gallery">Gallery</WrappedNavLink>
                  <WrappedNavLink to="/house">Houses</WrappedNavLink>
                  <WrappedNavLink to="/get-involved">
                    Get involved
                  </WrappedNavLink>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <WrappedStat value="35" label="events counted" />
                <WrappedStat value="15" label="gallery albums" />
                <WrappedStat value="247" label="Bowser points" />
              </div>
            </div>
          </div>

          <div className="relative mt-12 border-t border-[var(--border)] pt-10">
            <h2 className="font-serif text-[34px] font-black leading-tight text-text-primary">
              The year, basically
            </h2>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <WrappedBlock emoji="🎭" title="VCN" heading="Tình Yêu Thầm Lặng">
                <p>
                  Months of rehearsals, late nights, dances, acting, tech, and a
                  whole lot of people making one huge show happen.
                </p>
                <p>One stage. One story. A lot of VSA.</p>
              </WrappedBlock>

              <WrappedBlock
                emoji="🏕️"
                title="Winter Retreat"
                heading="The trip where everyone somehow came back closer"
              >
                <p>
                  Games, late-night conversations, questionable sleep schedules,
                  and the kind of bonding you cannot really recreate at a GBM.
                </p>
              </WrappedBlock>

              <WrappedBlock
                emoji="🥧"
                title="Pie-A-Cab"
                heading="Library Walk got personal"
              >
                <p>Pay a few dollars. Pick a cabinet member. Throw a pie.</p>
                <p>Simple concept. Extremely effective.</p>
              </WrappedBlock>

              <WrappedBlock
                emoji="🌎"
                title="Wild N’ Culture"
                heading="Culture, competition, and complete nonsense"
              >
                <p>
                  Games got loud. Schools got competitive. Somehow the chaos was
                  still on theme.
                </p>
                <p>Classic WNC.</p>
              </WrappedBlock>
            </div>
          </div>

          <div className="relative mt-12 border-t border-[var(--border)] pt-10">
            <div className="grid gap-8 lg:grid-cols-[0.85fr_1fr] lg:items-start">
              <div>
                <h2 className="font-serif text-[34px] font-black leading-tight text-text-primary">
                  House race
                </h2>
                <div className="mt-5 text-[30px]" aria-hidden>
                  🍄
                </div>
                <h3 className="mt-2 font-serif text-[28px] font-black leading-tight text-text-primary">
                  The Super Mario Era
                </h3>
                <div className="mt-4 space-y-3 font-sans text-[14px] leading-[1.8] text-text-secondary">
                  <p>Bowser. Donkey Kong. Toad. Boo.</p>
                  <p>Four Houses entered the year. One finished on top.</p>
                </div>
              </div>

              <div className="scrapbook-note border border-[var(--border)] p-5">
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                  Final standings
                </h3>
                <div className="mt-5 grid gap-3">
                  {finalStandings.map((standing) => (
                    <div
                      key={standing}
                      className="font-serif text-[24px] font-black leading-tight text-text-primary"
                    >
                      {standing}
                    </div>
                  ))}
                </div>
                <p className="mt-6 font-sans text-[15px] font-bold leading-[1.7] text-text-primary">
                  Bowser House takes the 2025–2026 crown.
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-12 border-t border-[var(--border)] pt-10">
            <h2 className="font-serif text-[34px] font-black leading-tight text-text-primary">
              A few things that defined the year
            </h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <AwardBlock
                emoji="🎤"
                title="Biggest Main Character Moment"
                winner="VCN"
              >
                <p>
                  The biggest production of the year, powered by members who
                  spent months turning rehearsals, meetings, costumes, dances,
                  and a script into one night on stage.
                </p>
              </AwardBlock>

              <AwardBlock
                emoji="🌪️"
                title="Most Chaotic Energy"
                winner="Wild N’ Culture"
              >
                <p>There are events you explain to your friends.</p>
                <p>Then there is WNC.</p>
              </AwardBlock>

              <AwardBlock
                emoji="🥧"
                title="Most Dangerous Place to Be Cabinet"
                winner="Pie-A-Cab"
              >
                <p>No position title could save you.</p>
              </AwardBlock>

              <AwardBlock
                emoji="🎮"
                title="Best Ongoing Rivalry"
                winner="The House race"
              >
                <p>
                  Bowser, Donkey Kong, Toad, and Boo spent the year collecting
                  points, showing up, and keeping the leaderboard interesting.
                </p>
              </AwardBlock>

              <AwardBlock
                emoji="🎉"
                title="Biggest Plot Twist"
                winner="Welcome Week Mixer"
              >
                <p>
                  Fall started differently this year with a bigger social
                  kickoff and a new spin on Welcome Week.
                </p>
              </AwardBlock>

              <AwardBlock
                emoji="🤝"
                title="Most “This Is Why We Do VSA” Moment"
                winner="The people who kept showing up"
              >
                <p>The members who came back after their first GBM.</p>
                <p>The interns who stepped up.</p>
                <p>The House Parents who built community.</p>
                <p>The performers who stayed late.</p>
                <p>The cabinet members carrying boxes.</p>
                <p>The friends who brought their friends.</p>
                <p>That was the year.</p>
              </AwardBlock>
            </div>
          </div>

          <div className="relative mt-12 border-t border-[var(--border)] pt-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1fr]">
              <div>
                <h2 className="font-serif text-[34px] font-black leading-tight text-text-primary">
                  Afterglow
                </h2>
                <h3 className="mt-3 font-serif text-[28px] font-black leading-tight text-text-primary">
                  A Night of Memories
                </h3>
              </div>
              <div className="space-y-4 font-sans text-[15px] leading-[1.85] text-text-secondary">
                <p>
                  We closed out 2025–2026 with{" "}
                  <strong className="text-text-primary">Afterglow</strong>,
                  celebrating the people, Houses, seniors, memories, and little
                  moments that made the year what it was.
                </p>
                <p>
                  To every member, intern, House Parent, performer, volunteer,
                  photographer, cabinet member, and friend who showed up:
                </p>
                <p className="font-bold text-text-primary">
                  thank you for being part of it.
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-12 border-t border-[var(--border)] pt-10">
            <h2 className="font-serif text-[34px] font-black leading-tight text-text-primary">
              One last thing
            </h2>
            <div className="mt-5 space-y-2 font-sans text-[15px] leading-[1.8] text-text-secondary">
              <p>2025–2026 gave us:</p>
              <p>🍄 a Super Mario House era</p>
              <p>🎭 another VCN story brought to life</p>
              <p>🌎 WNC chaos</p>
              <p>🏕️ retreat memories</p>
              <p>🥧 pies to the face</p>
              <p>📸 way too many photos</p>
              <p>❤️ and a lot of reasons to come back</p>
            </div>
            <p className="mt-7 font-sans text-[17px] font-bold leading-[1.7] text-text-primary">
              Same VSA. New year loading.
            </p>
            <p className="mt-2 font-sans text-[15px] leading-[1.8] text-text-secondary">
              See you in Fall.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
