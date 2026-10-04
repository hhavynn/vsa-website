import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { AdminPageHeader } from '../../components/features/admin/AdminPageHeader';
import { EmptyState, FilterChips } from '../../components/features/admin/ops';
import { toUserMessage } from '../../data/errors';
import { adminOverviewRepository } from '../../data/repos/adminOverview';
import { contentHealthRepository } from '../../data/repos/contentHealth';
import { useUrlFilter, useUrlParam } from '../../hooks/useUrlFilter';
import { QuickFilter, applyQuickFilter, countByFilter } from '../../lib/adminFilters';
import { ADMIN_HEALTH_QUERY_KEYS, HEALTH_QUERY_OPTIONS } from '../../lib/adminHealthQuery';
import {
  ACKNOWLEDGEMENT_DAYS,
  ContentHealthFinding,
  HEALTH_AREA_LABELS,
  HealthArea,
  HealthSeverity,
  contentHealthHeadline,
} from '../../lib/contentHealth';
import { cn } from '../../lib/utils';

const SEVERITY_FILTERS: ReadonlyArray<QuickFilter<ContentHealthFinding>> = [
  { key: 'all', label: 'All', predicate: () => true },
  { key: 'high', label: 'High', hint: 'Visibly broken on a public page, or wrong information', predicate: (f) => f.severity === 'high' },
  { key: 'medium', label: 'Medium', predicate: (f) => f.severity === 'medium' },
  { key: 'low', label: 'Low', hint: 'Worth a look when you have a minute', predicate: (f) => f.severity === 'low' },
];
const SEVERITY_KEYS = SEVERITY_FILTERS.map((filter) => filter.key);

const SEVERITY_STYLE: Record<HealthSeverity, { dot: string; label: string }> = {
  high: { dot: 'bg-red-500', label: 'High' },
  medium: { dot: 'bg-amber-500', label: 'Medium' },
  low: { dot: 'bg-sky-500', label: 'Low' },
};

// Pacific time, like the rest of the site's dates, so the same finding reads the same on any machine.
const TZ = 'America/Los_Angeles';
const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : null;
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ }) : null);

const btn =
  'rounded border border-[var(--color-border)] px-3 py-1.5 font-sans text-xs font-semibold text-text-primary transition-colors hover:bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-60';

function FindingCard({ finding, busy, onAcknowledge }: { finding: ContentHealthFinding; busy: boolean; onAcknowledge: (finding: ContentHealthFinding) => void }) {
  const severity = SEVERITY_STYLE[finding.severity];
  return (
    <li data-finding-check={finding.check} className="rounded-lg border border-[var(--color-border)] bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
            <span className="inline-flex items-center gap-1.5 font-semibold text-text-secondary">
              <span aria-hidden className={cn('h-2 w-2 rounded-full', severity.dot)} />
              {severity.label}
            </span>
            <span aria-hidden>·</span>
            <span>{finding.contentType}</span>
          </div>
          <h3 className="mt-1 font-sans text-sm font-semibold leading-snug text-text-primary">{finding.title}</h3>
          <p className="mt-1 font-sans text-[13px] leading-relaxed text-text-secondary">{finding.reason}</p>
          {finding.detail && <p className="mt-1 break-all font-mono text-[11px] text-text-muted">{finding.detail}</p>}
          <p className="mt-2 font-sans text-[11px] text-text-muted">Last checked {dateTime(finding.checkedAt)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to={finding.fixPath} className={cn(btn, 'bg-brand-600 !text-white hover:!bg-brand-700 dark:bg-brand-400 dark:!text-[#050810]')}>
            {finding.check === 'ask-vsa-stale' ? 'Review snippet' : 'Fix it'} →
          </Link>
          {finding.acknowledgeable && (
            <button type="button" className={btn} disabled={busy} onClick={() => onAcknowledge(finding)} title={`Hides this for up to ${ACKNOWLEDGEMENT_DAYS} days. It comes back sooner if the content changes.`}>
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function AdminContentHealth() {
  const queryClient = useQueryClient();
  // The same cached snapshot as the Admin Overview: opening this page from the Overview costs no requests.
  const overview = useQuery(ADMIN_HEALTH_QUERY_KEYS.overview, () => adminOverviewRepository.load(), HEALTH_QUERY_OPTIONS);
  const report = overview.data?.contentHealth ?? null;
  const [severity, setSeverity] = useUrlFilter(SEVERITY_KEYS);
  const [area, setArea] = useUrlParam('area');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const areas = useMemo(() => Array.from(new Set((report?.findings ?? []).map((finding) => finding.area))).sort(), [report]);
  const inArea = useMemo(() => (report?.findings ?? []).filter((finding) => !area || finding.area === area), [report, area]);
  const counts = useMemo(() => countByFilter(inArea, SEVERITY_FILTERS), [inArea]);
  const visible = useMemo(() => applyQuickFilter(inArea, SEVERITY_FILTERS, severity), [inArea, severity]);

  async function run(key: string, action: () => Promise<void>) {
    setBusyKey(key);
    setActionError(null);
    try {
      await action();
      await queryClient.invalidateQueries(ADMIN_HEALTH_QUERY_KEYS.all);
    } catch (error) {
      console.error(error);
      setActionError(toUserMessage(error, 'That did not save. Try again.'));
    } finally {
      setBusyKey(null);
    }
  }

  const refreshing = overview.isFetching;

  return (
    <>
      <PageTitle title="Content Health" />
      <AdminPageHeader
        description="Public content that is broken, incomplete, or out of date, with the page that fixes each one. Nothing here changes or deletes anything."
        actions={
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <button type="button" className={btn} disabled={refreshing} onClick={() => queryClient.invalidateQueries(ADMIN_HEALTH_QUERY_KEYS.all)}>
              {refreshing ? 'Refreshing…' : 'Re-scan'}
            </button>
            {report && <p className="font-sans text-[11px] text-text-muted">Scanned {dateTime(report.generatedAt)}</p>}
          </div>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        {overview.isLoading ? (
          <p className="py-10 text-center text-sm text-text-muted">Checking content…</p>
        ) : !report ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">Could not run the content health scan. Use Re-scan to try again.</p>
        ) : (
          <>
            <section aria-label="Summary" className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="font-serif text-2xl font-bold text-text-primary">{report.counts.total === 0 ? 'No content health issues' : contentHealthHeadline(report.counts)}</p>
              {report.counts.total > 0 && (
                <p className="font-mono text-[11px] text-text-muted">
                  {report.counts.high} high · {report.counts.medium} medium · {report.counts.low} low
                </p>
              )}
            </section>

            {report.unchecked.length > 0 && (
              <div role="status" className="rounded border border-amber-300 bg-amber-50 px-4 py-3 font-sans text-[13px] text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                Could not check: {report.unchecked.join(', ')}. This list may be incomplete. Use Re-scan to try again.
              </div>
            )}

            <section aria-label="External link checks" className="rounded-lg border border-[var(--color-border)] bg-surface px-4 py-3 font-sans text-xs text-text-secondary">
              {!report.links.available ? (
                <p>Image and link checks are not set up yet (they need the content health migration and the weekly job). Everything else on this page is live.</p>
              ) : report.links.lastRunAt ? (
                <p>
                  Images and links were last checked {dateTime(report.links.lastRunAt)}
                  {report.links.lastRun ? `: ${report.links.lastRun.checked} checked, ${report.links.lastRun.failed} failing, ${report.links.lastRun.skipped} not checkable` : ''}.
                  {report.links.overdue && <strong className="ml-1 text-amber-700 dark:text-amber-300">That is overdue; check that the weekly job is running.</strong>}
                </p>
              ) : (
                <p>Image and link checks have not run yet. A failing image or link shows up here after the weekly job's first run.</p>
              )}
              <p className="mt-1 text-text-muted">Checks run weekly, never from this page, and skip Instagram, Google Drive/Docs/Photos and other hosts that block or mislead bots. A fixed link can show here until the next run.</p>
            </section>

            {report.findings.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <FilterChips filters={SEVERITY_FILTERS} counts={counts} active={severity} onChange={setSeverity} label="Filter by priority" />
                {areas.length > 1 && (
                  <label className="flex items-center gap-2 font-sans text-xs text-text-secondary">
                    <span>Content type</span>
                    <select
                      value={area ?? ''}
                      onChange={(event) => setArea(event.target.value || null)}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-surface2)] px-2 py-1.5 font-sans text-xs text-text-primary"
                    >
                      <option value="">All</option>
                      {areas.map((value) => (
                        <option key={value} value={value}>
                          {HEALTH_AREA_LABELS[value as HealthArea]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            {actionError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {actionError}
              </p>
            )}

            {report.findings.length === 0 ? (
              <EmptyState
                title={report.unchecked.length === 0 ? 'Nothing needs fixing' : 'Nothing found in what could be checked'}
                description={
                  report.unchecked.length === 0
                    ? 'Drafts, upcoming events, albums, program content, Ask VSA knowledge, and (when the weekly job is on) images and links all look fine.'
                    : undefined
                }
              />
            ) : visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">Nothing in this priority or content type.</p>
            ) : (
              <ul className="space-y-3" aria-label="Findings">
                {visible.map((finding) => (
                  <FindingCard
                    key={finding.key}
                    finding={finding}
                    busy={busyKey === finding.key}
                    onAcknowledge={(target) => run(target.key, () => contentHealthRepository.acknowledge(target))}
                  />
                ))}
              </ul>
            )}

            {report.acknowledged.length > 0 && (
              <details className="rounded-lg border border-[var(--color-border)] bg-surface px-4 py-3">
                <summary className="cursor-pointer font-sans text-sm font-semibold text-text-primary">Acknowledged ({report.acknowledged.length})</summary>
                <p className="mt-2 font-sans text-xs text-text-muted">Known and accepted for now. These are not counted, and each comes back by itself if the content changes or {ACKNOWLEDGEMENT_DAYS} days pass.</p>
                <ul aria-label="Acknowledged findings" className="mt-3 divide-y divide-[var(--color-border)]">
                  {report.acknowledged.map(({ finding, acknowledgedAt, expiresAt }) => (
                    <li key={finding.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-sans text-sm font-semibold text-text-primary">{finding.title}</p>
                        <p className="font-sans text-xs text-text-secondary">
                          {finding.contentType}: {finding.reason}
                        </p>
                        <p className="font-sans text-[11px] text-text-muted">
                          Acknowledged {day(acknowledgedAt) ?? 'earlier'}
                          {expiresAt ? `, until ${day(expiresAt)}` : ''}
                        </p>
                      </div>
                      <button type="button" className={btn} disabled={busyKey === finding.key} onClick={() => run(finding.key, () => contentHealthRepository.removeAcknowledgement(finding.key))}>
                        Stop ignoring
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </>
  );
}
