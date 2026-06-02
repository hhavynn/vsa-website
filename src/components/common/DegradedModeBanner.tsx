import { FALLBACK_LINKS } from '../../config/publicFallbackContent';

interface DegradedModeBannerProps {
  /** 'page' = full-width banner at top of content, 'inline' = compact card */
  variant?: 'page' | 'inline';
  /** Optional source name, e.g. "events" or "gallery" */
  sourceName?: string;
  className?: string;
}

export function DegradedModeBanner({
  variant = 'page',
  sourceName,
  className = '',
}: DegradedModeBannerProps) {
  const subject = sourceName ? `${sourceName} data` : 'some live content';

  if (variant === 'inline') {
    return (
      <div
        className={`rounded-lg border px-4 py-3 font-sans text-sm leading-relaxed ${className}`}
        style={{
          borderColor: 'var(--tape-gold)',
          background: 'color-mix(in srgb, var(--tape-gold) 8%, var(--color-surface))',
          color: 'var(--color-text2)',
        }}
        role="status"
        aria-live="polite"
      >
        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
          Heads up:
        </span>{' '}
        Basic info is shown below — {subject} is temporarily unavailable. Check{' '}
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
        </a>{' '}
        for the latest updates.
      </div>
    );
  }

  return (
    <div
      className={`w-full border-b px-4 py-3 font-sans text-sm leading-relaxed ${className}`}
      style={{
        borderColor: 'var(--tape-gold)',
        background: 'color-mix(in srgb, var(--tape-gold) 10%, var(--color-surface))',
        color: 'var(--color-text2)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="vsa-container flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{ background: 'var(--tape-gold)', color: '#000' }}
        >
          Notice
        </span>
        <span>
          Some live VSA website content is temporarily unavailable. Basic info is shown below.
        </span>
        <span className="text-[var(--color-text3)]">
          Check{' '}
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
          </a>{' '}
          for the latest updates.
        </span>
      </div>
    </div>
  );
}
