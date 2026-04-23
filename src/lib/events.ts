import { Event } from '../types';

export function getEventCutoffDate(now = new Date()) {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
}

export function splitEventsByDate(events: Event[], now = new Date()) {
  const cutoff = getEventCutoffDate(now);

  const upcomingEvents = events
    .filter((event) => new Date(event.date) >= cutoff)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastEvents = events
    .filter((event) => new Date(event.date) < cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { upcomingEvents, pastEvents };
}

export function formatDateTimeLocal(dateString: string) {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
