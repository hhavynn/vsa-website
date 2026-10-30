import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationKey, ApplicationStatus, PublicApplicationLink } from '../../types';
import { usePublicApplicationLinks } from '../../hooks/useApplicationLinks';
import {
  DEFAULT_APPLICATION_MESSAGES,
  applicationKeyLabel,
  formatApplicationDateTime,
  getApplicationStatus,
} from '../../lib/applicationLinks';
import { FALLBACK_APPLICATIONS, FALLBACK_LINKS } from '../../config/publicFallbackContent';
import { Skeleton } from '../ui/Skeleton';

type FallbackOverrides = Partial<Record<'not_open' | 'closed' | 'unavailable', string>>;

interface ApplicationCTAProps {
  /** One key, or several keys to render together (e.g. House fall/winter/spring). */
  applicationKeys: ApplicationKey | ApplicationKey[];
  /** Optional section heading shown above the buttons. */
  heading?: string;
  className?: string;
  /** Page-specific fallback copy overrides. */
  fallback?: FallbackOverrides;
  /**
   * Hub mode: only render keys whose window is currently open as buttons. When
   * none are open, render `emptyMessage` (or nothing if it is omitted).
   */
  openOnly?: boolean;
  emptyMessage?: string;
}

// Status ordering when more than one row exists for the same key: prefer the
// actionable one. open > not_open (upcoming) > closed > disabled.
// Public program pages only. These are never form URLs.
const PUBLIC_PROGRAM_ROUTES: Record<ApplicationKey, string> = {
  ace_application: '/ace',
  house_fall: '/house',
  house_winter: '/house',
  house_spring: '/house',
  intern_application: '/intern-program',
  cabinet_application: '/cabinet',
  vcn_stage_ninja_interest: '/vcn',
  vcn_props_team_interest: '/vcn',
  wnc_team_form: '/wild-n-culture',
};

const STATUS_RANK: Record<ApplicationStatus, number> = {
  open: 0,
  not_open: 1,
  closed: 2,
  disabled: 3,
};

function pickRowForKey(
  links: PublicApplicationLink[],
  key: ApplicationKey,
): PublicApplicationLink | null {
  const matches = links.filter((link) => link.application_key === key);
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    return a.sort_order - b.sort_order;
  })[0];
}

/**
 * The public view masks a link at fetch time, but a visitor can keep that
 * cached row open across the deadline. Never leave an expired form URL in
 * page markup. Do not promote not_open -> open without a fresh server read:
 * the view intentionally returned no target URL before opening.
 */
export function publicApplicationAtTime(link: PublicApplicationLink, now: Date): PublicApplicationLink {
  if (link.status !== 'open') return link;
  const live = getApplicationStatus(link.open_at, link.due_at, link.is_enabled, now);
  return live === 'open'
    ? link
    : { ...link, status: live, target_url: null };
}

function ApplicationButton({ link }: { link: PublicApplicationLink }) {
  return (
    <a
      href={link.target_url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-sans text-sm font-semibold transition-opacity duration-150 hover:opacity-90"
      style={{ background: 'var(--brand)', color: '#f8fbfb' }}
    >
      {link.button_label} →
    </a>
  );
}

function MutedMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-sm leading-6" style={{ color: 'var(--color-text2)' }}>
      {children}
    </p>
  );
}

/**
 * One window's public card: Apply button while open, otherwise the before/after copy.
 * Exported so the admin preview renders exactly what the site renders.
 */
export function CTABlock({
  link,
  fallbackKey,
  fallback,
  showNextSteps = false,
}: {
  link: PublicApplicationLink | null;
  fallbackKey: ApplicationKey;
  fallback?: FallbackOverrides;
  /** Admin's literal public preview stays link-free for inactive forms. */
  showNextSteps?: boolean;
}) {
  const title = link?.title || applicationKeyLabel(fallbackKey);
  const defaults = DEFAULT_APPLICATION_MESSAGES[fallbackKey];
  const status: ApplicationStatus = link?.status ?? 'disabled';
  const isActionable = status === 'open' && Boolean(link?.target_url);
  // Only announce a date actually supplied by an upcoming admin-managed window.
  const opensAt = status === 'not_open' && !link?.before_open_message
    ? formatApplicationDateTime(link?.open_at)
    : '';

  let body: React.ReactNode;
  if (status === 'open' && link?.target_url) {
    const closes = link.due_at ? formatApplicationDateTime(link.due_at) : '';
    body = (
      <div className="flex flex-col gap-2">
        <ApplicationButton link={link} />
        {closes && (
          <span className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
            Closes {closes}
          </span>
        )}
      </div>
    );
  } else if (status === 'not_open') {
    // The admin-authored message wins: it is where leadership announces the
    // real open date. Page-level fallbacks only cover rows without one.
    body = (
      <MutedMessage>
        {link?.before_open_message || fallback?.not_open || defaults.before}
      </MutedMessage>
    );
  } else if (status === 'closed') {
    body = (
      <MutedMessage>
        {link?.after_close_message || fallback?.closed || defaults.after}
      </MutedMessage>
    );
  } else {
    // disabled, or no row exists yet
    body = <MutedMessage>{link?.before_open_message || defaults.before}</MutedMessage>;
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className="font-sans text-[13px] font-semibold"
        style={{ color: 'var(--color-text)' }}
      >
        {title}
      </div>
      <div className="mt-2">{body}</div>
      {showNextSteps && !isActionable && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3 font-sans text-xs leading-5 text-[var(--color-text2)]">
          {opensAt && <p className="mb-2">Scheduled to open {opensAt}.</p>}
          <p>
            For the next announcement, follow{' '}
            <a href={FALLBACK_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
              VSA on Instagram
            </a>
            . In the meantime,{' '}
            <a href="/get-involved#programs" className="font-semibold underline underline-offset-2">
              explore VSA programs
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Shared, public-safe application CTA. Reads masked link data from the
 * public_application_links view and renders an apply button only while the
 * window is open; otherwise renders friendly before-open / after-close copy.
 * Never renders a raw Supabase error or a masked/null URL.
 */
export function ApplicationCTA({
  applicationKeys,
  heading,
  className,
  fallback,
  openOnly = false,
  emptyMessage,
}: ApplicationCTAProps) {
  const keys = useMemo(
    () => (Array.isArray(applicationKeys) ? applicationKeys : [applicationKeys]),
    [applicationKeys],
  );
  const { links: fetchedLinks, loading, error } = usePublicApplicationLinks();
  const [nowMillis, setNowMillis] = useState(() => Date.now());
  // A user may leave a page open past a closing time. Refresh the local
  // mask on a modest cadence and immediately when returning to the tab.
  useEffect(() => {
    const refresh = () => setNowMillis(Date.now());
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const now = new Date(nowMillis);
  const links = fetchedLinks.map((link) => publicApplicationAtTime(link, now));

  if (loading) {
    return (
      <div className={className} aria-busy="true">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  // Supabase outage: show friendly unavailable copy, never a raw error.
  // Any failed public view read is unavailable, not authoritative evidence
  // that all application forms have disappeared or closed.
  if (error) {
    return (
      <div className={className}>
        <MutedMessage>
          {fallback?.unavailable || FALLBACK_APPLICATIONS.message}{' '}
          <a
            href={FALLBACK_LINKS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--brand)' }}
          >
            Instagram
          </a>
        </MutedMessage>
      </div>
    );
  }

  const rows = keys.map((key) => ({ key, link: pickRowForKey(links, key) }));
  const hasRequestedOpenWindow = rows.some(({ link }) => link?.status === 'open' && !!link.target_url);
  const otherOpenPrograms = links
    .filter((link) => !keys.includes(link.application_key) && link.status === 'open' && !!link.target_url)
    .filter((link, index, all) => all.findIndex((item) => item.application_key === link.application_key) === index)
    .slice(0, 3);
  // When nothing is currently open, link to genuine scheduled program pages.
  // We never create a form CTA from a future row with a masked target URL.
  const otherUpcomingPrograms = !hasRequestedOpenWindow && otherOpenPrograms.length === 0
    ? links
        .filter((link) => !keys.includes(link.application_key) && link.status === 'not_open' && link.is_enabled)
        .filter((link) => Number.isFinite(Date.parse(link.open_at)) && Date.parse(link.open_at) > nowMillis)
        .sort((a, b) => Date.parse(a.open_at) - Date.parse(b.open_at) || a.sort_order - b.sort_order)
        .filter((link, index, all) => all.findIndex((item) => item.application_key === link.application_key) === index)
        .slice(0, 3)
    : [];

  if (openOnly) {
    const openRows = rows.filter(
      ({ link }) => link && link.status === 'open' && link.target_url,
    );
    if (openRows.length === 0) {
      return emptyMessage ? (
        <div className={className}>
          <MutedMessage>{emptyMessage}</MutedMessage>
        </div>
      ) : null;
    }
    return (
      <div className={className}>
        {heading && (
          <div
            className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'var(--color-text3)' }}
          >
            {heading}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {openRows.map(({ key, link }) => (
            <ApplicationButton key={key} link={link!} />
          ))}
        </div>
        <p className="mt-3 font-sans text-xs leading-5 text-[var(--color-text3)]">
          Application forms open on an external service. Review the form before sharing personal information.{' '}
          <Link to="/privacy" className="font-semibold underline underline-offset-2">
            Privacy details
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {heading && (
        <div
          className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: 'var(--color-text3)' }}
        >
          {heading}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ key, link }) => (
          <CTABlock key={key} link={link} fallbackKey={key} fallback={fallback} showNextSteps />
        ))}
      </div>
      {!hasRequestedOpenWindow && otherOpenPrograms.length > 0 && (
        <aside className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-4" aria-label="Other open VSA opportunities">
          <p className="mb-2 font-sans text-sm font-semibold text-[var(--color-text)]">
            Other VSA opportunities currently listed as open
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {otherOpenPrograms.map((link) => (
              <li key={link.application_key}>
                <a href={PUBLIC_PROGRAM_ROUTES[link.application_key]} className="font-sans text-sm font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-400">
                  {applicationKeyLabel(link.application_key)}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-sans text-xs text-[var(--color-text2)]">Check each program page for current requirements and details.</p>
        </aside>
      )}
      {!hasRequestedOpenWindow && otherUpcomingPrograms.length > 0 && (
        <aside
          className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-4"
          aria-label="Upcoming VSA application windows"
        >
          <p className="mb-2 font-sans text-sm font-semibold text-[var(--color-text)]">
            Coming up in other VSA programs
          </p>
          <ul className="space-y-2">
            {otherUpcomingPrograms.map((link) => (
              <li key={link.application_key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  to={PUBLIC_PROGRAM_ROUTES[link.application_key]}
                  className="font-sans text-sm font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-400"
                >
                  {applicationKeyLabel(link.application_key)}
                </Link>
                <span className="font-sans text-xs text-[var(--color-text2)]">
                  Scheduled to open {formatApplicationDateTime(link.open_at)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-sans text-xs text-[var(--color-text2)]">
            Confirm the requirements and dates on each program page before applying.
          </p>
        </aside>
      )}
      {hasRequestedOpenWindow && (
        <p className="mt-3 font-sans text-xs leading-5 text-[var(--color-text3)]">
          Application forms open on an external service. Review the form before sharing personal information.{' '}
          <Link to="/privacy" className="font-semibold underline underline-offset-2">
            Privacy details
          </Link>
          .
        </p>
      )}
    </div>
  );
}

export default ApplicationCTA;
