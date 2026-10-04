import { cn } from '../../../lib/utils';
import { usePublicSearch } from './PublicSearchProvider';

const isMac = () => typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="m20 20-3.5-3.5" />
    </svg>
  );
}

/**
 * Header trigger for site search. `compact` is the 44px icon button used next
 * to the mobile menu; the default is a pill with the shortcut hint for desktop.
 * Renders nothing without a provider.
 */
export function PublicSearchButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const search = usePublicSearch();
  if (!search) return null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={search.open}
        aria-label="Search the site"
        aria-haspopup="dialog"
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text2)] transition-colors duration-150 hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
          className,
        )}
      >
        <SearchIcon className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={search.open}
      aria-label="Search the site"
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K /"
      className={cn(
        'flex items-center gap-2 rounded-full border border-[var(--border2)] px-3 py-1.5 font-sans text-[12.5px] font-bold text-[var(--text2)] transition-colors duration-150 hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
        className,
      )}
    >
      <SearchIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden lg:inline">Search</span>
      <kbd className="hidden font-mono text-[10px] font-normal text-[var(--color-text3)] xl:inline">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  );
}
