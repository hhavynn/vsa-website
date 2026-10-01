import { Link } from 'react-router-dom';

// Static class names so Tailwind can see them; the bar rounds to the nearest 5%.
const BAR_WIDTH: Record<number, string> = {
  0: 'w-0', 5: 'w-[5%]', 10: 'w-[10%]', 15: 'w-[15%]', 20: 'w-[20%]', 25: 'w-1/4', 30: 'w-[30%]',
  35: 'w-[35%]', 40: 'w-[40%]', 45: 'w-[45%]', 50: 'w-1/2', 55: 'w-[55%]', 60: 'w-[60%]', 65: 'w-[65%]',
  70: 'w-[70%]', 75: 'w-3/4', 80: 'w-[80%]', 85: 'w-[85%]', 90: 'w-[90%]', 95: 'w-[95%]', 100: 'w-full',
};

export interface ProgressCountProps {
  label: string;
  done: number;
  total: number;
  to?: string;
}

/** "42 / 47 assigned" with a thin bar; amber until it is complete. */
export function ProgressCount({ label, done, total, to }: ProgressCountProps) {
  const complete = total > 0 && done >= total;
  const exact = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  // Never show an unfinished bar as full, or a started one as empty.
  const rounded = Math.round(exact / 5) * 5;
  const percent = !complete && rounded === 100 ? 95 : done > 0 && rounded === 0 ? 5 : rounded;
  const body = (
    <div>
      <p className="font-sans text-[13px] text-text-secondary">
        <span className="font-mono text-[13px] font-bold text-text-primary">
          {done} / {total}
        </span>{' '}
        {label}
      </p>
      <div
        className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface2"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className={`h-full rounded-full ${BAR_WIDTH[percent]} ${complete ? 'bg-green-500' : 'bg-amber-500'}`} />
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded transition-colors hover:bg-[var(--color-surface2)]">
      {body}
    </Link>
  ) : (
    body
  );
}
