import { ProgramContent } from '../../../types';
import {
  getProgramMetaParts,
  hasPrimaryProgramLink,
  isProgramContentHidden,
  PROGRAM_STATUS_LABELS,
} from '../../../lib/programContent';

interface ProgramContentCalloutProps {
  content: ProgramContent | null;
  defaultTitle: string;
  defaultLinkLabel?: string;
}

export function ProgramContentCallout({
  content,
  defaultTitle,
  defaultLinkLabel = 'Learn More',
}: ProgramContentCalloutProps) {
  if (isProgramContentHidden(content) || !content) return null;

  const metaParts = getProgramMetaParts(content);
  const statusLabel = PROGRAM_STATUS_LABELS[content.status];
  const primaryLabel = content.primary_link_label || defaultLinkLabel;

  return (
    <div
      className="scrapbook-note mb-8 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {content.title || defaultTitle}
          </div>
          {statusLabel && (
            <span className="scrapbook-sticker scrapbook-sticker-teal">
              {statusLabel}
            </span>
          )}
        </div>
        {content.body && (
          <p className="mt-1 max-w-2xl font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            {content.body}
          </p>
        )}
        {metaParts.length > 0 && (
          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
            {metaParts.join(' · ')}
          </p>
        )}
      </div>

      {(hasPrimaryProgramLink(content) || content.secondary_link_url) && (
        <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:shrink-0">
          {hasPrimaryProgramLink(content) && (
            <a
              href={content.primary_link_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="program-cta-link vsa-btn-primary w-full justify-center px-4 py-2 font-sans text-sm font-medium sm:w-auto"
            >
              {primaryLabel} →
            </a>
          )}
          {content.secondary_link_url && (
            <a
              href={content.secondary_link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="program-cta-link vsa-btn-ghost w-full justify-center px-4 py-2 font-sans text-sm transition-colors duration-150 sm:w-auto"
            >
              {content.secondary_link_label || 'More Info'} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
