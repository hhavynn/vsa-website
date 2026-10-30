import { cn } from '../../lib/utils';

/**
 * The long-armed four-point star from VSA's own graphics (the 2026–27
 * Cabinet reveal, the Senior Send Off and Froyo posts). Purely decorative:
 * hidden from assistive tech, sized and placed by the caller. `glow` adds the
 * soft halo those posts give their stars.
 */
export function Sparkle({ className, glow = false }: { className?: string; glow?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      className={cn(
        'pointer-events-none fill-current',
        glow && 'drop-shadow-[0_0_10px_rgba(255,255,255,0.85)]',
        className,
      )}
    >
      <path d="M50 0C52 34 66 48 100 50 66 52 52 66 50 100 48 66 34 52 0 50 34 48 48 34 50 0Z" />
    </svg>
  );
}
