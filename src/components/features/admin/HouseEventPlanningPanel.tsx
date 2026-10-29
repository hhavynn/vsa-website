import { useMemo } from 'react';
import type { HouseEvent, HousePageAsset } from '../../../types';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { hostLabel } from '../../../lib/houseEventDashboard';
import {
  HOUSE_PLANNING_QUARTERS,
  housePlanningCsv,
  summarizeHouseEventPlanning,
  type HousePlanningQuarter,
} from '../../../lib/houseEventPlanning';
import { downloadBlob } from '../../../lib/story/storyCanvas';

const QUARTER_LABELS: Record<HousePlanningQuarter, string> = {
  fall: 'Fall',
  winter: 'Winter',
  spring: 'Spring',
};

interface HouseEventPlanningPanelProps {
  selectedYear: number | null;
  events: HouseEvent[];
  profiles: HousePageAsset[];
  today: string;
  loading: boolean;
  error: boolean;
  onRetry?: () => void;
  truncated: boolean;
}

export function HouseEventPlanningPanel({
  selectedYear,
  events,
  profiles,
  today,
  loading,
  error,
  onRetry,
  truncated,
}: HouseEventPlanningPanelProps) {
  const summary = useMemo(
    () => selectedYear === null ? null : summarizeHouseEventPlanning(events, profiles, selectedYear, today),
    [events, profiles, selectedYear, today],
  );
  const complete = !!summary && !loading && !error && !truncated;

  const exportCsv = () => {
    if (!complete || !summary) return;
    const blob = new Blob(['\uFEFF', housePlanningCsv(summary)], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `vsa-house-event-planning-${summary.year}-${summary.year + 1}.csv`);
  };

  return (
    <section className="scrapbook-paper min-w-0 p-4 sm:p-6 xl:col-span-2" aria-labelledby="house-planning-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h2 id="house-planning-heading" className="font-serif text-xl font-bold text-text-primary">
            Quarterly House event planning
          </h2>
          <p className="mt-1 font-sans text-sm leading-relaxed text-text-secondary">
            Read-only overview of House-hosted events for {selectedYear === null ? 'the selected academic year' : formatAcademicYear(selectedYear)}.
            Each collaboration counts once per hosting House, but only once in the overall event total.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            Past date means the calendar date passed, <strong>not</strong> that an event was confirmed held or that anyone attended.
            Targets and GBM requirements are not assessed here until leadership approves an official policy.
            House events do not automatically award VSA or House competition points.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!complete || summary?.rows.length === 0}
          className="min-h-11 rounded border border-brand-600 px-4 py-2 font-sans text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-400 dark:text-brand-400"
        >
          Export aggregate CSV
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">
          House event or House profile records could not be loaded. Counts and CSV export are unavailable.
          {onRetry && <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">Retry planning data</button>}
        </p>
      ) : loading || selectedYear === null ? (
        <p role="status" className="mt-4 text-sm text-text-secondary">
          {selectedYear === null ? 'Choose an academic year to view House planning.' : 'Loading quarterly event counts…'}
        </p>
      ) : truncated ? (
        <p role="alert" className="mt-4 text-sm text-amber-800 dark:text-amber-300">
          The event read reached its limit. Counts may be incomplete and CSV export is disabled.
        </p>
      ) : summary && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Planning review indicators">
            <div className="rounded border border-border-strong bg-surface2 px-3 py-3">
              <div className="text-2xs font-bold uppercase tracking-label text-text-secondary">Unique event records</div>
              <div className="mt-1 font-serif text-2xl text-text-primary">{summary.uniqueEventCount}</div>
            </div>
            <div className="rounded border border-border-strong bg-surface2 px-3 py-3">
              <div className="text-2xs font-bold uppercase tracking-label text-text-secondary">Date needs review</div>
              <div className="mt-1 font-serif text-2xl text-text-primary">{summary.dateNeedsReview}</div>
              <p className="mt-1 text-xs text-text-secondary">Missing, invalid, or outside Fall–Spring</p>
            </div>
            <div className="rounded border border-border-strong bg-surface2 px-3 py-3">
              <div className="text-2xs font-bold uppercase tracking-label text-text-secondary">Host needs review</div>
              <div className="mt-1 font-serif text-2xl text-text-primary">{summary.hostNeedsReview}</div>
              <p className="mt-1 text-xs text-text-secondary">No linked House for this year</p>
            </div>
          </div>
          {summary.dateNeedsReview + summary.hostNeedsReview > 0 && (
            <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">
              Review flagged dates and host associations in Manage House Events below before using this report.
            </p>
          )}

          {summary.rows.length === 0 ? (
            <p className="mt-4 text-sm text-text-secondary">No House profiles found for this academic year yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded border border-border-strong">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <caption className="sr-only">Per-House event counts by quarter: past-date unverified, scheduled, and unpublished drafts</caption>
                <thead className="bg-surface2 text-text-primary">
                  <tr>
                    <th scope="col" className="border-b border-border-strong px-3 py-3 font-semibold">Hosting House</th>
                    {HOUSE_PLANNING_QUARTERS.map((quarter) => (
                      <th scope="col" key={quarter} className="border-b border-border-strong px-3 py-3 font-semibold">
                        {QUARTER_LABELS[quarter]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-strong">
                  {profiles
                    .filter((profile) => profile.academic_year_start === selectedYear)
                    .map((profile) => (
                      <tr key={profile.id} className="text-text-primary">
                        <th scope="row" className="px-3 py-3 font-semibold">{hostLabel(profile)}</th>
                        {HOUSE_PLANNING_QUARTERS.map((quarter) => {
                          const count = summary.rows.find((row) => row.profileId === profile.id && row.quarter === quarter);
                          return (
                            <td key={quarter} className="px-3 py-3 align-top">
                              <div className="font-semibold">{(count?.pastUnverified ?? 0) + (count?.scheduled ?? 0) + (count?.drafts ?? 0)} total</div>
                              <div className="mt-1 text-xs leading-relaxed text-text-secondary">
                                {count?.pastUnverified ?? 0} past date (unverified)
                                <span aria-hidden="true"> · </span>
                                {count?.scheduled ?? 0} scheduled
                                <span aria-hidden="true"> · </span>
                                {count?.drafts ?? 0} draft
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-text-secondary">
            Counts describe House event records only. No automatic completion, attendance verification, or quota compliance is implied.
            The downloadable CSV contains only aggregated House and quarter counts.
          </p>
        </>
      )}
    </section>
  );
}
