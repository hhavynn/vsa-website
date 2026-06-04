import { Event } from '../../../types';
import { buildGcalAllDayDates, buildGcalTimedDates } from '../../../lib/eventTime';

function googleUrl(event: Event) {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', event.name);

  if (event.start_time && event.end_time) {
    url.searchParams.set('dates', buildGcalTimedDates(event.date, event.start_time, event.end_time));
    url.searchParams.set('ctz', 'America/Los_Angeles');
  } else {
    url.searchParams.set('dates', buildGcalAllDayDates(event.date, event.end_date));
  }

  if (event.description) url.searchParams.set('details', event.description);
  if (event.location)    url.searchParams.set('location', event.location);
  return url.toString();
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 shrink-0" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="2.5" width="12" height="10.5" rx="1.5"/>
      <path d="M1 6h12" strokeLinecap="round"/>
      <path d="M4.5 1v3M9.5 1v3" strokeLinecap="round"/>
    </svg>
  );
}

interface Props {
  event: Event;
  /** 'default' = outlined button (list rows), 'ghost' = lighter treatment (featured card) */
  variant?: 'default' | 'ghost';
  align?: 'left' | 'right';
}

export function AddToCalendarButton({ event, variant = 'default' }: Props) {
  const isGhost = variant === 'ghost';

  return (
    <a
      href={googleUrl(event)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center justify-center gap-1.5 rounded-lg border text-center font-mono text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors duration-150"
      style={{
        padding: isGhost ? '7px 12px' : '9px 14px',
        borderColor: 'var(--color-border-strong)',
        background: isGhost ? 'transparent' : 'var(--color-surface)',
        color: 'var(--color-text2)',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-border-strong)';
        (e.currentTarget as HTMLAnchorElement).style.background = 'var(--color-surface2)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-border)';
        (e.currentTarget as HTMLAnchorElement).style.background = isGhost ? 'transparent' : 'var(--color-surface)';
      }}
    >
      <CalendarIcon />
      <span className="leading-tight">Add to Google Calendar</span>
    </a>
  );
}
