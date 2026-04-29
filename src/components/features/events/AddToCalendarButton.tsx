import { useEffect, useRef, useState } from 'react';
import { Event } from '../../../types';

// ─── Calendar link helpers ──────────────────────────────────────────────────

function toICSDate(d: Date) {
  return d.toISOString().replace(/[-:]|\.\d+/g, '');
}

function eventEnd(event: Event) {
  return new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000);
}

function googleUrl(event: Event) {
  const start = new Date(event.date);
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', event.name);
  url.searchParams.set('dates', `${toICSDate(start)}/${toICSDate(eventEnd(event))}`);
  if (event.description) url.searchParams.set('details', event.description);
  if (event.location)    url.searchParams.set('location', event.location);
  return url.toString();
}

function outlookUrl(event: Event) {
  const start = new Date(event.date);
  const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  url.searchParams.set('rru',      'addevent');
  url.searchParams.set('path',     '/calendar/action/compose');
  url.searchParams.set('subject',  event.name);
  url.searchParams.set('startdt',  start.toISOString());
  url.searchParams.set('enddt',    eventEnd(event).toISOString());
  if (event.description) url.searchParams.set('body',     event.description);
  if (event.location)    url.searchParams.set('location', event.location);
  return url.toString();
}

function yahooUrl(event: Event) {
  const start = new Date(event.date);
  const end   = eventEnd(event);
  // Yahoo wants YYYYMMDDTHHMMSS (no Z, no dashes)
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '');
  const url = new URL('https://calendar.yahoo.com/');
  url.searchParams.set('v',    '60');
  url.searchParams.set('title', event.name);
  url.searchParams.set('st',   fmt(start));
  url.searchParams.set('et',   fmt(end));
  if (event.description) url.searchParams.set('desc',   event.description);
  if (event.location)    url.searchParams.set('in_loc', event.location);
  return url.toString();
}

function downloadICS(event: Event) {
  const start = new Date(event.date);
  const end   = eventEnd(event);
  const now   = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VSA at UCSD//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `DTSTAMP:${toICSDate(now)}`,
    `UID:${event.id}@vsaucsd.org`,
    `SUMMARY:${event.name}`,
    event.description
      ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n').replace(/,/g, '\\,')}`
      : null,
    event.location
      ? `LOCATION:${event.location.replace(/,/g, '\\,')}`
      : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href   = URL.createObjectURL(blob);
  link.download = `${event.name.replace(/\s+/g, '-').toLowerCase()}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── Provider icons ──────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="w-[14px] h-[14px] shrink-0" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg viewBox="0 0 18 18" className="w-[14px] h-[14px] shrink-0" aria-hidden fill="none">
      <rect width="18" height="18" rx="3" fill="#0078D4"/>
      <path d="M9.5 4.5H15v9H9.5V4.5Z" fill="#50D9FF" opacity=".9"/>
      <path d="M3 6.5h6.5v5H3V6.5Z" fill="white"/>
      <path d="M5.75 7.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z" fill="#0078D4"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="w-[14px] h-[14px] shrink-0" aria-hidden>
      <rect width="18" height="18" rx="3.5" fill="#1C1C1E"/>
      <path
        d="M11.06 5.1c.56-.68.94-1.62.84-2.56-.81.03-1.8.54-2.38 1.22-.52.6-.98 1.57-.86 2.49.91.07 1.84-.46 2.4-1.15ZM11.88 6.4c-1.32-.08-2.44.75-3.07.75-.63 0-1.59-.71-2.63-.69C4.78 6.49 3.5 7.5 3.5 9.62c0 3.05 2.68 6.38 3.83 6.38.59 0 1.19-.58 2.22-.58s1.59.56 2.22.56c1.18 0 3.73-3.2 3.73-3.2A4.08 4.08 0 0 1 13.55 10c.04-1.87 1.54-2.73 1.61-2.78-.87-1.29-2.23-1.4-2.7-1.42-.38-.03-.76.07-1.02.17-.13.05-.27.09-.38.1h-.07c-.32 0-.69-.22-1.11-.27Z"
        fill="white"
      />
    </svg>
  );
}

function YahooIcon() {
  return (
    <svg viewBox="0 0 18 18" className="w-[14px] h-[14px] shrink-0" aria-hidden>
      <rect width="18" height="18" rx="3" fill="#6001D2"/>
      <path
        d="M4 5h2.5l2.5 4 2.5-4H14L9.5 11.5V14h-1V11.5L4 5Z"
        fill="white"
      />
    </svg>
  );
}

function ICSIcon() {
  return (
    <svg viewBox="0 0 14 14" className="w-[14px] h-[14px] shrink-0" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="2.5" width="12" height="10.5" rx="1.5"/>
      <path d="M1 6h12" strokeLinecap="round"/>
      <path d="M4.5 1v3M9.5 1v3" strokeLinecap="round"/>
      <path d="M7 9.5V8m0 1.5L5.5 9m1.5.5L8.5 9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      className="w-2.5 h-2.5 shrink-0 transition-transform duration-150"
      style={{ transform: open ? 'rotate(180deg)' : 'none' }}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  event: Event;
  /** 'default' = outlined button (list rows), 'ghost' = lighter treatment (featured card) */
  variant?: 'default' | 'ghost';
  align?: 'left' | 'right';
}

const PROVIDERS = [
  {
    id: 'google',
    label: 'Google Calendar',
    icon: <GoogleIcon />,
    action: (e: Event) => window.open(googleUrl(e), '_blank'),
  },
  {
    id: 'outlook',
    label: 'Outlook',
    icon: <OutlookIcon />,
    action: (e: Event) => window.open(outlookUrl(e), '_blank'),
  },
  {
    id: 'apple',
    label: 'Apple Calendar',
    icon: <AppleIcon />,
    action: (e: Event) => downloadICS(e),   // .ics opens natively in macOS/iOS
  },
  {
    id: 'yahoo',
    label: 'Yahoo Calendar',
    icon: <YahooIcon />,
    action: (e: Event) => window.open(yahooUrl(e), '_blank'),
  },
  {
    id: 'ics',
    label: 'Download .ics',
    icon: <ICSIcon />,
    action: (e: Event) => downloadICS(e),
  },
] as const;

export function AddToCalendarButton({ event, variant = 'default', align = 'right' }: Props) {
  const [open, setOpen]     = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const isGhost = variant === 'ghost';

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded border font-sans text-xs font-medium transition-colors duration-150"
        style={{
          padding: isGhost ? '6px 12px' : '8px 14px',
          borderColor: open
            ? 'var(--color-border-strong)'
            : isGhost
            ? 'var(--color-border)'
            : 'var(--color-border)',
          background: open
            ? 'var(--color-surface2)'
            : isGhost
            ? 'transparent'
            : 'var(--color-surface)',
          color: 'var(--color-text2)',
          cursor: 'pointer',
        }}
      >
        <CalendarIcon />
        <span>Save to Calendar</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1.5 min-w-[186px] overflow-hidden rounded border"
          style={{
            [align === 'right' ? 'right' : 'left']: 0,
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
            boxShadow: '0 4px 16px rgb(0 0 0 / 0.12), 0 1px 4px rgb(0 0 0 / 0.08)',
          }}
        >
          <div
            className="px-3 py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.07em] border-b"
            style={{ color: 'var(--color-text3)', borderColor: 'var(--color-border)' }}
          >
            Add to calendar
          </div>
          {PROVIDERS.map((provider, i) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => {
                provider.action(event);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 font-sans text-xs transition-colors duration-100 border-t"
              style={{
                background: 'transparent',
                color: 'var(--color-text)',
                borderColor: i === 0 ? 'transparent' : 'var(--color-border)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              {provider.icon}
              <span style={{ color: 'var(--color-text)' }}>{provider.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
