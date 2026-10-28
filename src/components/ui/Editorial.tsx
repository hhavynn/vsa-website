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
 * Figma `.section-heading`: eyebrow | display title | action, bottom-aligned
 * over a hairline. Collapses to eyebrow + action above a full-width title.
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
  eyebrow: ReactNode;
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
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4 border-b pb-7 sm:pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] lg:items-end',
        inverse ? 'border-white/25' : 'border-ed-line',
        className,
      )}
    >
      <Eyebrow className={cn('lg:pb-3', inverse ? 'text-white/90' : 'text-ed-muted')}>{eyebrow}</Eyebrow>
      {action && (
        <div className="col-start-2 row-start-1 justify-self-end lg:col-start-3 lg:pb-2">{action}</div>
      )}
      <Tag
        id={id}
        className={cn(
          editorialDisplay,
          'col-span-2 m-0 text-[clamp(3.25rem,11vw,8rem)] leading-[0.86] lg:col-span-1 lg:col-start-2 lg:row-start-1',
          inverse ? 'text-white' : 'text-ed-ink',
          titleClassName,
        )}
      >
        {title}
        {accent && (
          <>
            {' '}
            <em className={cn('font-normal', inverse ? 'text-[#f0ccd9]' : 'text-ed-accent')}>{accent}</em>
          </>
        )}
      </Tag>
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
