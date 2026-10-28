import type { ReactNode } from 'react';

/**
 * Reusable semantic wrapper for Vietnamese-language passages.
 *
 * Use this for isolated Vietnamese words, phrases, or titles inside otherwise
 * English content. Do not wrap entire English-language pages or personal names.
 */
interface VietnameseTextProps {
  children: ReactNode;
  className?: string;
}

export function VietnameseText({ children, className }: VietnameseTextProps) {
  return (
    <span lang="vi" className={className}>
      {children}
    </span>
  );
}
