import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
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

      <div className="program-page-header border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Link to="/get-involved" className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>Get Involved</Link>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>→</span>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text2)' }}>House Program</span>
        </div>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>House Program</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>
          Year-long community competition · UCSD VSA
          {cycleContent && statusLabel && cycleContent.status !== 'hidden' && (
            <span className="ml-3 font-sans text-[11px] font-semibold text-brand-600 dark:text-brand-400">
              {statusLabel}{cycleContent.title ? ` · ${cycleContent.title}` : ''}
            </span>
          )}
          {!cycleContent && APPLICATIONS_OPEN && CYCLE_LABEL && <span className="ml-3 font-sans text-[11px] font-semibold text-brand-600 dark:text-brand-400">Applications Open · {CYCLE_LABEL}</span>}
        </p>
      </div>

      <div className="program-page-content">

        {/* CTA */}
        {cycleContent ? (
          <ProgramContentCallout
            content={cycleContent}
            defaultTitle="House Program updates"
            defaultLinkLabel="Apply Now"
          />
        ) : APPLICATIONS_OPEN && APPLICATION_LINK && (
          <div className="mb-8 flex flex-col gap-4 rounded border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="min-w-0 font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>Applications are now open{CYCLE_LABEL ? ` · ${CYCLE_LABEL}` : ''}</div>
            <a href={APPLICATION_LINK} target="_blank" rel="noopener noreferrer" className="program-cta-link rounded border border-brand-600 px-4 py-2 font-sans text-sm font-medium text-brand-600 transition-colors duration-150 hover:bg-brand-600 hover:text-white dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-400 dark:hover:text-zinc-950">
              Apply Now →
            </a>
          </div>
        )}

        {/* About */}
        <div className="mb-10">
          <Label className="mb-4">About the Program</Label>
          <p className="font-sans text-sm leading-[1.75]" style={{ color: 'var(--color-text2)', maxWidth: 640 }}>
            The House Program is a year-long community experience within VSA. Members are placed into one of four houses and participate in socials, bonding activities, and VSA events to earn points and build friendships. At the end of the year, the house with the most points wins.
          </p>
        </div>

        {/* The Four Houses */}
        <div className="mb-10">
          <Label className="mb-4">The Four Houses</Label>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {HOUSES.map(({ house }) => {
              const asset = houseAssetsByName.get(house);
              const color = HOUSE_COLORS[house];
              return (
              <div
                key={house}
                className="overflow-hidden rounded border"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
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
                        className="grid h-16 w-16 place-items-center rounded-full border font-serif text-2xl"
                        style={{ borderColor: `${color}66`, color, background: 'var(--color-surface)' }}
                      >
                        {house === 'Donkey Kong' ? 'DK' : house.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div>
                    <div className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {HOUSE_LABELS[house]}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Standings */}
        <div className="mb-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Label>House Standings{activeYearLabel ? ` / ${activeYearLabel}` : ''}</Label>
            <Link to="/leaderboard" className="font-sans text-xs font-medium text-brand-600 dark:text-brand-400">
              Full Leaderboard
            </Link>
          </div>
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            {standingsLoading ? (
              <div className="py-10 text-center font-sans text-sm" style={{ color: 'var(--color-text3)' }}>Loading house standings...</div>
            ) : standings.length === 0 ? (
              <div className="px-5 py-10 text-center font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
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
                <div key={standing.house} className="program-standing-row grid items-center gap-3 border-b px-4 py-4 last:border-b-0 sm:gap-4 sm:px-5" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="font-serif leading-none" style={{ fontSize: 28, color: index < 3 ? 'var(--color-text)' : 'var(--color-text3)' }}>#{index + 1}</div>
                  <div>
                    <div className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {HOUSE_LABELS[standing.house as keyof typeof HOUSE_LABELS] ?? standing.house}
                    </div>
                    <div className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                      {standing.unique_members} contributing members / {standing.events_attended} check-ins
                    </div>
                  </div>
                  <div className="text-right font-serif" style={{ fontSize: 24, color: 'var(--color-text)' }}>
                    {standing.total_points}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* House Parents */}
        {HOUSE_PARENTS.length > 0 && (
          <div className="mb-10">
            <Label className="mb-4">House Parents</Label>
            <div className="program-four-grid">
              {HOUSE_PARENTS.map(hp => (
                <div key={hp.name} className="border-t py-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{hp.name}</div>
                  <div className="font-sans text-[11px] mt-0.5" style={{ color: 'var(--color-text3)' }}>{hp.house}</div>
                  {hp.bio && <p className="font-sans text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--color-text2)' }}>{hp.bio}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="mb-10">
          <Label className="mb-4">How It Works</Label>
          <div className="program-step-grid">
            {steps.map((step) => (
              <div key={step.num} className="program-step-card border-l px-5 pb-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="program-step-number mb-3 font-serif leading-none" style={{ fontSize: 32, color: 'var(--color-text3)' }}>{step.num}</div>
                <div className="font-sans text-sm font-semibold mb-1.5" style={{ color: 'var(--color-text)' }}>{step.title}</div>
                <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Events */}
        <div className="mb-10">
          <Label className="mb-4">What You'll Do</Label>
          <div className="flex flex-wrap gap-2">
            {eventTypes.map(e => (
              <span key={e} className="font-sans text-xs border rounded-sm px-3 py-1.5" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>{e}</span>
            ))}
          </div>
        </div>

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
                  <span className="min-w-0 font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>{faq.q}</span>
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

        <div className="program-footer-actions border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
          <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="font-sans text-sm font-medium px-4 py-2 rounded" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}>
            Follow @vsaatucsd
          </a>
          <Link to="/get-involved" className="font-sans text-sm px-4 py-2 rounded border" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}>
            ← All Programs
          </Link>
        </div>

      </div>
    </>
  );
}
