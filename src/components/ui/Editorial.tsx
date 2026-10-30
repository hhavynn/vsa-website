import { type ElementType, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Editorial primitives from the Figma "Redesign VSA Homepage" source:
 * JetBrains Mono eyebrows, Instrument Serif display headings with an italic
 * accent word, and the hairline three-column section header.
 * Colors come from the `ed-*` tokens defined on `.vsa-editorial-shell`.
 */

export const editorialDisplay = 'font-display font-normal tracking-[-0.035em]';

export function Eyebrow({
  children,
  className,
  as: Tag = 'p',
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag
      className={cn(
        'font-mono text-[10.5px] font-semibold uppercase leading-[1.4] tracking-[0.14em]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function EditorialArrow({ direction = 'out' }: { direction?: 'out' | 'down' }) {
  return <span aria-hidden="true">{direction === 'down' ? '↓' : '↗'}</span>;
}

type HeadingTone = 'default' | 'inverse';

/**
 * Section header: the title sits on the left edge with an optional action
 * opposite it, over a hairline. The kicker is optional and kept for the rare
 * section where it carries information; most sections are titled by their
 * heading alone so the page does not repeat one eyebrow template.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  accent,
  action,
  tone = 'default',
  as: Tag = 'h2',
  className,
  titleClassName,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  accent?: ReactNode;
  action?: ReactNode;
  tone?: HeadingTone;
  as?: ElementType;
  className?: string;
  titleClassName?: string;
}) {
  const inverse = tone === 'inverse';
  return (
    <header
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b pb-6 sm:pb-7',
        inverse ? 'border-white/30' : 'border-ed-line',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <Eyebrow className={cn('mb-3', inverse ? 'text-white/85' : 'text-ed-muted')}>{eyebrow}</Eyebrow>
        )}
        <Tag
          id={id}
          className={cn(
            editorialDisplay,
            'm-0 text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.9] [text-wrap:balance]',
            inverse ? 'text-white' : 'text-ed-ink',
            titleClassName,
          )}
        >
          {title}
          {accent && (
            <>
              {' '}
              <em className={cn('font-normal', inverse ? 'text-figma-pink' : 'text-ed-accent')}>{accent}</em>
            </>
          )}
        </Tag>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}

/** Underlined text action used in section headers and footers of sections. */
export function editorialLinkClass(tone: HeadingTone = 'default') {
  return cn(
    'inline-flex min-h-11 items-center gap-4 text-[13px] font-semibold underline-offset-[6px] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4',
    tone === 'inverse' ? 'text-white focus-visible:outline-white' : 'text-ed-ink focus-visible:outline-ed-ink',
  );
}
