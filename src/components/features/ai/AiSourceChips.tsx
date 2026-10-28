import { sanitizeHref } from '../../../utils/sanitizeUrl';
import { SourceChip } from './useVsaAiConversation';

function SourceIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6.3 10.55 4.95 11.9a3.1 3.1 0 0 0 4.38 4.38l2.1-2.1a3.1 3.1 0 0 0 0-4.38M13.7 9.45l1.35-1.35a3.1 3.1 0 0 0-4.38-4.38l-2.1 2.1a3.1 3.1 0 0 0 0 4.38"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Sanitize model-returned source URLs before they become browser navigations. */
export function safeAssistantSourceUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    // encodeURI preserves safe path separators but protects backslashes from
    // being interpreted as a second leading slash by browser URL parsing.
    const encoded = encodeURI(raw.trim()).replace(/%25([0-9A-Fa-f]{2})/g, '%$1');
    const href = sanitizeHref(encoded);
    return href === '#' ? null : href;
  } catch {
    // Malformed Unicode or unexpected model output must never crash the panel.
    return null;
  }
}

/**
 * Render up to four cabinet-approved knowledge citations. Source URLs arrive
 * from an AI response; never interpolate an unsupported scheme into href.
 * The visual/text treatment matches the former inline source chips.
 */
export function AiSourceChips({ messageId, sources }: { messageId: string; sources: SourceChip[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {sources.slice(0, 4).map((source) => {
        const label = source.title.length > 28 ? `${source.title.slice(0, 25)}...` : source.title;
        const safeUrl = safeAssistantSourceUrl(source.source_url);
        return safeUrl ? (
          <a
            key={`${messageId}-${source.title}`}
            href={safeUrl}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-sans text-[10px] font-bold transition-colors hover:border-brand-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-surface)' }}
            aria-label={`Source: ${source.title}`}
          >
            <SourceIcon />
            {label}
          </a>
        ) : (
          <span
            key={`${messageId}-${source.title}`}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-sans text-[10px] font-bold"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-surface)' }}
          >
            <SourceIcon />
            {label}
          </span>
        );
      })}
    </div>
  );
}
