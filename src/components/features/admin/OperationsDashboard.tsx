import { ReactNode, useMemo } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { adminOperationsRepository } from '../../../data/repos/adminOperations';
import {
  OPS_LINKS,
  OperationsInputs,
  OperationsSummary,
  buildOperationsPreflight,
  buildOperationsSummary,
  countPreflightIssues,
  formatHouseBalance,
} from '../../../lib/adminOperations';
import { buildContinueItems } from '../../../lib/adminContinue';
import { ADMIN_HEALTH_QUERY_KEYS, HEALTH_QUERY_OPTIONS } from '../../../lib/adminHealthQuery';
import { formatYearSpan } from '../../../lib/operationalStatus';
import { OperationsCard, PreflightItem, ProgressCount, StatusBadge } from './ops';

export interface OperationsDashboardProps {
  /** Injectable for tests; defaults to the live read-only loader. */
  loadInputs?: () => Promise<OperationsInputs>;
}

function Unavailable() {
  return (
    <p className="text-xs text-text-muted">
      Could not load this section. Refresh to try again.
    </p>
  );
}

function Line({ children }: { children: ReactNode }) {
  return (
    <p className="font-sans text-[13px] text-text-secondary">
      {children}
    </p>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[13px] font-bold text-text-primary">
      {children}
    </span>
  );
}

function Attention({ count, to, label = 'need attention' }: { count: number; to: string; label?: string }) {
  if (count <= 0) return null;
  return (
    <Link to={to} className="inline-block font-sans text-[13px] font-semibold text-amber-700 hover:underline dark:text-amber-400">
      {count} {label} →
    </Link>
  );
}

function formatEventDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }).format(parsed);
}

function ContinueWorking({ summary }: { summary: OperationsSummary }) {
  const items = buildContinueItems(summary);
  return (
    <section aria-label="Continue working" className="scrapbook-paper border-[var(--color-border)] bg-surface p-5">
      <h3 className="font-serif text-lg font-bold text-text-primary">Continue working</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted">Nothing is in progress. The year is caught up.</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 rounded border border-[var(--color-border)] px-3 py-2.5" data-domain={item.domain}>
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">{item.title}</p>
                <p className="mt-0.5 font-sans text-[13px] text-text-primary">{item.detail}</p>
              </div>
              <Link to={item.to} className="shrink-0 rounded border border-[var(--color-border)] px-2.5 py-1 font-sans text-xs font-semibold text-brand-700 transition-colors hover:bg-[var(--color-surface2)] dark:text-brand-300">
                {item.cta} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OperationsCards({ summary }: { summary: OperationsSummary }) {
  const { members, ace, houses, cabinet, interns, events } = summary;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <OperationsCard title="Members" to={OPS_LINKS.members} linkLabel="Admin Members">
        {members ? (
          <p className="font-serif text-[38px] leading-none text-text-primary">
            {members.total} <span className="font-sans text-sm text-text-secondary">total</span>
          </p>
        ) : (
          <Unavailable />
        )}
      </OperationsCard>

      <OperationsCard title="ACE" to={OPS_LINKS.aceAssignments} linkLabel="ACE assignments" aside={ace ? <StatusBadge status={ace.cycleStatus} /> : undefined}>
        {ace ? (
          <>
            {ace.cycleStatus ? (
              <ProgressCount label="assigned" done={ace.assigned} total={ace.littles} />
            ) : (
              <Line>No assignment cycle for {summary.yearLabel}.</Line>
            )}
            {ace.nodesTotal > 0 && <ProgressCount label="current nodes linked" done={ace.nodesLinked} total={ace.nodesTotal} />}
            <Attention count={ace.needAttention} to={OPS_LINKS.aceAssignments} />
          </>
        ) : (
          <Unavailable />
        )}
      </OperationsCard>

      <OperationsCard title="Houses" to={OPS_LINKS.houses} linkLabel="House assignments" aside={houses ? <StatusBadge status={houses.batchStatus} /> : undefined}>
        {houses ? (
          houses.batchStatus ? (
            <>
              <Line><Strong>{houses.assigned}</Strong> assigned</Line>
              <Line><Strong>{houses.unresolved}</Strong> unresolved</Line>
              {houses.balance.length > 0 && (
                <Line>
                  House balance: <Strong>{formatHouseBalance(houses.balance)}</Strong>
                </Line>
              )}
            </>
          ) : (
            <Line>No assignment batch. Houses stay unannounced until the reveal.</Line>
          )
        ) : (
          <Unavailable />
        )}
      </OperationsCard>

      <OperationsCard title="Cabinet" to={cabinet?.to ?? OPS_LINKS.cabinet} linkLabel={cabinet?.rollover && cabinet.rollover.status !== 'published' ? 'Cabinet rollover' : 'Current cabinet'}>
        {cabinet ? (
          <>
            {cabinet.positions > 0 ? (
              <>
                <ProgressCount label="positions filled" done={cabinet.filled} total={cabinet.positions} />
                <Line><Strong>{cabinet.linked}</Strong> linked</Line>
                <Line><Strong>{cabinet.needReview}</Strong> need review</Line>
              </>
            ) : (
              <Line>No roster on the active Cabinet year.</Line>
            )}
            {cabinet.rollover && cabinet.rollover.status !== 'published' && (
              <Line>
                {cabinet.rollover.yearLabel} rollover: <StatusBadge status={cabinet.rollover.status} /> {cabinet.rollover.filled} / {cabinet.rollover.positions} filled
              </Line>
            )}
          </>
        ) : (
          <Unavailable />
        )}
      </OperationsCard>

      <OperationsCard title="Interns" to={OPS_LINKS.interns} linkLabel="Admin Interns" aside={interns ? <StatusBadge status={interns.cycleStatus} /> : undefined}>
        {interns ? (
          <>
            <Line><Strong>{interns.accepted}</Strong> accepted</Line>
            <Line><Strong>{interns.linked}</Strong> linked</Line>
          </>
        ) : (
          <Unavailable />
        )}
      </OperationsCard>

      <OperationsCard title="Events" to={OPS_LINKS.events} linkLabel="Admin Events">
        {events ? (
          <>
            {events.next ? (
              <Line>
                Next: <Strong>{events.next.title}</Strong>
                {formatEventDate(events.next.date) ? ` · ${formatEventDate(events.next.date)}` : ''}
              </Line>
            ) : (
              <Line>No upcoming published events.</Line>
            )}
            <Attention count={events.upcomingMissingInfo} to={OPS_LINKS.events} label={events.upcomingMissingInfo === 1 ? 'event missing info' : 'events missing info'} />
          </>
        ) : (
          <Unavailable />
        )}
      </OperationsCard>
    </div>
  );
}

/**
 * The first thing the Cabinet sees: what the year looks like right now and what
 * needs attention, with every number linking to the tool that fixes it. Read-only.
 */
export function OperationsDashboard({ loadInputs = () => adminOperationsRepository.loadInputs() }: OperationsDashboardProps) {
  // Cached and never auto-refetched (see lib/adminHealthQuery.ts); the Overview's
  // Refresh button invalidates it. A failed load shows the unavailable state.
  const query = useQuery(ADMIN_HEALTH_QUERY_KEYS.operations, loadInputs, {
    ...HEALTH_QUERY_OPTIONS,
    onError: (error) => console.error(error),
  });
  const inputs = query.data ?? null;
  const failed = query.isError;

  const summary = useMemo(() => (inputs ? buildOperationsSummary(inputs) : null), [inputs]);
  const preflight = useMemo(() => (summary ? buildOperationsPreflight(summary) : []), [summary]);
  const issues = countPreflightIssues(preflight);
  const nextYear = (summary?.yearStart ?? new Date().getFullYear()) + 1;

  return (
    <section aria-label="Operations" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
            Operations
          </p>
          <h2 className="font-serif text-2xl font-bold text-text-primary">
            {summary ? `${summary.yearLabel} VSA Operations` : 'VSA Operations'}
          </h2>
        </div>
        <Link
          to={OPS_LINKS.yearSetup}
          className="rounded border px-3 py-1.5 font-sans text-xs font-semibold text-brand-600 transition-colors hover:bg-[var(--color-surface2)] dark:text-brand-400 border-[var(--color-border)]"
        >
          Start {formatYearSpan(nextYear)} →
        </Link>
      </div>

      {failed ? (
        <p className="rounded border px-4 py-3 text-sm border-[var(--color-border)] text-text-secondary">
          Could not load operations status. The tools below still work.
        </p>
      ) : !summary ? (
        <p className="py-6 text-center text-sm text-text-muted">
          Loading operations…
        </p>
      ) : (
        <>
          <ContinueWorking summary={summary} />
          <OperationsCards summary={summary} />

          <section
            className="scrapbook-paper p-5 border-[var(--color-border)] bg-surface"
            aria-label="Operations preflight"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-serif text-lg font-bold text-text-primary">
                {summary.yearLabel} Operations Preflight
              </h3>
              <p className="font-mono text-[11px] text-text-muted">
                {issues === 0 ? 'All clear' : `${issues} to review`} · diagnostic only
              </p>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {preflight.map((group) => (
                <div key={group.key}>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
                    {group.label}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {group.lines.map((line) => (
                      <PreflightItem key={line.id} line={line} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
