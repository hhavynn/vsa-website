import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { CabinetSkeleton } from '../components/common/PageSkeletons';
import { useCabinetYears } from '../hooks/useCabinetYears';
import { useCabinetMemberYearIds, useCabinetMembers } from '../hooks/useCabinet';
import { formatCabinetYearRange, getCurrentCabinetYear } from '../lib/cabinetYears';
import { CabinetYear } from '../types';
import { CabinetBoard } from '../components/features/cabinet/CabinetBoard';
import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';
import { ApplicationCTA } from '../components/common/ApplicationCTA';
import { CabinetRoleExplorer } from '../components/features/cabinet/CabinetRoleExplorer';
import { useCabinetRoles } from '../hooks/useCabinetRoles';
import { CabinetRoleModal } from '../components/features/cabinet/CabinetRoleModal';
import { matchCabinetRole } from '../utils/matchCabinetRole';

function normalizeCabinetYearQuery(value: string | null | undefined) {
  if (!value) return '';
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
  const range = normalized.match(/\b(\d{4})\s*-\s*(\d{4})\b/);
  if (range) return `${range[1]}-${range[2]}`;
  return normalized.replace(/\s*cabinet\s*/g, '').trim();
}

function cabinetYearQueryValue(year: CabinetYear) {
  const slug = normalizeCabinetYearQuery(year.slug);
  if (slug) return slug;
  return `${year.start_year}-${year.end_year}`;
}

function cabinetYearMatchesQuery(year: CabinetYear, query: string) {
  const normalizedQuery = normalizeCabinetYearQuery(query);
  if (!normalizedQuery) return false;
  return [
    cabinetYearQueryValue(year),
    year.slug,
    year.label,
    `${year.start_year}-${year.end_year}`,
  ].some((value) => normalizeCabinetYearQuery(value) === normalizedQuery);
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="scrapbook-score px-4 py-4">
      <p
        className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--color-text3)' }}
      >
        {label}
      </p>
      <p className="font-serif text-3xl leading-none" style={{ color: 'var(--color-text)' }}>
        {value}
      </p>
    </div>
  );
}


export function Cabinet() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedYear = searchParams.get('year')?.trim() || null;
  const { cabinetYears, loading: loadingCabinetYears } = useCabinetYears();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [activeRoleName, setActiveRoleName] = useState<string | null>(null);

  const { data: roles = [] } = useCabinetRoles();
  // Resolve the clicked member title to a role via tolerant matching
  // (handles Co-chair prefixes, ampersands, acronyms, and admin-set aliases).
  const activeRole = matchCabinetRole(roles, activeRoleName);

  const { data: yearIdsData, isLoading: loadingYearIds } = useCabinetMemberYearIds();
  const hasLegacyMembers = yearIdsData?.hasLegacyMembers ?? false;

  const cabinetYearsWithMembers = useMemo(
    () => cabinetYears.filter((year) => yearIdsData?.yearIds?.includes(year.id) ?? false),
    [cabinetYears, yearIdsData]
  );
  const currentCabinetYear =
    cabinetYears.find((year) => year.is_active) ??
    cabinetYearsWithMembers[0] ??
    getCurrentCabinetYear(cabinetYears);
  const publicCabinetYears = useMemo(
    () => {
      const visibleYearIds = new Set(cabinetYearsWithMembers.map((year) => year.id));
      if (currentCabinetYear) visibleYearIds.add(currentCabinetYear.id);
      if (hasLegacyMembers && currentCabinetYear) visibleYearIds.add(currentCabinetYear.id);
      return cabinetYears.filter((year) => visibleYearIds.has(year.id));
    },
    [cabinetYears, cabinetYearsWithMembers, currentCabinetYear, hasLegacyMembers]
  );

  const requestedCabinetYear = useMemo(() => {
    if (!requestedYear || normalizeCabinetYearQuery(requestedYear) === 'current') return null;
    return publicCabinetYears.find((year) => cabinetYearMatchesQuery(year, requestedYear)) ?? null;
  }, [publicCabinetYears, requestedYear]);

  const isCurrentYearQuery = !!requestedYear && normalizeCabinetYearQuery(requestedYear) === 'current';
  const isInvalidYearQuery =
    !!requestedYear &&
    !isCurrentYearQuery &&
    !requestedCabinetYear &&
    !loadingCabinetYears;
  const isResolvingYearQuery =
    !!requestedYear &&
    !isCurrentYearQuery &&
    !requestedCabinetYear &&
    loadingCabinetYears;

  const effectiveCabinetYearId =
    isInvalidYearQuery || isResolvingYearQuery
      ? null
      : requestedCabinetYear?.id ?? currentCabinetYear?.id ?? publicCabinetYears[0]?.id ?? null;
  const selectedCabinetYear =
    isInvalidYearQuery || isResolvingYearQuery
      ? null
      : publicCabinetYears.find((year) => year.id === effectiveCabinetYearId) ?? currentCabinetYear ?? publicCabinetYears[0] ?? null;
  const shouldIncludeLegacyMembers = !!effectiveCabinetYearId && currentCabinetYear?.id === effectiveCabinetYearId;

  useEffect(() => {
    if (!requestedYear || !currentCabinetYear) return;
    const matchedYear = isCurrentYearQuery
      ? currentCabinetYear
      : publicCabinetYears.find((year) => cabinetYearMatchesQuery(year, requestedYear));

    if (matchedYear?.id !== currentCabinetYear.id) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('year');
    setSearchParams(nextParams, { replace: true });
  }, [currentCabinetYear, isCurrentYearQuery, publicCabinetYears, requestedYear, searchParams, setSearchParams]);

  function handleCabinetYearChange(yearId: string) {
    const nextParams = new URLSearchParams(searchParams);
    const nextYear = publicCabinetYears.find((year) => year.id === yearId) ?? null;

    if (!nextYear || nextYear.id === currentCabinetYear?.id) {
      nextParams.delete('year');
    } else {
      nextParams.set('year', cabinetYearQueryValue(nextYear));
    }

    setCopyStatus('idle');
    setSearchParams(nextParams);
  }

  async function copyCurrentLink() {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    setCopyStatus('idle');
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  const { data: members = [], isLoading: loadingMembers, error: membersError } = useCabinetMembers(
    effectiveCabinetYearId,
    shouldIncludeLegacyMembers,
  );

  const isDegraded = isSupabaseUnavailable(membersError);

  const execBoard = members.filter((member) => member.category === 'Executive Board');
  const genBoard = members.filter((member) => member.category === 'General Board');
  const interns = members.filter((member) => member.category === 'Interns');
  const isViewingArchive = !!selectedCabinetYear && selectedCabinetYear.id !== currentCabinetYear?.id;
  const selectedYearRange = formatCabinetYearRange(selectedCabinetYear);
  const selectorValue = selectedCabinetYear?.id ?? (isInvalidYearQuery ? '__not_found__' : '');

  return (
    <>
      <PageTitle title={isInvalidYearQuery ? 'Cabinet Year Not Found' : 'Cabinet'} />
      {isDegraded && <DegradedModeBanner sourceName="cabinet" />}

      <CabinetRoleModal
        isOpen={!!activeRole}
        role={activeRole}
        onClose={() => setActiveRoleName(null)}
      />

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <span className="scrapbook-sticker scrapbook-sticker-teal mb-4">Yearbook</span>
          <p className="vsa-section-label mt-3">Leadership</p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_320px] lg:items-end">
            <div>
              <h1 className="vsa-page-title">
                {isInvalidYearQuery ? (
                  <>
                    Cabinet year <em>not found</em>
                  </>
                ) : isResolvingYearQuery ? (
                  <>
                    Cabinet <em>Archive</em>
                  </>
                ) : isViewingArchive ? (
                  <>
                    Cabinet <em>Archive</em>
                  </>
                ) : (
                  <>
                    Current <em>Cabinet</em>
                  </>
                )}
              </h1>
              <p className="mt-4 max-w-2xl font-sans text-sm leading-relaxed sm:text-[15px]" style={{ color: 'var(--text2)' }}>
                {isInvalidYearQuery
                  ? 'Cabinet year not found. Choose another Cabinet year below or return to the current Cabinet.'
                  : isResolvingYearQuery
                    ? `Looking up the ${requestedYear} Cabinet archive.`
                  : isViewingArchive
                    ? `Viewing ${selectedYearRange} Cabinet. Browse the people who shaped that year of VSA at UCSD.`
                    : 'The current team behind VSA at UCSD. Meet the people planning events, building community, producing programs, and shaping the year from the inside out.'}
              </p>
              <p className="mt-3 font-sans text-xs uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
                {isInvalidYearQuery
                  ? `Requested year: ${requestedYear}`
                  : isResolvingYearQuery
                    ? `Requested year: ${requestedYear}`
                    : `${isViewingArchive ? 'Cabinet Archive' : 'Current Cabinet'} / ${selectedYearRange}${selectedCabinetYear?.theme_name ? ` / ${selectedCabinetYear.theme_name}` : ''} / ${members.length} members`}
              </p>
              {!isViewingArchive && members.length > 0 && (
                <a
                  href="#cabinet-role-explorer"
                  className="mt-4 inline-flex font-mono text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400"
                >
                  Explore cabinet roles ↓
                </a>
              )}
              {isInvalidYearQuery && (
                <Link
                  to="/cabinet"
                  className="mt-5 inline-flex rounded-lg bg-[var(--brand)] px-4 py-2.5 font-sans text-[13px] font-semibold text-[var(--color-on-brand)] transition-opacity hover:opacity-90"
                >
                  View current Cabinet
                </Link>
              )}
              {publicCabinetYears.length > 0 && (
                <div className="mt-5 max-w-xs">
                  <label
                    htmlFor="cabinet-year-select"
                    className="mb-1 block font-sans text-[10px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--color-text3)' }}
                  >
                    Cabinet Year
                  </label>
                  <select
                    id="cabinet-year-select"
                    value={selectorValue}
                    onChange={(event) => handleCabinetYearChange(event.target.value)}
                    className="scrapbook-select"
                  >
                    {isInvalidYearQuery && (
                      <option value="__not_found__" disabled>
                        Cabinet year not found
                      </option>
                    )}
                    {publicCabinetYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {formatCabinetYearRange(year)}{year.id === currentCabinetYear?.id ? ' (current)' : ' archive'}
                      </option>
                    ))}
                  </select>
                  {!isInvalidYearQuery && (
                    <button
                      type="button"
                      onClick={copyCurrentLink}
                      className="mt-2 rounded border px-3 py-1.5 font-sans text-[12px] font-semibold transition-colors hover:bg-[var(--color-surface2)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                    >
                      {copyStatus === 'copied' ? 'Link copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy link'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <StatBlock label="Executive" value={execBoard.length} />
              <StatBlock label="General Board" value={genBoard.length} />
              <StatBlock label="Interns" value={interns.length} />
            </div>
          </div>
        </div>
      </div>

      {loadingCabinetYears || loadingYearIds || loadingMembers ? (
        <CabinetSkeleton />
      ) : isInvalidYearQuery ? (
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
          <div
            className="scrapbook-empty p-12 text-center"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Cabinet year not found.
            </h2>
            <p className="mx-auto mt-3 max-w-lg font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              Choose another Cabinet year above, or view the current Cabinet to see the active board.
            </p>
            <Link
              to="/cabinet"
              className="mt-6 inline-flex rounded-lg bg-[var(--brand)] px-4 py-2.5 font-sans text-[13px] font-semibold text-[var(--color-on-brand)] transition-opacity hover:opacity-90"
            >
              View current Cabinet
            </Link>
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
          <div
            className="scrapbook-empty p-12 text-center"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
              {publicCabinetYears.length === 0
                ? 'Cabinet information is being updated. Check back soon.'
                : `No cabinet members are listed for ${selectedCabinetYear?.label ?? 'this cabinet year'} yet.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          <CabinetBoard members={members} onRoleClick={setActiveRoleName} />

          {!isViewingArchive && (
            <div
              id="cabinet-role-explorer"
              className="mt-16 scroll-mt-24 border-t pt-10"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <CabinetRoleExplorer />
              <section className="mt-12 text-center">
                <span className="scrapbook-sticker scrapbook-sticker-coral mb-3 inline-block">Join Cabinet</span>
                <div className="flex justify-center">
                  <ApplicationCTA
                    applicationKeys="cabinet_application"
                    fallback={{ closed: 'Cabinet applications have closed. Check back next year.' }}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </>
  );
}
