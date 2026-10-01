import { Link } from 'react-router-dom';

export interface ProgressCountProps {
  label: string;
  done: number;
  total: number;
  to?: string;
}

/** "42 / 47 assigned" with a thin bar; amber until it is complete. */
export function ProgressCount({ label, done, total, to }: ProgressCountProps) {
  const complete = total > 0 && done >= total;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const body = (
    <div>
      <p className="font-sans text-[13px]" style={{ color: 'var(--color-text2)' }}>
        <span className="font-mono text-[13px] font-bold" style={{ color: 'var(--color-text)' }}>
          {done} / {total}
        </span>{' '}
        {label}
      </p>
      <div
        className="mt-1 h-1 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--color-surface2)' }}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className={`h-full rounded-full ${complete ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${percent}%` }} />
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
