// No separate identity store, account signup or private membership query:
// reuse bounded public_members search and the single-member, Reveal-gated,
// score-free public_member_house_badge RPC already used by the leaderboard.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import { leaderboardRepository } from '../../../data/repos/leaderboard';
import { formatAcademicYear } from '../../../lib/academicTerms';
import type { MemberOption } from '../../../lib/memberLinkMatching';
import { getHousePagePath } from '../../../utils/houseSlug';

const SEARCH_LIMIT = 11;
const MAX_QUERY_LENGTH = 100;

export function FindMyHouse({ academicYearStart }: { academicYearStart: number }) {
  const [typed, setTyped] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState<MemberOption | null>(null);
  const normalized = typed.trim().replace(/\s+/g, ' ');
  const valid = normalized.length >= 3 && normalized.length <= MAX_QUERY_LENGTH;
  const members = useQuery<MemberOption[], unknown>(
    ['find-my-house', 'public-members', submitted],
    () => memberLookupRepository.searchMembers(submitted, SEARCH_LIMIT),
    { enabled: submitted.length >= 3, staleTime: 60_000, retry: false },
  );
  const badge = useQuery(
    ['find-my-house', 'published-house-badge', academicYearStart, selected?.id],
    () => leaderboardRepository.getMemberHouseBadge(selected!.id, academicYearStart),
    { enabled: !!selected, staleTime: 60_000, retry: false },
  );
  const tooMany = (members.data?.length ?? 0) >= SEARCH_LIMIT;
  const results = tooMany ? [] : members.data ?? [];

  return (
    <section id="find-my-house" aria-labelledby="find-my-house-heading" className="scrapbook-paper scroll-mt-24 p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="scrapbook-sticker scrapbook-sticker-teal">HOUSE REVEAL</span>
        <span className="font-mono text-xs font-bold text-text-secondary">{formatAcademicYear(academicYearStart)}</span>
      </div>
      <h2 id="find-my-house-heading" className="mt-3 font-serif text-2xl font-bold text-text-primary">Find My House</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
        Look up your published House for {formatAcademicYear(academicYearStart)}. Search by name, then choose your own member record.
        We never ask for an email. House scores are not shown.
      </p>
      <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        setSelected(null);
        setSubmitted(normalized);
      }}>
        <label htmlFor="house-member-search" className="sr-only">Member name</label>
        <input
          id="house-member-search"
          type="search"
          autoComplete="off"
          maxLength={MAX_QUERY_LENGTH}
          value={typed}
          onChange={(event) => { setTyped(event.target.value); setSubmitted(''); setSelected(null); }}
          placeholder="First and last name"
          className="min-h-11 w-full min-w-0 rounded border border-[var(--color-border)] bg-surface px-4 text-base text-text-primary sm:flex-1"
        />
        <button className="vsa-btn-primary min-h-11" type="submit" disabled={!valid}>Find my House</button>
      </form>
      {members.isLoading && submitted && <p role="status" className="mt-4 text-sm text-text-secondary">Searching published member records…</p>}
      {members.isError && submitted && <p role="alert" className="mt-4 text-sm text-text-secondary">Member search is temporarily unavailable. Please try again later.</p>}
      {submitted && !members.isLoading && !members.isError && (
        tooMany ? (
          <p role="status" className="mt-4 text-sm text-text-secondary">More than ten members match. Add more of your name to narrow the results.</p>
        ) : results.length === 0 ? (
          <p role="status" className="mt-4 text-sm text-text-secondary">No matching member record found. Try a different spelling or contact cabinet for help.</p>
        ) : (
          <div className="mt-5">
            <h3 className="font-serif text-lg font-semibold text-text-primary">Choose your member record</h3>
            <p className="mt-1 text-xs text-text-secondary">If names are similar, use only the public college and class-year details to choose. A name match never assigns a House.</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {results.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    aria-pressed={selected?.id === member.id}
                    onClick={() => setSelected(member)}
                    className="min-h-11 w-full rounded border border-[var(--color-border)] bg-surface2 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <span className="block font-semibold text-text-primary">{member.fullName}</span>
                    <span className="block text-xs text-text-secondary">
                      {[member.year, member.college].filter(Boolean).join(' · ') || 'No additional public details'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
      {selected && !tooMany && !members.isError && (
        <div className="mt-5 rounded border border-[var(--color-border)] bg-surface2 p-4" role="region" aria-label="Published House result">
          {badge.isLoading ? <p role="status" className="text-sm text-text-secondary">Checking the officially revealed House…</p>
            : badge.isError ? <p role="alert" className="text-sm text-text-secondary">House affiliation could not be verified right now. This does not mean the member is unassigned.</p>
            : badge.data ? (
              <>
                <p className="text-xs font-semibold text-text-secondary">Published {formatAcademicYear(academicYearStart)} House</p>
                <p className="mt-1 font-serif text-2xl font-bold text-text-primary">{badge.data.display_name || badge.data.house}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link className="vsa-btn-primary min-h-11" to={getHousePagePath(badge.data.house, academicYearStart)}>
                    Meet your House and parents
                  </Link>
                  <Link className="vsa-btn-secondary min-h-11" to="/events">Upcoming events</Link>
                </div>
              </>
            ) : (
              <p role="status" className="text-sm text-text-secondary">
                No published House affiliation is linked to this member for {formatAcademicYear(academicYearStart)}.
                If you have received your assignment, contact cabinet to check the canonical member link.
              </p>
            )}
        </div>
      )}
    </section>
  );
}
