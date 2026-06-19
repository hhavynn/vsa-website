import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationKey, ApplicationStatus, PublicApplicationLink } from '../../types';
import { usePublicApplicationLinks } from '../../hooks/useApplicationLinks';
import {
  DEFAULT_APPLICATION_MESSAGES,
  applicationKeyLabel,
  formatApplicationDateTime,
} from '../../lib/applicationLinks';
import { isSupabaseUnavailable } from '../../utils/isSupabaseUnavailable';
import { FALLBACK_APPLICATIONS, FALLBACK_LINKS } from '../../config/publicFallbackContent';

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

function CTABlock({
  link,
  fallbackKey,
  fallback,
}: {
  link: PublicApplicationLink | null;
  fallbackKey: ApplicationKey;
  fallback?: FallbackOverrides;
}) {
  const title = link?.title || applicationKeyLabel(fallbackKey);
  const defaults = DEFAULT_APPLICATION_MESSAGES[fallbackKey];
  const status: ApplicationStatus = link?.status ?? 'disabled';

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
    body = (
      <MutedMessage>
        {fallback?.not_open || link?.before_open_message || defaults.before}
      </MutedMessage>
    );
  } else if (status === 'closed') {
    body = (
      <MutedMessage>
        {fallback?.closed || link?.after_close_message || defaults.after}
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
  const { links, loading, error } = usePublicApplicationLinks();

  if (loading) {
    return (
      <div className={className} aria-busy="true">
        <div
          className="h-16 w-full animate-pulse rounded-lg border"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
        />
      </div>
    );
  }

  // Supabase outage: show friendly unavailable copy, never a raw error.
  if (error && isSupabaseUnavailable(error)) {
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
          <CTABlock key={key} link={link} fallbackKey={key} fallback={fallback} />
        ))}
      </div>
      {rows.some(({ link }) => link?.status === 'open' && link.target_url) && (
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
