import { CalendarItem, buildGoogleCalendarUrl } from '../../../utils/calendar';

function CalendarIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="2.5" width="12" height="10.5" rx="1.5" />
      <path d="M1 6h12" strokeLinecap="round" />
      <path d="M4.5 1v3M9.5 1v3" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  item: CalendarItem;
  className?: string;
}

/**
 * One-click "Add to Google Calendar" link for any calendar item (VSA event,
 * House event, or application deadline). Same simple-button direction as
 * events/AddToCalendarButton — no dropdown.
 */
export function AddToGoogleCalendarLink({ item, className = '' }: Props) {
  return (
    <a
      href={buildGoogleCalendarUrl(item)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Add ${item.title} to Google Calendar (opens in new tab)`}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex max-w-full items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.04em] no-underline transition-colors duration-150 hover:bg-[var(--surface2)] ${className}`}
      style={{
        borderColor: 'var(--color-border-strong)',
        background: 'var(--color-surface)',
        color: 'var(--color-text2)',
      }}
    >
      <CalendarIcon />
      <span className="leading-tight">Add to Google Calendar</span>
    </a>
  );
}
