import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface EditorialHeroProps {
  /** Small uppercase mono label above the title (rendered with the coral dash). */
  eyebrow: ReactNode;
  /** The h1 content. Wrap the emphasized word in <EditorialHeroScript>. */
  title: ReactNode;
  /** Muted subtitle below the title. */
  meta?: ReactNode;
  /** Oversized low-opacity decorative type on the right. Hidden from assistive tech. */
  watermark?: ReactNode;
  /** Optional row of stickers / buttons below the subtitle. */
  actions?: ReactNode;
  /**
   * Photography beside the text from lg up, below it on smaller screens.
   * Pass it only when there is something to show (or it is loading).
   */
  media?: ReactNode;
}

/**
 * Full-width editorial page hero shared by the program pages (the ACE
 * visual system). Styles live in src/index.css under `.editorial-hero`.
 */
export function EditorialHero({ eyebrow, title, meta, watermark, actions, media }: EditorialHeroProps) {
  const text = (
    <>
      <div className="editorial-hero-eyebrow">{eyebrow}</div>
      <h1 className={cn('editorial-hero-title', media && 'lg:text-[clamp(84px,7.2vw,112px)]')}>{title}</h1>
      {meta && <p className="editorial-hero-meta">{meta}</p>}
      {actions && <div className="editorial-hero-actions">{actions}</div>}
    </>
  );

  return (
    <section className="editorial-hero">
      <div className="editorial-hero-grain" aria-hidden="true" />
      <div className="editorial-hero-inner">
        {media ? (
          <>
            <div className="lg:flex lg:min-h-[360px] lg:max-w-[calc(100%-min(32vw,400px)-3.5rem)] lg:flex-col lg:justify-center">{text}</div>
            <div className="relative z-[3] mx-auto mt-10 w-full max-w-[420px] lg:absolute lg:right-[max(52px,calc((100%_-_1040px)/2))] lg:top-1/2 lg:mt-0 lg:w-[min(32vw,400px)] lg:-translate-y-1/2">
              {media}
            </div>
          </>
        ) : (
          text
        )}
      </div>
      {watermark && (
        <div className={cn('editorial-hero-watermark', media && 'lg:hidden')} aria-hidden="true">{watermark}</div>
      )}
    </section>
  );
}

/** The coral italic emphasized word inside an EditorialHero title. */
export function EditorialHeroScript({ children }: { children: ReactNode }) {
  return <span className="editorial-hero-script">{children}</span>;
}
