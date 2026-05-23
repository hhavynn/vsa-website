import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { ProgramContentCallout } from '../components/features/program/ProgramContentCallout';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../constants/houses';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { getAcademicTermMeta, formatAcademicYear } from '../lib/academicTerms';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { useLeaderboardYears } from '../hooks/useLeaderboardYears';
import { usePublishedHouseAssets } from '../hooks/useHouseAssets';
import { useProgramContent } from '../hooks/useProgramContent';
import { PROGRAM_STATUS_LABELS } from '../lib/programContent';
import { getSupabaseImageSrcSet, getSupabaseImageUrl } from '../lib/supabaseImages';
import { HousePageAsset, HouseYearlyPoints } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// HOUSE PROGRAM CONFIG — Update this section each year.
// ─────────────────────────────────────────────────────────────────────────────

const APPLICATIONS_OPEN = false;
const APPLICATION_LINK = '';
const CYCLE_LABEL = '';

interface HouseData {
  house: HouseName;
}

interface HouseParent {
  name: string;
  house: string;
  emoji: string;
  bio: string;
  photo?: string;
}

const HOUSES: HouseData[] = (['Boo', 'Bowser', 'Toad', 'Donkey Kong'] as HouseName[]).map((house) => ({ house }));

const HOUSE_PARENTS: HouseParent[] = [
  // Example — replace with actual House Parents each year:
  // { name: 'First Last', house: 'Boo', emoji: '', bio: 'Short bio here.' },
];

const steps = [
  { num: '01', title: 'Join the Program', desc: "Sign up when applications or sign-ups open each year. Check VSA's Instagram for the latest announcements." },
  { num: '02', title: 'Get Sorted', desc: 'You are placed into one of four houses. A house reveal kicks off the year and introduces you to your new community.' },
  { num: '03', title: 'Meet Your House', desc: 'Connect with your House Parents and fellow house members through socials, bonding events, and activities throughout the year.' },
  { num: '04', title: 'Earn Points & Compete', desc: "Show up, participate, and earn points for your house. The house with the most points at year's end wins a special reward." },
];

const eventTypes = [
  'House Reveal', 'Meet & Greet', 'Game Nights', 'Study Jams',
  'Beach Outings', 'Karaoke', 'House Dinners', 'DIY Activities',
  'Movie Nights', 'Inter-House Collabs', 'Competitions', 'End-of-Year Celebration',
];

const faqs = [
  { q: 'What is the House Program?', a: "The House Program is a year-long community experience within VSA. Members are placed into one of four houses and participate in socials, bonding activities, and VSA events to earn points and build friendships throughout the year." },
  { q: 'Do I need to already know people in VSA to join?', a: "Not at all. The program is specifically designed to help members meet new people and feel more connected — especially if you are newer to VSA or looking for a tighter-knit community within the organization." },
  { q: 'What kinds of events are part of the program?', a: 'Events vary by house and cycle but may include house reveals, meet-and-greets, bonding socials, study jams, beach outings, karaoke, DIY activities, movie nights, inter-house collaborations, and competitions.' },
  { q: 'What do House Parents do?', a: 'House Parents lead their house throughout the year. They plan socials and bonding activities, communicate with members, encourage participation, and help create a welcoming environment for everyone in the house.' },
  { q: 'Is there competition between houses?', a: 'Yes. Houses earn points through participation in events and activities across the year. At the end of the year, the house with the most points receives a special reward.' },
  { q: 'When do sign-ups or applications open?', a: "Sign-up timelines are announced at the start of each year through VSA's official channels. Follow @vsaatucsd on Instagram to stay up to date." },
];

function getCurrentAcademicYearStart() {
  return getAcademicTermMeta(new Date())?.academicYearStart ?? null;
}

function resolveHouseYear(terms: ReturnType<typeof useAcademicTerms>['terms']) {
  const activeTermYear = terms.find((term) => term.is_active)?.academic_year_start;
  if (activeTermYear) return activeTermYear;

  const currentYear = getCurrentAcademicYearStart();
  if (currentYear) return currentYear;

  return terms[0]?.academic_year_start ?? null;
}

function assetMapByHouse(assets: HousePageAsset[]) {
  return assets.reduce((map, asset) => {
    map.set(asset.house, asset);
    return map;
  }, new Map<string, HousePageAsset>());
}

export function House() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { terms } = useAcademicTerms();
  const { yearsWithData } = useLeaderboardYears();
  const { content: cycleContent } = useProgramContent('house');
  const [standings, setStandings] = useState<HouseYearlyPoints[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(true);
  const statusLabel = cycleContent ? PROGRAM_STATUS_LABELS[cycleContent.status] : '';

  const activeYear = resolveHouseYear(terms);
  const activeYearLabel = activeYear ? formatAcademicYear(activeYear) : '';
  const hasAnyLeaderboardData = yearsWithData.length > 0;
  const hasSelectedYearData = activeYear ? yearsWithData.includes(activeYear) : false;
  const { assets: houseAssets } = usePublishedHouseAssets(activeYear);
  const houseAssetsByName = assetMapByHouse(houseAssets);

  useEffect(() => {
    let isMounted = true;
    async function loadStandings() {
      if (!activeYear) {
        setStandingsLoading(false);
        return;
      }
      setStandingsLoading(true);
      try {
        const data = await leaderboardRepository.getYearlyHouseLeaderboard(activeYear);
        if (isMounted) setStandings(data);
      } catch {
        if (isMounted) setStandings([]);
      } finally {
        if (isMounted) setStandingsLoading(false);
      }
    }
    loadStandings();
    return () => { isMounted = false; };
  }, [activeYear]);

  return (
    <>
      <PageTitle title="House Program" />

      <div className="program-app">
        <div className="program-breadcrumb">
          <Link to="/get-involved">Get Involved</Link>
          <span>→</span>
          <span style={{ color: 'var(--color-text2)' }}>House Program</span>
        </div>

        <section className="program-hero">
          <div className="program-hero-grain" />
          <div className="program-hero-inner">
            <span className="program-hero-kicker">House Board</span>
            <h1 className="program-title">
              House <span className="program-title-script">Program</span>
            </h1>
            <p className="program-hero-meta">
              Year-long community competition inside UCSD VSA. Get sorted, meet your house, show up for events, and help your team climb the board.
            </p>
            <div className="program-hero-actions">
              {cycleContent && statusLabel && cycleContent.status !== 'hidden' && (
                <span className="scrapbook-sticker scrapbook-sticker-teal">
                  {statusLabel}{cycleContent.title ? ` · ${cycleContent.title}` : ''}
                </span>
              )}
              {!cycleContent && APPLICATIONS_OPEN && CYCLE_LABEL && (
                <span className="scrapbook-sticker scrapbook-sticker-teal">Applications Open · {CYCLE_LABEL}</span>
              )}
              {activeYearLabel && <span className="scrapbook-sticker scrapbook-sticker-gold">{activeYearLabel}</span>}
            </div>
          </div>
          <div className="program-watermark">houses</div>
        </section>

        {(cycleContent || (APPLICATIONS_OPEN && APPLICATION_LINK)) && (
          <section className="program-section">
            <div className="program-section-inner">
              {cycleContent ? (
                <ProgramContentCallout
                  content={cycleContent}
                  defaultTitle="House Program updates"
                  defaultLinkLabel="Apply Now"
                />
              ) : (
                <div className="scrapbook-note flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0 font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>Applications are now open{CYCLE_LABEL ? ` · ${CYCLE_LABEL}` : ''}</div>
                  <a href={APPLICATION_LINK} target="_blank" rel="noopener noreferrer" className="program-cta-link rounded border border-brand-600 px-4 py-2 font-sans text-sm font-medium text-brand-600 transition-colors duration-150 hover:bg-brand-600 hover:text-white dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-400 dark:hover:text-zinc-950">
                    Apply Now →
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="program-section">
          <div className="program-section-inner program-section-narrow">
            <div className="program-eyebrow">About the Program</div>
            <p className="program-body">
              The House Program is a year-long community experience within VSA. Members are placed into one of four houses and participate in socials, bonding activities, and VSA events to earn points and build friendships. At the end of the year, the house with the most points wins.
            </p>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">The Four Houses</div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {HOUSES.map(({ house }) => {
                const asset = houseAssetsByName.get(house);
                const color = HOUSE_COLORS[house];
                return (
                  <div key={house} className="program-feature-card overflow-hidden p-0" style={{ borderColor: `${color}55` }}>
                    <div
                      className="relative aspect-[4/3] overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${color}22, var(--color-surface2))` }}
                    >
                      {asset?.image_url ? (
                        <img
                          src={getSupabaseImageUrl(asset.image_url, {
                            width: 520,
                            height: 390,
                            resize: 'cover',
                            quality: 72,
                          })}
                          srcSet={getSupabaseImageSrcSet(asset.image_url, [320, 520, 720], {
                            resize: 'cover',
                            quality: 72,
                          })}
                          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                          alt={asset.image_alt || HOUSE_LABELS[house]}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <div
                            className="grid h-16 w-16 place-items-center rounded-full border font-serif text-2xl italic"
                            style={{ borderColor: `${color}66`, color, background: 'var(--color-surface)' }}
                          >
                            {house === 'Donkey Kong' ? 'DK' : house.slice(0, 2).toUpperCase()}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="program-card-title">{HOUSE_LABELS[house]}</div>
                      <div className="mt-2 h-1.5 rounded-full" style={{ background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="program-eyebrow mb-0">House Standings{activeYearLabel ? ` / ${activeYearLabel}` : ''}</div>
              <Link to="/leaderboard" className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400">
                Full Leaderboard →
              </Link>
            </div>
            <div className="program-scoreboard-card">
              {standingsLoading ? (
                <div className="py-10 text-center font-sans text-sm" style={{ color: 'var(--color-text3)' }}>Loading house standings...</div>
              ) : standings.length === 0 ? (
                <div className="scrapbook-empty mx-4 my-4 font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                  <p style={{ color: 'var(--color-text2)' }}>
                    House standings will appear after House Reveal assignments are imported.
                  </p>
                  {activeYearLabel && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                      No house points are recorded for {activeYearLabel}{hasAnyLeaderboardData && !hasSelectedYearData ? ' yet' : ''}.
                    </p>
                  )}
                </div>
              ) : (
                standings.map((standing, index) => (
                  <div key={standing.house} className="program-scoreboard-row">
                    <div className="program-rank">#{index + 1}</div>
                    <div>
                      <div className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {HOUSE_LABELS[standing.house as keyof typeof HOUSE_LABELS] ?? standing.house}
                      </div>
                      <div className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                        {standing.unique_members} contributing members · {standing.events_attended} check-ins
                      </div>
                    </div>
                    <div className="text-right font-serif" style={{ fontSize: 26, color: 'var(--color-text)' }}>
                      {standing.total_points}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <PointsExplainer />
          </div>
        </section>

        {HOUSE_PARENTS.length > 0 && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">House Parents</div>
              <div className="program-four-grid">
                {HOUSE_PARENTS.map(hp => (
                  <div key={hp.name} className="program-feature-card">
                    {hp.photo && <img src={hp.photo} alt={hp.name} className="mb-3 aspect-square w-full rounded object-cover" loading="lazy" />}
                    <div className="program-card-title">{hp.emoji ? `${hp.emoji} ` : ''}{hp.name}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>{hp.house}</div>
                    {hp.bio && <p className="program-card-copy">{hp.bio}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">How It Works</div>
            <div className="program-step-grid">
              {steps.map((step) => (
                <div key={step.num} className="program-step-card program-feature-card">
                  <div className="program-step-number mb-3 font-serif leading-none" style={{ fontSize: 34, color: 'var(--color-text3)' }}>{step.num}</div>
                  <div className="program-card-title">{step.title}</div>
                  <p className="program-card-copy">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">What You'll Do</div>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map(e => (
                <span key={e} className="scrapbook-sticker">{e}</span>
              ))}
            </div>
          </div>
        </section>

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
              <Link to="/get-involved" className="vsa-btn-ghost font-sans text-sm">
                ← All Programs
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
