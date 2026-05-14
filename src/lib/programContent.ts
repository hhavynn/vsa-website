import { format } from 'date-fns';
import { ProgramContent, ProgramContentStatus } from '../types';

export const PROGRAM_STATUS_LABELS: Record<ProgramContentStatus, string> = {
  hidden: '',
  coming_soon: 'Coming Soon',
  open: 'Open',
  closed: 'Closed',
  active: 'Active',
};

export function isProgramContentHidden(content: ProgramContent | null | undefined) {
  return !content || content.status === 'hidden';
}

export function hasPrimaryProgramLink(content: ProgramContent | null | undefined) {
  return !!content?.primary_link_url && (content.status === 'open' || content.status === 'active');
}

export function formatProgramDateTime(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'MMM d, yyyy h:mm a');
}

export function getProgramMetaParts(content: ProgramContent) {
  return [
    content.event_date ? formatProgramDateTime(content.event_date) : '',
    content.venue ?? '',
    content.deadline_at ? `Deadline: ${formatProgramDateTime(content.deadline_at)}` : '',
  ].filter(Boolean);
}
