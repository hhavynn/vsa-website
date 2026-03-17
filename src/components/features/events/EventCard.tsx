import { format } from 'date-fns';
import { Event } from '../../../types';
import { CountdownTimer } from '../../common/CountdownTimer';
import { motion } from 'framer-motion';
import { EVENT_TYPE_LABELS } from '../../../constants/eventTypes';

export interface EventCardProps {
  event: Event;
  onCheckIn: () => void;
}

export function EventCard({ event, onCheckIn }: EventCardProps) {
  const handleSaveToCalendar = () => {
    if (!event.date) return;
    const startDate = new Date(event.date);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    // Format as YYYYMMDDTHHMMSSZ (UTC) for Google Calendar
    const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d+/g, '');
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.append('action', 'TEMPLATE');
    url.searchParams.append('text', event.name);
    url.searchParams.append('dates', `${fmt(startDate)}/${fmt(endDate)}`);
    url.searchParams.append('details', event.description);
    url.searchParams.append('location', event.location || '');
    window.open(url.toString(), '_blank');
  };

  let dateString = '';
  let isUpcoming = false;
  if (event.date) {
    const dateObj = new Date(event.date);
    if (!isNaN(dateObj.getTime())) {
      dateString = format(dateObj, 'MMM d, yyyy • h:mm a');
      isUpcoming = dateObj > new Date();
    }
  }

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="rounded-2xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-card flex flex-col h-full hover:border-indigo-500/30 transition-colors duration-200"
      >
        {/* Image */}
        <div className="relative h-44 bg-slate-800 overflow-hidden">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-900/50 to-violet-900/50 flex items-center justify-center">
              <svg className="w-10 h-10 text-indigo-400/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {/* Event type badge */}
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-600/90 text-white backdrop-blur-sm">
            {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
          </span>
          {isUpcoming && (
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-600/90 text-white backdrop-blur-sm">
              Upcoming
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-grow">
          <h3 className="font-heading font-semibold text-white text-base mb-1.5 line-clamp-2">{event.name}</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-2 flex-grow">{event.description}</p>

          {/* Meta */}
          <div className="space-y-1.5 mb-4">
            {dateString && (
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{dateString}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{event.location}</span>
              </div>
            )}
          </div>

          {/* Countdown */}
          {isUpcoming && event.date && (
            <div className="mb-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-1.5">Starts in</p>
              <CountdownTimer targetDate={new Date(event.date)} onComplete={() => {}} />
            </div>
          )}

          {/* Action */}
          <button
            onClick={handleSaveToCalendar}
            disabled={!event.date}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Add to Google Calendar
          </button>
        </div>
      </motion.div>
    </>
  );
}
