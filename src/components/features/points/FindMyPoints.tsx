import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "../../ui/Input";
import { useAcademicTerms } from "../../../hooks/useAcademicTerms";
import { useLeaderboardYears } from "../../../hooks/useLeaderboardYears";
import {
  useFindMyPoints,
  type FindMyPointsEntry,
  type SelectedYear,
} from "../../../hooks/useFindMyPoints";
import { MyVSACard } from "./MyVSACard";

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 512 512"
    fill="currentColor"
    aria-hidden
  >
    <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 384 512"
    fill="currentColor"
    aria-hidden
  >
    <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 512 512"
    fill="currentColor"
    aria-hidden
  >
    <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z" />
  </svg>
);

const SparkleIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 576 512"
    fill="currentColor"
    aria-hidden
  >
    <path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.5 7-28.8 18L195 150.3 47.7 171.5c-12.1 1.7-22.1 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.8 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 546.2 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.6-19.9-25.7-21.7L381.2 150.3 316.9 18z" />
  </svg>
);

interface AcademicYearOption {
  year: number;
  label: string;
  isActive: boolean;
  hasData: boolean;
}

interface FindMyPointsProps {
  variant?: "panel" | "page";
  className?: string;
  showHeader?: boolean;
}

const CORRECTION_HREF = "/feedback?type=event&title=Points%20correction";

function StickerBadge({
  children,
  rotation = 0,
  color = "primary",
  size = "md",
}: {
  children: React.ReactNode;
  rotation?: number;
  color?: "primary" | "accent" | "gold";
  size?: "sm" | "md";
}) {
  const colorClass =
    color === "primary"
      ? "scrapbook-sticker-teal"
      : color === "accent"
        ? "scrapbook-sticker-coral"
        : "scrapbook-sticker-gold";
  return (
    <span
      className={`scrapbook-sticker ${colorClass} ${size === "sm" ? "px-2 py-1 text-[9px]" : ""}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {children}
    </span>
  );
}

function InitialsAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
      : (parts[0]?.[0] ?? "?").toUpperCase();
  const hue =
    (name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 137) % 360;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-sans font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `hsl(${hue},45%,88%)`,
        color: `hsl(${hue},55%,38%)`,
      }}
    >
      {initials}
    </div>
  );
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}

function tokenize(value: string) {
  return normalizeForMatch(value).split(/\s+/).filter(Boolean);
}

function entryMatches(entry: FindMyPointsEntry, tokens: string[]) {
  if (tokens.length === 0) return false;
  const haystack = `${normalizeForMatch(entry.full_name)} ${normalizeForMatch(entry.college ?? "")} ${normalizeForMatch(entry.graduation_year ?? "")}`;
  return tokens.every((t) => haystack.includes(t));
}

function isExactNameMatch(entry: FindMyPointsEntry, query: string) {
  return normalizeForMatch(entry.full_name) === normalizeForMatch(query);
}

export function FindMyPoints({
  variant = "panel",
  className = "",
  showHeader = true,
}: FindMyPointsProps) {
  const { terms, loading: termsLoading } = useAcademicTerms();
  const { yearsWithData, loading: yearsLoading } = useLeaderboardYears();

  const [query, setQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<SelectedYear | null>(null);
  const [hasUserSelectedYear, setHasUserSelectedYear] = useState(false);
  const [pickedMemberId, setPickedMemberId] = useState<string | null>(null);

  const academicYears = useMemo<AcademicYearOption[]>(() => {
    const years = new Map<number, AcademicYearOption>();
    terms.forEach((term) => {
      const existing = years.get(term.academic_year_start);
      if (existing) {
        existing.isActive = existing.isActive || term.is_active;
        return;
      }
      years.set(term.academic_year_start, {
        year: term.academic_year_start,
        label: `${term.academic_year_start}-${term.academic_year_end}`,
        isActive: term.is_active,
        hasData: false,
      });
    });
    yearsWithData.forEach((year) => {
      const existing = years.get(year);
      if (existing) {
        existing.hasData = true;
      } else {
        years.set(year, {
          year,
          label: `${year}-${year + 1}`,
          isActive: false,
          hasData: true,
        });
      }
    });
    return Array.from(years.values()).sort((a, b) => b.year - a.year);
  }, [terms, yearsWithData]);

  const defaultYearReady = !termsLoading && !yearsLoading;
  const resolvedDefaultYear = useMemo<SelectedYear | null>(() => {
    if (academicYears.length === 0) return null;
    const activeYear = academicYears.find((y) => y.isActive);
    if (activeYear?.hasData) return activeYear.year;
    const mostRecent = academicYears.find((y) => y.hasData);
    if (mostRecent) return mostRecent.year;
    if (activeYear) return activeYear.year;
    return academicYears[0].year;
  }, [academicYears]);

  const initialSelectedYear: SelectedYear | null = defaultYearReady
    ? (resolvedDefaultYear ?? "all")
    : null;

  useEffect(() => {
    if (
      hasUserSelectedYear ||
      selectedYear !== null ||
      initialSelectedYear === null
    )
      return;
    setSelectedYear(initialSelectedYear);
  }, [hasUserSelectedYear, initialSelectedYear, selectedYear]);

  useEffect(() => {
    setPickedMemberId(null);
  }, [selectedYear]);

  const {
    data: entries = [],
    isLoading: entriesLoading,
    isFetching,
    error,
  } = useFindMyPoints(selectedYear);

  const trimmedQuery = query.trim();
  const tokens = useMemo(() => tokenize(trimmedQuery), [trimmedQuery]);

  const matches = useMemo<FindMyPointsEntry[]>(() => {
    if (tokens.length === 0) return [];
    const matched = entries.filter((e) => entryMatches(e, tokens));
    return matched.sort((a, b) => {
      const aExact = isExactNameMatch(a, trimmedQuery) ? 0 : 1;
      const bExact = isExactNameMatch(b, trimmedQuery) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return a.rank - b.rank;
    });
  }, [entries, tokens, trimmedQuery]);

  const exactMatches = useMemo(
    () => matches.filter((m) => isExactNameMatch(m, trimmedQuery)),
    [matches, trimmedQuery],
  );

  const pickedEntry = useMemo(() => {
    if (!pickedMemberId) return null;
    return matches.find((m) => m.member_id === pickedMemberId) ?? null;
  }, [pickedMemberId, matches]);

  const autoPicked = useMemo<FindMyPointsEntry | null>(() => {
    if (matches.length === 1) return matches[0];
    if (exactMatches.length === 1) return exactMatches[0];
    return null;
  }, [matches, exactMatches]);

  const resolvedEntry = pickedEntry ?? autoPicked;

  const handleYearChange = (value: string) => {
    setHasUserSelectedYear(true);
    setSelectedYear(value === "all" ? "all" : Number(value));
  };

  const handleClear = () => {
    setQuery("");
    setPickedMemberId(null);
  };

  const selectedYearLabel = useMemo(() => {
    if (selectedYear === "all") return "All-Time";
    if (selectedYear == null) return "";
    return (
      academicYears.find((y) => y.year === selectedYear)?.label ||
      `${selectedYear}-${selectedYear + 1}`
    );
  }, [academicYears, selectedYear]);

  const loadingState = entriesLoading || (entries.length === 0 && isFetching);
  const initializing = selectedYear === null || !defaultYearReady;

  const showAmbiguous = !resolvedEntry && matches.length > 1;
  const showNoResults =
    trimmedQuery.length > 0 &&
    matches.length === 0 &&
    !loadingState &&
    !initializing;
  const showEmptyData = !initializing && !loadingState && entries.length === 0;

  const containerClass =
    variant === "panel"
      ? `scrapbook-paper relative overflow-hidden p-5 sm:p-8 ${className}`.trim()
      : `scrapbook-paper relative overflow-hidden p-6 sm:p-10 ${className}`.trim();

  return (
    <section
      className={containerClass}
      aria-labelledby="find-my-points-heading"
    >
      <span className="scrapbook-pin" aria-hidden />

      {showHeader && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StickerBadge rotation={-2} color="accent">
                FIND MY POINTS
              </StickerBadge>
              {selectedYearLabel && (
                <StickerBadge rotation={1} color="primary" size="sm">
                  {selectedYearLabel}
                </StickerBadge>
              )}
            </div>
            <h2
              id="find-my-points-heading"
              className={
                variant === "page"
                  ? "vsa-section-title"
                  : "font-serif text-2xl font-bold leading-tight"
              }
              style={{ color: "var(--text)" }}
            >
              Look up your points
            </h2>
            <p
              className="mt-2 max-w-xl font-sans text-[13px] leading-[1.7]"
              style={{ color: "var(--text2)" }}
            >
              Search your name to see your rank and event count for the selected
              academic year.
            </p>
          </div>

          <div className="shrink-0">
            <label
              className="block font-mono text-[10px] font-bold uppercase tracking-wider opacity-60"
              style={{ color: "var(--text3)" }}
            >
              Year
            </label>
            <select
              value={selectedYear ?? ""}
              onChange={(e) => handleYearChange(e.target.value)}
              className="scrapbook-select mt-1 bg-[var(--surface)] font-mono text-xs font-bold"
              aria-label="Select academic year"
            >
              <option value="all">ALL-TIME</option>
              {academicYears.map((year) => (
                <option key={year.year} value={year.year}>
                  {year.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
        <Input
          className="pl-11 pr-10 h-12 bg-[var(--surface)] border-2 border-[var(--border)] focus:ring-[var(--brand)]"
          placeholder="Type your name (e.g. Havyn Nguyen)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPickedMemberId(null);
          }}
          aria-label="Search by name"
          autoComplete="off"
          spellCheck={false}
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text3)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-6">
        {error ? (
          <div
            className="scrapbook-empty text-sm"
            style={{ color: "var(--text3)" }}
          >
            Couldn't load points right now. Please try again in a moment.
          </div>
        ) : initializing || loadingState ? (
          <div
            className="scrapbook-empty text-sm"
            style={{ color: "var(--text3)" }}
          >
            Loading members...
          </div>
        ) : showEmptyData ? (
          <div className="scrapbook-empty">
            <p className="font-sans text-sm" style={{ color: "var(--text3)" }}>
              No member activity recorded for {selectedYearLabel} yet. Try the{" "}
              <strong>All-Time</strong> view above.
            </p>
          </div>
        ) : trimmedQuery.length === 0 ? (
          <EmptySearchPrompt />
        ) : showNoResults ? (
          <NoResultsCard query={trimmedQuery} yearLabel={selectedYearLabel} />
        ) : resolvedEntry ? (
          <MyVSACard
            entry={resolvedEntry}
            allEntries={entries}
            yearLabel={selectedYearLabel}
            isAllTime={selectedYear === "all"}
            ambiguous={matches.length > 1}
            onReset={() => setPickedMemberId(null)}
          />
        ) : showAmbiguous ? (
          <MultipleMatches
            matches={matches.slice(0, 8)}
            totalCount={matches.length}
            yearLabel={selectedYearLabel}
            onPick={(id) => setPickedMemberId(id)}
          />
        ) : null}
      </div>

      <TrustNote />
    </section>
  );
}

function EmptySearchPrompt() {
  return (
    <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface2)] p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)]/10 text-[var(--brand)]">
        <SparkleIcon className="h-5 w-5" />
      </div>
      <p className="font-sans text-sm" style={{ color: "var(--text2)" }}>
        Start typing your name to find your points.
      </p>
      <p className="mt-1 font-sans text-xs" style={{ color: "var(--text3)" }}>
        Tip: try your first and last name. We never show or ask for your email.
      </p>
    </div>
  );
}

function NoResultsCard({
  query,
  yearLabel,
}: {
  query: string;
  yearLabel: string;
}) {
  return (
    <div className="rounded-xl border-2 border-[var(--border)] bg-[var(--surface2)] p-5">
      <p
        className="font-serif text-base font-bold"
        style={{ color: "var(--text)" }}
      >
        No match for "{query}" in {yearLabel}.
      </p>
      <p className="mt-2 font-sans text-sm" style={{ color: "var(--text2)" }}>
        Try a shorter spelling, switch the academic year, or check the All-Time
        view. If you attended events but don't see yourself, you can request a
        correction below.
      </p>
      <div className="mt-4">
        <Link
          to={CORRECTION_HREF}
          className="vsa-btn-primary inline-flex whitespace-nowrap"
        >
          Request a correction
        </Link>
      </div>
    </div>
  );
}

function MultipleMatches({
  matches,
  totalCount,
  yearLabel,
  onPick,
}: {
  matches: FindMyPointsEntry[];
  totalCount: number;
  yearLabel: string;
  onPick: (memberId: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p
          className="font-serif text-base font-bold"
          style={{ color: "var(--text)" }}
        >
          {totalCount} possible matches
        </p>
        <p
          className="font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text3)" }}
        >
          {yearLabel}
        </p>
      </div>
      <p className="mb-4 font-sans text-xs" style={{ color: "var(--text3)" }}>
        Pick the one that's you. We don't show emails — use class year or
        college to tell yourself apart.
      </p>
      <ul className="space-y-2">
        {matches.map((entry) => (
          <li key={entry.member_id}>
            <button
              type="button"
              onClick={() => onPick(entry.member_id)}
              className="group flex w-full items-center gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-sm"
            >
              <InitialsAvatar name={entry.full_name || "Member"} size={36} />
              <div className="min-w-0 flex-1">
                <div
                  className="truncate font-serif text-[15px] font-bold"
                  style={{ color: "var(--text)" }}
                >
                  {entry.full_name || "VSA Member"}
                </div>
                <div
                  className="truncate font-sans text-[11px]"
                  style={{ color: "var(--text3)" }}
                >
                  {[entry.graduation_year, entry.college]
                    .filter(Boolean)
                    .join(" • ") || "VSA Member"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-60">
                  RANK
                </div>
                <div
                  className="font-mono text-base font-black"
                  style={{ color: "var(--text)" }}
                >
                  #{entry.rank}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {totalCount > matches.length && (
        <p className="mt-3 font-sans text-xs" style={{ color: "var(--text3)" }}>
          Showing {matches.length} of {totalCount}. Refine your search to narrow
          it down.
        </p>
      )}
    </div>
  );
}

function TrustNote() {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface2)]/60 px-4 py-3">
      <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text3)]" />
      <div
        className="font-sans text-[11px] leading-[1.6]"
        style={{ color: "var(--text3)" }}
      >
        Points refresh after admin imports — give it 24–48 hours after an event.
        Yearly totals only count events assigned to an academic term (Fall /
        Winter / Spring).
      </div>
    </div>
  );
}

export default FindMyPoints;
