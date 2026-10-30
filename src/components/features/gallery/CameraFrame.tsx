import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

/** "OCT 21 '26", the date readout on a point-and-shoot's screen. */
export function cameraDateStamp(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const label = months[Number(month) - 1];
  if (!label || !day || !year) return '';
  return `${label} ${day} '${year.slice(2)}`;
}

type CameraSize = 'sm' | 'lg';

/**
 * The back of the camera's right side: the movie button, a control wheel
 * with its arrow marks and centre button, and the play/menu keys. Vertically
 * centred on the right edge of the nearest positioned ancestor. Decorative;
 * the metal and plastic finishes live in public-editorial.css (.vsa-camera-*).
 */
export function CameraRail({ size = 'sm', className }: { size?: CameraSize; className?: string }) {
  const small = size === 'sm';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-1/2 flex -translate-y-1/2 flex-col items-center',
        small ? 'right-2 gap-1.5' : 'right-2.5 gap-2 sm:right-5 sm:gap-3',
        className,
      )}
    >
      <span className={cn('vsa-camera-rec rounded-full', small ? 'h-3 w-3' : 'h-3.5 w-3.5 sm:h-5 sm:w-5')} />
      <span
        className={cn(
          'font-sans font-bold uppercase tracking-[0.08em] text-figma-camera-ink',
          small ? 'text-[5px]' : 'text-[6px] sm:text-[8px]',
        )}
      >
        Disp
      </span>
      <span className={cn('vsa-camera-wheel relative rounded-full', small ? 'h-8 w-8' : 'h-10 w-10 sm:h-16 sm:w-16')}>
        <span className="absolute left-1/2 top-[8%] -translate-x-1/2 text-[5px] leading-none text-figma-camera-ink sm:text-[7px]">▲</span>
        <span className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-[5px] leading-none text-figma-camera-ink sm:text-[7px]">▼</span>
        <span className="absolute left-[9%] top-1/2 -translate-y-1/2 text-[5px] leading-none text-figma-camera-ink sm:text-[7px]">◀</span>
        <span className="absolute right-[9%] top-1/2 -translate-y-1/2 text-[5px] leading-none text-figma-camera-ink sm:text-[7px]">▶</span>
        <span className="vsa-camera-button absolute inset-[30%] rounded-full" />
      </span>
      <span className={cn('flex', small ? 'gap-1.5' : 'gap-2 sm:gap-3')}>
        <span className={cn('vsa-camera-button flex items-center justify-center rounded-full', small ? 'h-3 w-3' : 'h-4 w-4 sm:h-6 sm:w-6')}>
          <span className="text-[4px] leading-none text-figma-camera-ink sm:text-[6px]">▶</span>
        </span>
        <span className={cn('vsa-camera-button rounded-full', small ? 'h-3 w-3' : 'h-4 w-4 sm:h-6 sm:w-6')} />
      </span>
      <span
        className={cn(
          'font-sans font-bold uppercase tracking-[0.08em] text-figma-camera-ink',
          small ? 'text-[5px]' : 'text-[6px] sm:text-[8px]',
        )}
      >
        Menu
      </span>
    </span>
  );
}

/**
 * A pearl point-and-shoot (after VSA's "Froyo With VSA" post) framing a photo:
 * a lavender-tinted body with a shutter and power button on top, a
 * dark-bezelled glass screen holding `children`, and the control rail. `hud`
 * adds the viewfinder readout (REC dot and date, frame counter, battery). The
 * body stays light in dark mode, like the real object. Everything except
 * `children` is hidden from assistive tech.
 */
export function CameraFrame({
  children,
  hud,
  size = 'lg',
  className,
}: {
  children: ReactNode;
  hud?: { date?: string; counter?: string };
  size?: CameraSize;
  className?: string;
}) {
  const small = size === 'sm';
  return (
    <div
      className={cn(
        'vsa-camera-body relative',
        small ? 'rounded-[20px] p-2.5 pr-12' : 'rounded-[24px] p-3 pr-[3.75rem] sm:rounded-[34px] sm:p-5 sm:pr-[6.5rem]',
        className,
      )}
    >
      {/* Top plate: power button and the shutter with its zoom collar. */}
      <span
        aria-hidden="true"
        className={cn('vsa-camera-button absolute rounded-t-[4px]', small ? '-top-1 right-[38%] h-1.5 w-5' : '-top-1.5 right-[36%] h-2 w-7 sm:w-10')}
      />
      <span
        aria-hidden="true"
        className={cn('vsa-camera-shutter absolute rounded-t-full', small ? '-top-2 right-[14%] h-2.5 w-11' : '-top-2.5 right-[13%] h-3 w-14 sm:-top-3.5 sm:h-4 sm:w-20')}
      />
      {/* Speaker grille above the rail, strap lug on the right edge. */}
      <span
        aria-hidden="true"
        className={cn('vsa-camera-grille absolute', small ? 'right-3 top-1.5 h-1.5 w-6' : 'right-4 top-2 h-2 w-8 sm:right-7 sm:top-2 sm:h-2.5 sm:w-12')}
      />
      <span
        aria-hidden="true"
        className={cn('vsa-camera-button absolute top-[22%] rounded-r-full', small ? '-right-1 h-4 w-1' : '-right-1.5 h-5 w-1.5 sm:h-7')}
      />
      <span
        aria-hidden="true"
        className={cn(
          'absolute font-display italic leading-none text-figma-camera-ink',
          small ? 'bottom-1 left-3 text-[9px]' : 'bottom-1 left-4 text-[10px] sm:bottom-1.5 sm:left-6 sm:text-[13px]',
        )}
      >
        VSA
      </span>
      <div className={cn('vsa-camera-bezel', small ? 'rounded-[10px] p-1' : 'rounded-[12px] p-1.5 sm:rounded-[16px] sm:p-2')}>
        <div className="vsa-camera-glass relative overflow-hidden rounded-[5px] bg-figma-screen">
          {children}
          {hud && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex items-center justify-between px-2.5 pt-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.7)] sm:px-3 sm:text-[10px]"
            >
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-figma-shutter motion-reduce:animate-none" />
                {hud.date}
              </span>
              <span className="flex items-center gap-2">
                {hud.counter}
                <span className="relative inline-block h-[7px] w-[13px] rounded-[1.5px] border border-white/90 after:absolute after:-right-[3px] after:top-1/2 after:h-[3px] after:w-[2px] after:-translate-y-1/2 after:rounded-r-sm after:bg-white/90 after:content-['']">
                  <span className="absolute inset-[1px] right-[3px] rounded-[0.5px] bg-white/90" />
                </span>
              </span>
            </span>
          )}
        </div>
      </div>
      <CameraRail size={size} />
    </div>
  );
}
