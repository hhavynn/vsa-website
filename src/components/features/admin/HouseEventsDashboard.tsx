// Admin → Houses → House Events dashboard (#636): one year's House events
// (drafts included; this page is admin only) by view and host House, with the
// week ahead, per-House counts and what may need a look. It reads the list the
// manager already loaded; every write goes back through the manager, and
// Publish/Unpublish always asks first.
import { useId, useMemo, useRef, useState } from 'react';
import { ConfirmDialog, DialogFrame, dialogBtnCls } from '../../common/ConfirmDialog';
import { HouseEventCard } from '../house/HouseEventCard';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { formatDateOnly } from '../../../lib/dateOnly';
import { formatEventTimeRange } from '../../../lib/eventTime';
import {
  HouseEventView,
  countsByHouse,
  eventsInView,
  filterByHost,
  hostLabel,
  houseEventIssues,
  thisWeek,
} from '../../../lib/houseEventDashboard';
import { cn } from '../../../lib/utils';
import { HouseEvent, HousePageAsset } from '../../../types';
import { houseSlugFromKey } from '../../../utils/houseSlug';

const VIEWS: { key: HouseEventView; label: string }[] = [
  { key: 'attention', label: 'Needs attention' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

const EMPTY: Record<HouseEventView, string> = {
  attention: 'Nothing needs attention.',
  drafts: 'No drafts.',
  upcoming: 'No published upcoming events.',
  past: 'No published past events.',
};

const smallBtn = 'min-h-[36px] rounded border bg-transparent px-2.5 py-1 text-xs font-semibold border-[var(--color-border)] text-text-primary hover:bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600';
const badge = 'rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]';

export function publicHouseEventPath(event: HouseEvent): string | null {
  const host = event.houses?.[0];
  if (!host) return null;
  return `/house/year/${formatAcademicYear(event.academic_year_start)}/${houseSlugFromKey(host.house_key || host.house)}#house-event-${event.id}`;
}

function when(event: HouseEvent) {
  const time = event.start_time && event.end_time ? formatEventTimeRange(event.start_time, event.end_time) : null;
  return `${formatDateOnly(event.event_date, 'EEE, MMM d')}${time ? ` · ${time}` : ''}`;
}

function hosts(event: HouseEvent) {
  return (event.houses ?? []).map(hostLabel).join(' + ') || 'No host House';
}

export interface HouseEventsDashboardProps {
  selectedYear: number | null;
  events: HouseEvent[];
  profiles: HousePageAsset[];
  today: string;
  isLoading: boolean;
  isError: boolean;
  /** The list stopped at its read limit; some events are not shown. */
  truncated: boolean;
  onRetry: () => void;
  onEdit: (event: HouseEvent) => void;
  onDuplicate: (event: HouseEvent) => void;
  onDelete: (event: HouseEvent) => void;
  /** Rejects with a message to show when the change was not saved. */
  onSetPublished: (event: HouseEvent, publish: boolean) => Promise<void>;
}

export function HouseEventsDashboard({
  selectedYear,
  events,
  profiles,
  today,
  isLoading,
  isError,
  truncated,
  onRetry,
  onEdit,
  onDuplicate,
  onDelete,
  onSetPublished,
}: HouseEventsDashboardProps) {
  const [view, setView] = useState<HouseEventView>('attention');
  const [hostId, setHostId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ event: HouseEvent; publish: boolean } | null>(null);
  const [previewing, setPreviewing] = useState<HouseEvent | null>(null);
  const hostSelectId = useId();
  const previewTitleId = useId();
  const previewCloseRef = useRef<HTMLButtonElement>(null);

  const scoped = useMemo(() => filterByHost(events, hostId), [events, hostId]);
  const counts = useMemo(() => countsByHouse(events, profiles), [events, profiles]);
  const week = useMemo(() => thisWeek(scoped, today), [scoped, today]);
  const listed = useMemo(() => eventsInView(scoped, view, today), [scoped, view, today]);
  const yearLabel = selectedYear ? formatAcademicYear(selectedYear) : 'this year';
  const hostName = hostId ? hostLabel(profiles.find((profile) => profile.id === hostId) ?? { display_name: 'House', house_key: '', house: '' }) : null;

  return (
    <section className="scrapbook-paper overflow-hidden border-[var(--color-border)] bg-surface" aria-label="Manage House events">
      <div className="space-y-3 border-b px-4 py-4 sm:px-5 border-[var(--color-border)]">
        <div>
          <h2 className="font-serif text-xl font-bold text-text-primary">Manage House Events</h2>
          <p className="mt-1 text-xs text-text-secondary">
            {events.length} event{events.length === 1 ? '' : 's'} for {yearLabel}. Drafts are visible only here; published events appear on their House pages, the calendar and upcoming events. House events never award VSA attendance points.
          </p>
          {truncated && <p className="mt-1 text-xs font-semibold text-amber-800 dark:text-amber-300">Showing the first {events.length} events of this year; the rest are not listed.</p>}
        </div>

        {profiles.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Events by House">
            {counts.map(({ profile, published, drafts }) => (
              <li key={profile.id}>
                <button
                  type="button"
                  aria-pressed={hostId === profile.id}
                  onClick={() => setHostId(hostId === profile.id ? null : profile.id)}
                  className={cn(smallBtn, hostId === profile.id && 'border-[var(--brand)] bg-[var(--color-surface2)]')}
                >
                  {hostLabel(profile)} · {published} live{drafts ? ` · ${drafts} draft${drafts === 1 ? '' : 's'}` : ''}
                  {!profile.is_active && <span className="ml-1 text-amber-800 dark:text-amber-300">(not public)</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={hostSelectId} className="block font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">Host House</label>
            <select
              id={hostSelectId}
              value={hostId ?? ''}
              onChange={(event) => setHostId(event.target.value || null)}
              className="mt-1 min-h-[36px] rounded border px-2 py-1 text-sm bg-[var(--color-surface2)] border-[var(--color-border)] text-text-primary"
            >
              <option value="">All Houses</option>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{hostLabel(profile)}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="View">
            {VIEWS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(smallBtn, view === key && 'border-[var(--brand)] bg-[var(--color-surface2)]')}
              >
                {label} ({eventsInView(scoped, key, today).length})
              </button>
            ))}
          </div>
        </div>
      </div>

      {isError ? (
        <div role="alert" className="space-y-2 px-4 py-6 text-sm text-red-700 dark:text-red-300 sm:px-5">
          <p>House events could not be loaded. Anything typed in the form is kept.</p>
          <button type="button" onClick={onRetry} className={smallBtn}>Try again</button>
        </div>
      ) : isLoading ? (
        <p className="px-4 py-10 text-center text-sm text-text-muted" role="status">Loading House events…</p>
      ) : (
        <>
          <div className="border-b px-4 py-3 sm:px-5 border-[var(--color-border)] bg-[var(--color-surface2)]">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">This week{hostName ? ` · ${hostName}` : ''}</h3>
            {week.length === 0 ? (
              <p className="mt-1 text-xs text-text-secondary">Nothing in the next seven days.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {week.map((event) => (
                  <li key={event.id} className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{event.title}</span> · {when(event)} · {hosts(event)}
                    {!event.is_published && <span className={cn(badge, 'ml-1.5 border-amber-400 text-amber-800 dark:text-amber-300')}>Draft</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {listed.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-muted">
              {events.length === 0 ? `No House events for ${yearLabel} yet.` : `${EMPTY[view]}${hostName ? ` (${hostName})` : ''}`}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]" aria-label={`${VIEWS.find((v) => v.key === view)?.label} House events`}>
              {listed.map((event) => {
                const issues = houseEventIssues(event, today);
                const publicPath = event.is_published ? publicHouseEventPath(event) : null;
                return (
                  <li key={event.id} className="space-y-2 px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="min-w-0 break-words font-semibold text-text-primary">{event.title}</p>
                      <span className={cn(badge, event.is_published ? 'border-[var(--color-border)] text-text-muted' : 'border-amber-400 text-amber-800 dark:text-amber-300')}>
                        {event.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {when(event)} · {hosts(event)}{event.location ? ` · ${event.location}` : ''}
                    </p>
                    {issues.length > 0 && (
                      <ul className="space-y-0.5 text-xs" aria-label="Checks">
                        {issues.map((issue) => (
                          <li key={issue.id} className={issue.level === 'warn' ? 'text-amber-800 dark:text-amber-300' : 'text-text-muted'}>
                            {issue.level === 'warn' ? 'Check: ' : ''}{issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className={smallBtn} onClick={() => onEdit(event)} aria-label={`Edit ${event.title}`}>Edit</button>
                      <button type="button" className={smallBtn} onClick={() => onDuplicate(event)} aria-label={`Duplicate ${event.title} as a draft`}>Duplicate as draft</button>
                      <button type="button" className={smallBtn} onClick={() => setPreviewing(event)} aria-label={`Preview ${event.title}`}>Preview</button>
                      <button
                        type="button"
                        className={smallBtn}
                        onClick={() => setConfirming({ event, publish: !event.is_published })}
                        aria-label={`${event.is_published ? 'Unpublish' : 'Publish'} ${event.title}`}
                      >
                        {event.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        className={cn(smallBtn, 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300')}
                        onClick={() => onDelete(event)}
                        aria-label={`Delete ${event.title}`}
                      >
                        Delete
                      </button>
                      {publicPath && (
                        <a href={publicPath} target="_blank" rel="noopener noreferrer" className={cn(smallBtn, 'inline-flex items-center')}>
                          Public page<span className="sr-only"> for {event.title} (opens in a new tab)</span>
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {confirming && (
        <ConfirmDialog
          open
          danger={false}
          title={confirming.publish ? 'Publish this House event?' : 'Unpublish this House event?'}
          description={confirming.publish
            ? <>&ldquo;{confirming.event.title}&rdquo; ({when(confirming.event)}, hosted by {hosts(confirming.event)}) will appear on the public House pages, the calendar and upcoming events right away.</>
            : <>&ldquo;{confirming.event.title}&rdquo; will be removed from public pages and kept here as a draft. Its details and host Houses are kept.</>}
          consequences={confirming.publish
            ? houseEventIssues(confirming.event, today).filter((issue) => issue.level === 'warn').map((issue) => issue.message)
            : undefined}
          confirmLabel={confirming.publish ? 'Publish' : 'Unpublish'}
          onConfirm={() => onSetPublished(confirming.event, confirming.publish)}
          onClose={() => setConfirming(null)}
        />
      )}

      {previewing && (
        <DialogFrame titleId={previewTitleId} onClose={() => setPreviewing(null)} initialFocusRef={previewCloseRef} panelClassName="max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={previewTitleId} className="font-serif text-lg font-bold text-text-primary">Preview</h2>
              <p className="mt-1 text-xs text-text-secondary">
                {previewing.is_published
                  ? 'How this card looks on its public House page.'
                  : 'How this card will look once published. It is a draft, so the public cannot see it.'}
              </p>
            </div>
            <button ref={previewCloseRef} type="button" className={dialogBtnCls} onClick={() => setPreviewing(null)}>Close</button>
          </div>
          <div className="mt-4">
            {previewing.houses?.[0] ? (
              <HouseEventCard event={previewing} house={previewing.houses[0]} isUpcoming={previewing.event_date >= today} />
            ) : (
              <p className="text-sm text-text-secondary">No host House is linked, so no House page would show this event.</p>
            )}
          </div>
        </DialogFrame>
      )}
    </section>
  );
}
