import { ReactNode, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiAlertTriangle, FiCheckCircle, FiChevronDown, FiLoader, FiXCircle } from '../../../../lib/adminIcons';
import { HealthArea, HealthStatus, OverallHealth, buildHealthAreas, buildHealthWarnings } from '../../../../lib/adminHealthAreas';
import { OverviewStats } from '../../../../lib/adminOverviewStats';
import { cn } from '../../../../lib/utils';

const STATUS_TEXT: Record<HealthStatus, string> = {
  good: 'text-green-700 dark:text-green-400',
  warning: 'text-amber-700 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  neutral: 'text-text-muted',
};

const STATUS_DOT: Record<HealthStatus, string> = {
  good: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  neutral: 'bg-[var(--color-border-strong)]',
};

const STATUS_WORD: Record<HealthStatus, string> = { good: 'OK', warning: 'Needs a look', error: 'Problem', neutral: '' };

function Headline({ health }: { health: OverallHealth }) {
  const base = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-xs font-semibold';
  switch (health.state) {
    case 'loading':
      return <span className={cn(base, 'border-[var(--color-border)] text-text-secondary')}><FiLoader aria-hidden className="h-3.5 w-3.5" /> Checking…</span>;
    case 'failed':
      return <span className={cn(base, 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300')}><FiXCircle aria-hidden className="h-3.5 w-3.5" /> Could not check site health</span>;
    case 'partial':
      return <span className={cn(base, 'border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300')}><FiAlertTriangle aria-hidden className="h-3.5 w-3.5" /> Partly checked{health.issues > 0 ? ` · ${health.issues} to review` : ''}</span>;
    case 'issues':
      return <span className={cn(base, 'border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300')}><FiAlertTriangle aria-hidden className="h-3.5 w-3.5" /> {health.issues} to review</span>;
    default:
      return <span className={cn(base, 'border-green-300 text-green-800 dark:border-green-700 dark:text-green-300')}><FiCheckCircle aria-hidden className="h-3.5 w-3.5" /> All clear</span>;
  }
}

function Total({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--color-border)] bg-surface px-3 py-2.5">
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-serif text-2xl leading-none text-text-primary">{value}</dd>
      {detail && <p className="mt-1 truncate font-sans text-[11px] text-text-secondary">{detail}</p>}
    </div>
  );
}

function AreaChip({ area }: { area: HealthArea }) {
  const body = (
    <>
      <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[area.status])} />
      <span className="min-w-0 flex-1 truncate font-sans text-[13px] font-medium text-text-primary">{area.title}</span>
      <span className={cn('shrink-0 font-sans text-[11px] font-semibold', STATUS_TEXT[area.status])}>
        {area.issues > 0 ? `${area.issues} to review` : STATUS_WORD[area.status]}
      </span>
    </>
  );
  const cls = 'flex min-h-[40px] items-center gap-2 rounded-md border border-[var(--color-border)] bg-surface px-3 py-2';
  return area.to ? (
    <Link to={area.to} className={cn(cls, 'transition-colors hover:bg-surface2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function AreaDetail({ area }: { area: HealthArea }) {
  return (
    <section aria-label={`${area.title} details`} className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-surface">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <h4 className="font-sans text-sm font-semibold text-text-primary">{area.title}</h4>
        {area.to && (
          <Link to={area.to} className="font-sans text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300">
            View details →
          </Link>
        )}
      </div>
      <ul className="space-y-2 px-4 py-3">
        {area.lines.map((line) => (
          <li key={line.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[line.status])} />
              <span className="font-sans text-[13px] text-text-secondary">{line.label}</span>
            </span>
            <span className={cn('shrink-0 font-mono text-xs font-bold', STATUS_TEXT[line.status])}>
              {line.value}
              {line.status === 'warning' && <span className="sr-only"> (needs a look)</span>}
              {line.status === 'error' && <span className="sr-only"> (problem)</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Site and operations health, in three layers: a headline and the totals that are
 * always visible; warnings with links to the tool that fixes each; and a
 * collapsed details area holding every per-area count plus the operations scan.
 * A failed or partial load is stated, never shown as "all clear".
 */
export function SiteHealth({
  stats,
  health,
  unavailable,
  failed,
  operationsFailed,
  loading,
  operationsDetails,
}: {
  /** Null until the overview scan succeeds. */
  stats: OverviewStats | null;
  health: OverallHealth;
  unavailable: readonly string[];
  failed: boolean;
  operationsFailed: boolean;
  loading: boolean;
  /** The operations cards + preflight, rendered only once details are opened. */
  operationsDetails: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const areas = stats ? buildHealthAreas(stats) : [];
  const warnings = stats ? buildHealthWarnings(stats) : [];

  return (
    <section aria-labelledby="site-health-title" className="rounded-lg border border-[var(--color-border)] bg-surface2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="site-health-title" className="font-serif text-xl font-bold text-text-primary">
          Site &amp; operations health
        </h2>
        <Headline health={health} />
      </div>

      {unavailable.length > 0 && (
        <div role="status" className="mt-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 font-sans text-[13px] text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          Some counts could not be loaded ({unavailable.join(', ')}), so numbers below may be incomplete. Use Refresh counts to try again.
        </div>
      )}
      {failed && (
        <p role="alert" className="mt-3 text-sm text-text-secondary">
          Could not load site health. The tools still work; use Refresh counts to try again.
        </p>
      )}
      {operationsFailed && !failed && (
        <p className="mt-3 text-sm text-text-secondary">Operations status could not be loaded, so program checks are not included above.</p>
      )}
      {loading && !failed && <p className="mt-3 py-6 text-center text-sm text-text-muted">Loading overview...</p>}

      {stats && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Site totals">
            <Total label="Members" value={stats.members} />
            <Total label="Events" value={stats.events} detail={`${stats.upcomingEvents} upcoming`} />
            <Total label="Cabinet" value={stats.cabinetMembers} detail={`${stats.cabinetYears} years archived`} />
            <Total label="Gallery" value={stats.galleryAlbums} detail="public albums" />
            <Total label="Terms" value={stats.academicTerms} detail="academic terms" />
            <Total label="Feedback" value={stats.feedback} detail={`${stats.pendingFeedback} need follow-up`} />
          </dl>

          <div className="mt-4">
            {warnings.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2" aria-label="Data warnings">
                {warnings.map((warning) => (
                  <li key={warning.id}>
                    <Link
                      to={warning.to}
                      className="group flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-surface p-3 transition-colors hover:bg-surface2"
                    >
                      <span aria-hidden className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', warning.critical ? 'bg-red-500' : 'bg-amber-500')} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-sans text-[13px] font-semibold text-text-primary">
                          {warning.count} {warning.label}
                          {warning.critical && <span className="sr-only"> (critical)</span>}
                        </span>
                        <span className="block font-sans text-[11px] text-text-muted">Click to view and fix</span>
                      </span>
                      <span aria-hidden className="self-center text-text-muted">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : health.state === 'clear' ? (
              <p className="font-sans text-[13px] text-text-secondary">All systems normal. No critical data issues detected.</p>
            ) : null}
          </div>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Health by area">
            {areas.map((area) => (
              <li key={area.key}>
                <AreaChip area={area} />
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md font-sans text-sm font-semibold text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300"
        >
          <FiChevronDown aria-hidden className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
          {open ? 'Hide details' : 'Show details'}
        </button>
        <Link to="/admin/content-health" className="font-sans text-xs font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
          Content Health: what needs fixing →
        </Link>
      </div>

      {open && (
        <div id={panelId} className="mt-4 space-y-6">
          {stats && (
            <div>
              <h3 className="font-serif text-lg font-bold text-text-primary">Counts by area</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {areas.map((area) => (
                  <AreaDetail key={area.key} area={area} />
                ))}
              </div>
            </div>
          )}
          <div>{operationsDetails}</div>
        </div>
      )}
    </section>
  );
}
