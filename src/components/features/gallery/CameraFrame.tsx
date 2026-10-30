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

/**
 * The camera's button rail (shutter, dial, two keys), vertically centred on
 * the right edge of the nearest positioned ancestor. Decorative.
 */
export function CameraRail({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  const small = size === 'sm';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-1/2 flex -translate-y-1/2 flex-col items-center',
        small ? 'right-2.5 gap-1.5' : 'right-3 gap-2 sm:right-6 sm:gap-3',
        className,
      )}
    >
      <span className={cn('rounded-full bg-figma-shutter ring-[3px] ring-figma-camera-rim', small ? 'h-2.5 w-2.5' : 'h-3 w-3 sm:h-4 sm:w-4')} />
      <span className={cn('rounded-full border border-figma-camera-key bg-figma-camera-rim shadow-inner', small ? 'h-6 w-6' : 'h-8 w-8 sm:h-14 sm:w-14')} />
      <span className="flex gap-1.5 sm:gap-2">
        <span className={cn('rounded-full bg-figma-camera-key', small ? 'h-2 w-2' : 'h-2.5 w-2.5 sm:h-3.5 sm:w-3.5')} />
        <span className={cn('rounded-full bg-figma-camera-key', small ? 'h-2 w-2' : 'h-2.5 w-2.5 sm:h-3.5 sm:w-3.5')} />
      </span>
    </span>
  );
}

/**
 * The point-and-shoot camera from VSA's "Froyo With VSA" post, used to frame
 * a photo: a light plastic body, a dark screen holding `children`, and a
 * decorative button rail. `hud` adds the screen's readout (REC dot, date,
 * frame counter). The body stays light in dark mode, like the real object.
 * Everything except `children` is hidden from assistive tech.
 */
export function CameraFrame({
  children,
  hud,
  size = 'lg',
  className,
}: {
  children: ReactNode;
  hud?: { date?: string; counter?: string };
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const small = size === 'sm';
  return (
    <div
      className={cn(
        'relative bg-figma-camera shadow-[0_30px_70px_rgba(20,24,80,0.35),inset_0_-3px_0_rgba(40,53,77,0.08)] dark:bg-figma-camera-dim',
        small ? 'rounded-[18px] p-2.5 pr-11' : 'rounded-[22px] p-3 pr-[3.25rem] sm:rounded-[28px] sm:p-4 sm:pr-24',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute right-[16%] rounded-t-md bg-figma-camera-rim',
          small ? '-top-2 h-2.5 w-10' : '-top-2.5 h-3 w-14 sm:-top-3 sm:h-3.5 sm:w-20',
        )}
      />
      <div className="relative overflow-hidden rounded-md bg-figma-screen">
        {children}
        {hud && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-2.5 pt-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)] sm:px-3 sm:text-[10px]"
          >
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-figma-shutter" />
              {hud.date}
            </span>
            <span>{hud.counter}</span>
          </span>
        )}
      </div>
      <CameraRail size={size} />
    </div>
  );
}
