import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublicApplicationLinks } from '../../../hooks/useApplicationLinks';
import { formatPacificDateTime, getClosingSoonNotices } from '../../../lib/applicationWindows';

/** Most notices shown at once; more than this stops being a notice and starts being a wall. */
const MAX_NOTICES = 3;
/** How often the countdown wording is re-evaluated, so "tomorrow" turns into "today" without a reload. */
const REFRESH_MS = 60 * 1000;
/** Browsers clamp setTimeout to a signed 32-bit delay; a longer wait just re-arms. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
/** Fire just past the boundary so the status flip is already true when we re-check. */
const BOUNDARY_SLACK_MS = 50;

/**
 * A slim homepage notice for application windows that are open and about to close
 * ("House Applications close tomorrow", with the exact Pacific-time deadline).
 *
 * It sits beside ThisWeekInVSA rather than inside it and shares the public
 * application-links query that the Apply sections already use, so it adds no
 * request. It renders nothing while that loads, on failure, and when no window is
 * closing soon, so it never delays first paint or leaves an empty box. The Apply
 * link comes from the masked public projection: a window that is scheduled or
 * closed has no URL there and cannot appear. No animation beyond a pulse that
 * reduced-motion users do not get (`motion-safe`).
 *
 * Time is handled at the actual boundaries, not by polling alone: a timer fires at
 * the next close (the Apply link is removed the moment the window ends) and the
 * next open (the masked projection is refetched, because a window that was
 * scheduled when the page loaded arrived with its URL withheld). The minute tick
 * only keeps the "tomorrow"/"today" wording fresh, and the clock is re-read when
 * a throttled background tab becomes visible again.
 */
export function ClosingSoonApplications() {
  const { links, error, refetch } = usePublicApplicationLinks();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    const current = Date.now();
    let next: { at: number; opens: boolean } | null = null;
    for (const link of links) {
      if (!link.is_enabled) continue;
      const open = Date.parse(link.open_at);
      const due = Date.parse(link.due_at) + 1;
      if (open > current && (!next || open < next.at)) next = { at: open, opens: true };
      if (due > current && (!next || due < next.at)) next = { at: due, opens: false };
    }
    if (!next) return undefined;
    const boundary = next;
    const timer = window.setTimeout(() => {
      setNow(new Date());
      // The server withholds the URL until a window opens, so only a refetch can bring it in.
      if (boundary.opens) void refetch();
    }, Math.min(Math.max(boundary.at - current, 0) + BOUNDARY_SLACK_MS, MAX_TIMEOUT_MS));
    return () => window.clearTimeout(timer);
  }, [links, now, refetch]);

  const notices = useMemo(() => getClosingSoonNotices(links, now), [links, now]);
  if (error || notices.length === 0) return null;

  const shown = notices.slice(0, MAX_NOTICES);
  return (
    <section aria-label="Applications closing soon" className="vsa-container py-3 sm:py-4">
      <div className="rounded-lg border px-4 py-2 sm:px-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {shown.map(({ row, dueAt, daysUntilClose, headline, url }) => (
            <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--color-border)' }}>
              <div className="min-w-0">
                <p id={`closing-soon-${row.id}`} className="flex items-center gap-2 font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  <span
                    aria-hidden
                    data-testid="closing-soon-dot"
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${daysUntilClose <= 1 ? 'bg-red-500 motion-safe:animate-pulse' : 'bg-amber-500'}`}
                  />
                  {headline}
                </p>
                <p className="mt-0.5 pl-4 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                  Deadline {formatPacificDateTime(dueAt, { withYear: false })}
                </p>
              </div>
              <a
                href={url}
                aria-describedby={`closing-soon-${row.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 font-sans text-sm font-semibold transition-opacity duration-150 hover:opacity-90"
                style={{ background: 'var(--brand)', color: '#f8fbfb' }}
              >
                {row.button_label}
                <span aria-hidden>→</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        {notices.length > shown.length && (
          <p className="pb-2 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
            {notices.length - shown.length} more closing soon.{' '}
            <Link to="/get-involved#programs" className="font-semibold underline underline-offset-2">
              See all programs
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

export default ClosingSoonApplications;
