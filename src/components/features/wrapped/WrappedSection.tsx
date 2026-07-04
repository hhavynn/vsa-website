import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type StickerTone = 'teal' | 'coral' | 'gold';

interface Props {
  /** Big ghost chapter number, e.g. "02" */
  number: string;
  sticker: string;
  stickerTone?: StickerTone;
  heading: string;
  subheading?: string;
  children: ReactNode;
  id?: string;
}

const STICKER_CLASS: Record<StickerTone, string> = {
  teal: 'scrapbook-sticker-teal',
  coral: 'scrapbook-sticker-coral',
  gold: 'scrapbook-sticker-gold',
};

/** Shared section shell for Wrapped chapters: ghost number + sticker + heading. */
export function WrappedSection({
  number,
  sticker,
  stickerTone = 'teal',
  heading,
  subheading,
  children,
  id,
}: Props) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className="relative py-14 sm:py-20"
      aria-label={heading}
    >
      <span
        className="pointer-events-none absolute -top-2 right-0 select-none font-serif text-[96px] font-black leading-none text-text-primary opacity-[0.07] sm:text-[160px]"
        aria-hidden
      >
        {number}
      </span>

      <span className={`scrapbook-sticker ${STICKER_CLASS[stickerTone]} mb-4`}>{sticker}</span>
      <h2 className="max-w-3xl font-serif text-[30px] leading-[1.1] tracking-[-0.02em] text-text-primary sm:text-[42px]">
        {heading}
      </h2>
      {subheading && (
        <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8] text-text-secondary">{subheading}</p>
      )}

      <div className="mt-8">{children}</div>
    </motion.section>
  );
}
