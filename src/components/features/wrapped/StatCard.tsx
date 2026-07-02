interface Props {
  emoji: string;
  label: string;
  /** Formatted headline value, e.g. "24" or "Over 12,000" */
  value: string | null;
  /** Curated copy shown when a live aggregate is unavailable */
  fallback: string;
  caption?: string;
  rotate?: 'left' | 'right' | 'none';
}

const ROTATE_CLASS = {
  left: 'scrapbook-rotate-sm-left',
  right: 'scrapbook-rotate-sm-right',
  none: '',
};

/**
 * Big aggregate stat card. Only ever shows community-level numbers; when the
 * live aggregate is missing it falls back to curated copy instead of a fake
 * number.
 */
export function StatCard({ emoji, label, value, fallback, caption, rotate = 'none' }: Props) {
  return (
    <div className={`scrapbook-paper relative p-5 sm:p-6 ${ROTATE_CLASS[rotate]}`}>
      <span className="scrapbook-pin" aria-hidden />
      <div className="text-2xl" aria-hidden>
        {emoji}
      </div>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text3)' }}>
        {label}
      </div>
      {value ? (
        <div className="mt-1 font-serif text-[44px] font-black leading-none tracking-[-0.02em] sm:text-[56px]" style={{ color: 'var(--brand)' }}>
          {value}
        </div>
      ) : (
        <div className="mt-2 font-sans text-[15px] font-bold leading-snug" style={{ color: 'var(--text)' }}>
          {fallback}
        </div>
      )}
      {caption && (
        <p className="mt-2 font-sans text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>
          {caption}
        </p>
      )}
    </div>
  );
}
