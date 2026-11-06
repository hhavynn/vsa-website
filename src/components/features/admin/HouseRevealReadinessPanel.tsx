// Protected domain — House membership. "Ready to Reveal" (#635) with member
// link coverage (#621). Read-only: it loads the active term, House Parents and
// application windows, then summarizes them with buildRevealReadiness. It
// never writes; the Reveal itself stays the editor's explicit, confirmed action.
import { useQuery } from '@tanstack/react-query';
import { academicTermsRepository } from '../../../data/repos/academicTerms';
import { applicationLinksRepository } from '../../../data/repos/applicationLinks';
import { houseParentsRepository } from '../../../data/repos/houseParents';
import type { HouseAssignmentBatch, HouseAssignmentDraft, HouseProfileLite, PreflightResult } from '../../../lib/houseAssignmentDraft';
import { READINESS_LABEL, ReadinessState, RevealReadiness, buildRevealReadiness } from '../../../lib/houseRevealReadiness';
import { cn } from '../../../lib/utils';
import { ADMIN_APPLICATION_LINKS_QUERY_KEY } from '../../../hooks/useApplicationLinks';

const TONE: Record<ReadinessState, string> = {
  complete: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300',
  needs_review: 'border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300',
  blocked: 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300',
  unknown: 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300',
};

export function useRevealReadiness(input: {
  batch: HouseAssignmentBatch;
  drafts: HouseAssignmentDraft[];
  profiles: HouseProfileLite[];
  preflight: Pick<PreflightResult, 'blockers' | 'warnings'>;
  paymentBlockers: string[] | null | undefined;
}): RevealReadiness {
  const year = input.batch.academic_year_start;
  // Only a locked batch can be revealed, so only then is readiness read.
  const enabled = input.batch.status === 'locked';
  const term = useQuery({
    queryKey: ['admin', 'active-term'],
    queryFn: () => academicTermsRepository.getActiveTerm(),
    retry: false,
    enabled,
    staleTime: 0,
  });
  const parents = useQuery({
    queryKey: ['admin', 'house-parents', year],
    queryFn: () => houseParentsRepository.listForYear(year),
    retry: false,
    enabled,
    staleTime: 0,
  });
  const links = useQuery({
    queryKey: ADMIN_APPLICATION_LINKS_QUERY_KEY,
    queryFn: () => applicationLinksRepository.listAdminApplicationLinks(),
    retry: false,
    enabled,
    staleTime: 0,
  });
  // A failed refetch is Unknown even if older data is still cached.
  const parentCounts = parents.isSuccess && parents.data
    ? parents.data.reduce((map, parent) => map.set(parent.house_profile_id, (map.get(parent.house_profile_id) ?? 0) + 1), new Map<string, number>())
    : undefined;
  return buildRevealReadiness({
    ...input,
    activeTermYear: term.isSuccess ? term.data?.academic_year_start ?? null : undefined,
    parentCounts,
    applicationLinks: links.isSuccess ? links.data : undefined,
    nowMs: Date.now(),
  });
}

export function HouseRevealReadinessPanel({ readiness, assigned, yearLabel }: { readiness: RevealReadiness; assigned: number; yearLabel: string }) {
  return (
    <section className="scrapbook-paper space-y-3 p-5 border-[var(--color-border)] bg-surface" aria-label="Ready to Reveal">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-lg font-bold text-text-primary">Ready to Reveal?</h3>
        <span className={cn('rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]', TONE[readiness.overall])} role="status">
          {readiness.overall === 'complete' ? 'Ready' : READINESS_LABEL[readiness.overall]}
        </span>
      </div>
      <ul className="space-y-2">
        {readiness.items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 rounded border p-3 border-[var(--color-border)] bg-surface2 sm:flex-row sm:items-start sm:gap-3">
            <span className={cn('w-fit shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]', TONE[item.state])}>
              {READINESS_LABEL[item.state]}
            </span>
            <span className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">{item.label}.</span> {item.detail}
            </span>
          </li>
        ))}
      </ul>
      <div className="rounded border p-3 text-xs border-[var(--color-border)] text-text-secondary">
        <p className="font-semibold text-text-primary">What the Reveal makes public</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>Each of these {assigned} members&rsquo; {yearLabel} House, in Find My Points and on House pages.</li>
          <li>Nothing else: no House points or standings (those stay embargoed and are announced at GBMs), payment status, application answers, member links under review or admin notes.</li>
        </ul>
        {!readiness.canReveal && (
          <p className="mt-2 font-semibold text-red-700 dark:text-red-300">Reveal stays disabled until nothing above is Blocked or Unknown.</p>
        )}
      </div>
    </section>
  );
}
