// Protected domain — House membership / points. Private roster for one House
// (#652), opened from Admin → Houses → Overview: who is in the House for the
// period, who has come, and who may welcome an invitation. Not a ranking of
// people: counts are shown without judgment and nothing here is public.
// Read-only; corrections happen in Members, Import and House Assignments.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { AttendanceReason, HOUSE_ROSTER_UNAVAILABLE, RosterMember, houseRosterRepository } from '../../../data/repos/houseRoster';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { HOUSE_PARENT_SHARE_FIELDS, houseParentShareCsv, houseParentShareFilename } from '../../../lib/houseParentShare';
import { downloadCsv } from '../../../lib/housePlacementExport';
import { houseMembershipsRepository } from '../../../data/repos/houseMemberships';
import { getLosAngelesDateOnly } from '../../../utils/losAngelesDate';
import { cn } from '../../../lib/utils';

const btn = 'min-h-[36px] touch:min-h-11 rounded border bg-transparent px-2.5 py-1 text-xs font-semibold border-[var(--color-border)] text-text-primary hover:bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50';
const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted';

type Filter = 'all' | 'new' | 'attended' | 'none' | 'two_houses';
const FILTERS: { key: Filter; label: string; test: (m: RosterMember) => boolean }[] = [
  { key: 'all', label: 'Everyone', test: () => true },
  { key: 'attended', label: 'Attended at least once', test: (m) => m.credited_attendance > 0 },
  { key: 'none', label: 'No House-credited attendance yet', test: (m) => m.credited_attendance === 0 },
  { key: 'new', label: 'Joined this period', test: (m) => m.joined_in_period },
  { key: 'two_houses', label: 'In another House too', test: (m) => m.other_house_memberships > 0 },
];

const REASON: Record<AttendanceReason, string> = {
  counted: 'Counted',
  before_house_start: 'Before their House start date',
  no_house: 'Not in a House on that date',
  house_not_public: 'House profile not public yet',
  no_points: 'Event awards no points',
  no_term: 'Event has no academic term',
  no_date: 'Event has no date',
  before_ledger: 'Before the 2025-26 House points start',
};

function name(m: Pick<RosterMember, 'first_name' | 'last_name'>) {
  return [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Unnamed member';
}

/** The UTC calendar date the standings use to credit an event, when it differs from the Los Angeles date. */
function creditedDay(value: string | null) {
  if (!value || value.length === 10) return null;
  const utc = new Date(value).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  return utc === laDate(value) ? null : utc;
}

function laDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' });
}

function MemberAttendance({ memberId, year }: { memberId: string; year: number }) {
  const events = useQuery(['admin', 'house-member-attendance', memberId, year], () => houseRosterRepository.getMemberAttendance(memberId, year), { retry: false });
  if (events.isLoading) return <p className="text-xs text-text-muted" role="status">Loading events…</p>;
  if (events.isError || !events.data) return <p className="text-xs text-red-700 dark:text-red-300" role="alert">Events could not be loaded.</p>;
  if (events.data.length === 0) return <p className="text-xs text-text-muted">No VSA attendance this year.</p>;
  return (
    <ul className="space-y-0.5 text-xs" aria-label={`Events attended`}>
      {events.data.map((event) => (
        <li key={event.event_id} className="flex flex-wrap justify-between gap-2">
          <span className="text-text-primary">{event.name} <span className="text-text-muted">{laDate(event.date)}{creditedDay(event.date) ? ` (counted as ${creditedDay(event.date)}, by UTC date)` : ''}</span></span>
          <span className={event.reason === 'counted' ? 'text-emerald-800 dark:text-emerald-300' : 'text-text-muted'}>
            {event.reason === 'counted' ? `Counted for ${event.house_name}` : REASON[event.reason]}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function HouseRosterPanel({ houseProfileId, termId, onClose }: { houseProfileId: string; termId: string | null; onClose: () => void }) {
  const roster = useQuery(['admin', 'house-roster', houseProfileId, termId], () => houseRosterRepository.getRoster(houseProfileId, termId), { retry: false, staleTime: 0, refetchOnWindowFocus: false });
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [invite, setInvite] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  // Opening a roster below the cards moves focus there, so keyboard and
  // screen-reader users land on it.
  useEffect(() => {
    sectionRef.current?.focus({ preventScroll: true });
    sectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);

  const members = useMemo(() => roster.data?.members ?? [], [roster.data]);
  // The share copy follows the public Reveal boundary (published House
  // assignments, public_house_memberships): only members publicly in this
  // House today, never unrevealed or transferred-out members.
  const revealed = useQuery(
    ['admin', 'house-parent-share-revealed', roster.data?.house.academicYearStart],
    () => houseMembershipsRepository.getPublicHousesByMemberId(roster.data!.house.academicYearStart, getLosAngelesDateOnly()),
    { enabled: !!roster.data, retry: false, staleTime: 60 * 1000, refetchOnWindowFocus: false },
  );
  const revealedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!revealed.data || !roster.data) return ids;
    for (const member of members) {
      if (revealed.data.get(member.member_id)?.houseProfileId === roster.data.house.id) ids.add(member.member_id);
    }
    return ids;
  }, [revealed.data, roster.data, members]);
  const rows = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter)?.test ?? (() => true);
    const query = search.trim().toLowerCase();
    return members.filter((m) => test(m) && (!query || name(m).toLowerCase().includes(query)));
  }, [members, filter, search]);
  const invited = members.filter((m) => invite.has(m.member_id));

  function toggleInvite(id: string) {
    setCopied(false);
    setInvite((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function copyInvites() {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(invited.map(name).join('\n'));
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  const title = roster.data ? `${roster.data.house.displayName} roster` : 'House roster';
  return (
    <section ref={sectionRef} tabIndex={-1} id={`house-roster-${houseProfileId}`} className="scrapbook-paper space-y-3 p-4 sm:p-5 border-[var(--color-border)] bg-surface focus:outline-none" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg font-bold text-text-primary">{title}{roster.data?.termLabel ? ` · ${roster.data.termLabel}` : ''}</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Private. House-credited attendance only counts events after each member&rsquo;s House start date; all VSA events are shown separately. Counts are not a measure of anyone&rsquo;s commitment. Fix a person or attendance in <Link to="/admin/members" className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline">Members</Link> or <Link to="/admin/import" className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline">Import</Link>, never here.
          </p>
        </div>
        <button type="button" className={btn} onClick={onClose}>Close roster</button>
      </div>

      {roster.isLoading ? (
        <p className="text-xs text-text-muted" role="status">Loading the roster…</p>
      ) : roster.isError || !roster.data ? (
        <p role="alert" className="rounded border p-3 text-sm border-red-300 text-red-700 dark:border-red-800 dark:text-red-300">
          {roster.error instanceof Error && roster.error.message === HOUSE_ROSTER_UNAVAILABLE ? HOUSE_ROSTER_UNAVAILABLE : 'The roster could not be loaded. Nothing is shown rather than an empty House.'}
        </p>
      ) : (
        <>
          {!roster.data.house.isActive && (
            <p role="note" className="rounded border p-2 text-xs border-amber-400 text-amber-800 dark:border-amber-700 dark:text-amber-300">
              This House&rsquo;s profile is not public yet, so no attendance is House-credited for anyone: the zeros below do not mean nobody came. See each member&rsquo;s VSA events.
            </p>
          )}
          {!roster.data.dated && (
            <p role="note" className="text-xs text-amber-800 dark:text-amber-300">
              {roster.data.termLabel} has no dates, so this roster is everyone in the House this year; House-credited counts are for that term&rsquo;s events only.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="roster-search" className={labelCls}>Find a member</label>
              <input id="roster-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 min-h-[36px] rounded border px-2 py-1 text-sm bg-[var(--color-surface2)] border-[var(--color-border)] text-text-primary" />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter members">
              {FILTERS.filter((f) => roster.data.house.isActive || f.key !== 'none').map((f) => (
                <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className={cn(btn, filter === f.key && 'border-[var(--brand)] bg-[var(--color-surface2)]')}>
                  {f.label} ({members.filter(f.test).length})
                </button>
              ))}
            </div>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-text-muted">No members in this House for this period.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-text-muted">No members match.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]" aria-label="Members">
              {rows.map((m) => (
                <li key={m.member_id} className="space-y-1.5 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex min-h-[36px] touch:min-h-11 items-center gap-2 text-sm font-semibold text-text-primary">
                      <input type="checkbox" checked={invite.has(m.member_id)} onChange={() => toggleInvite(m.member_id)} />
                      {name(m)}
                      <span className="sr-only">: add to the invitation list</span>
                    </label>
                    <button type="button" className={btn} aria-expanded={open === m.member_id} onClick={() => setOpen(open === m.member_id ? null : m.member_id)}>
                      {open === m.member_id ? 'Hide events' : 'Events'}<span className="sr-only"> for {name(m)}</span>
                    </button>
                  </div>
                  <p className="text-xs text-text-secondary">
                    {m.credited_attendance} House-credited · {m.events_attended} VSA event{m.events_attended === 1 ? '' : 's'} · last credited {laDate(m.last_credited_at)} · in this House from {laDate(m.start_date)}{m.end_date ? ` to ${laDate(m.end_date)}` : ''}
                    {m.joined_in_period ? ' · joined this period' : ''}
                    {m.stints > 1 ? ` · ${m.stints} separate stints in this House this year` : ''}
                  </p>
                  {m.other_house_memberships > 0 && (
                    <p className="text-xs text-amber-800 dark:text-amber-300">Also in {m.other_house_memberships} other House{m.other_house_memberships === 1 ? '' : 's'} this year (a transfer, or an overlap to fix in House Assignments).</p>
                  )}
                  {open === m.member_id && <MemberAttendance memberId={m.member_id} year={roster.data.house.academicYearStart} />}
                </li>
              ))}
            </ul>
          )}

          <div className="rounded border p-3 text-xs border-[var(--color-border)] bg-surface2" aria-live="polite">
            <p className="text-text-primary">
              Invitation list: {invited.length} member{invited.length === 1 ? '' : 's'}. Only you can see it, and it is not saved. Tick members leadership may invite to an upcoming House event.
            </p>
            {invited.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" className={btn} onClick={copyInvites}>Copy names</button>
                <button type="button" className={btn} onClick={() => { setInvite(new Set()); setCopied(false); }}>Clear list</button>
                {copied && <span className="text-text-muted">Copied.</span>}
              </div>
            )}
            {copyFailed && invited.length > 0 && (
              <div className="mt-2">
                <p role="alert" className="text-red-700 dark:text-red-300">Copying is blocked in this browser. Select the names below and copy them.</p>
                <textarea readOnly aria-label="Invitation names" value={invited.map(name).join('\n')} rows={Math.min(8, invited.length)} className="mt-1 block w-full rounded border px-2 py-1 text-xs bg-[var(--color-surface)] border-[var(--color-border)] text-text-primary" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* House Parents get nothing before the Reveal (docs/house-parent-access.md). */}
            <button
              type="button"
              className={btn}
              onClick={() => setSharing(true)}
              disabled={revealedIds.size === 0}
              aria-describedby={revealedIds.size === 0 ? 'house-share-unavailable' : undefined}
            >
              Prepare a copy for House Parents
            </button>
            {revealedIds.size === 0 && (
              <p id="house-share-unavailable" className="text-xs text-text-muted">
                {revealed.isLoading ? 'Checking which members are revealed…'
                  : revealed.isError ? 'Could not check the Reveal, so no copy can be made.'
                  : 'Available once this House\u2019s members are revealed publicly.'}
              </p>
            )}
            <p className="text-xs text-text-muted">{members.length} members · checked {new Date(roster.data.checkedAt).toLocaleString()}.</p>
          </div>
          {sharing && (
            <ConfirmDialog
              open
              danger={false}
              title={`Download a copy for ${roster.data.house.displayName}'s House Parents?`}
              description={<>A CSV of the {revealedIds.size} member{revealedIds.size === 1 ? '' : 's'} publicly revealed in this House{revealedIds.size < members.length ? ` (of ${members.length} on this roster)` : ''}{roster.data.termLabel ? `, for ${roster.data.termLabel}` : ''}, with only these columns. Share it only with this House&rsquo;s own House Parents, privately; never post it. It has no contact details, no other House, and no counts that could add up to House points or rank (embargoed).</>}
              consequences={HOUSE_PARENT_SHARE_FIELDS.map((field) => `${field.header}: ${field.describe}`)}
              confirmLabel="Download"
              onConfirm={() => {
                downloadCsv(houseParentShareCsv(members, revealedIds), houseParentShareFilename(roster.data.house.displayName, roster.data.house.academicYearStart, roster.data.termLabel));
              }}
              onClose={() => setSharing(false)}
            />
          )}
        </>
      )}
    </section>
  );
}
