import { YearContext } from '../../../../lib/adminYearContext';
import { cn } from '../../../../lib/utils';

/** The selected year, impossible to miss: "2026–27 · Current year" or an archive warning. */
export function YearContextBadge({ context, className }: { context: YearContext; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} data-year-kind={context.kind}>
      <span className="font-serif text-2xl font-bold text-text-primary">{context.label}</span>
      <span
        className={cn(
          'rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
          context.kind === 'archived' && 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
          context.kind === 'current' && 'border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-300',
          context.kind === 'upcoming' && 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
        )}
      >
        {context.badge}
      </span>
    </div>
  );
}
