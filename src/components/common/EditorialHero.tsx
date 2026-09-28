import type { ReactNode } from 'react';

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
}

/**
 * Full-width editorial page hero shared by the program pages (the ACE
 * visual system). Styles live in src/index.css under `.editorial-hero`.
 */
export function EditorialHero({ eyebrow, title, meta, watermark, actions }: EditorialHeroProps) {
  return (
    <section className="editorial-hero">
      <div className="editorial-hero-grain" aria-hidden="true" />
      <div className="editorial-hero-inner">
        <div className="editorial-hero-eyebrow">{eyebrow}</div>
        <h1 className="editorial-hero-title">{title}</h1>
        {meta && <p className="editorial-hero-meta">{meta}</p>}
        {actions && <div className="editorial-hero-actions">{actions}</div>}
      </div>
      {watermark && (
        <div className="editorial-hero-watermark" aria-hidden="true">{watermark}</div>
      )}
    </section>
  );
}

/** The coral italic emphasized word inside an EditorialHero title. */
export function EditorialHeroScript({ children }: { children: ReactNode }) {
  return <span className="editorial-hero-script">{children}</span>;
}
