import { FALLBACK_LINKS } from '../../config/publicFallbackContent';

interface ContentUnavailableStateProps {
  title?: string;
  message?: string;
  /** Label for optional call-to-action link */
  actionLabel?: string;
  /** URL for optional call-to-action link */
  actionHref?: string;
  /** Show Instagram + Linktree links (default true) */
  showLinks?: boolean;
  className?: string;
}

export function ContentUnavailableState({
  title = 'Content temporarily unavailable',
  message = 'We\'re having trouble loading this content right now. Please check back later.',
  actionLabel,
  actionHref,
  showLinks = true,
  className = '',
}: ContentUnavailableStateProps) {
  return (
    <div
      className={`scrapbook-empty mx-auto max-w-lg py-10 text-center ${className}`}
    >
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2"
        style={{ borderColor: 'var(--tape-gold)', color: 'var(--tape-gold)' }}
        aria-hidden
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      <h3
        className="mb-2 font-serif text-xl leading-tight"
        style={{ color: 'var(--color-text)' }}
      >
        {title}
      </h3>

      <p
        className="mb-4 font-sans text-sm leading-relaxed"
        style={{ color: 'var(--color-text3)' }}
      >
        {message}
      </p>

      {showLinks && (
        <p className="mb-4 font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
          For the latest updates, check{' '}
          <a
            href={FALLBACK_LINKS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
            style={{ color: 'var(--brand)' }}
          >
            Instagram
          </a>{' '}
          or{' '}
          <a
            href={FALLBACK_LINKS.linktree}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
            style={{ color: 'var(--brand)' }}
          >
            Linktree
          </a>
          .
        </p>
      )}

      {actionLabel && actionHref && (
        <a
          href={actionHref}
          target="_blank"
          rel="noopener noreferrer"
          className="vsa-btn-ghost font-sans text-sm"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}
