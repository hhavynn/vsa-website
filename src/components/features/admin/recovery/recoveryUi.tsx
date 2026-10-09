import { MemberSnapshot, memberName } from '../../../../lib/attendanceRecovery';
import { Candidate, TriageTier } from '../../../../lib/recoveryTriage';
import { cn } from '../../../../lib/utils';

export const inputCls =
  'w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:focus:border-brand-400 dark:focus:ring-brand-400';
export const selectCls =
  'rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:focus:border-brand-400 dark:focus:ring-brand-400';
export const labelCls = 'mb-1 block text-xs font-medium text-[var(--color-text2)]';
export const sectionLabel = 'text-[11px] font-semibold uppercase tracking-label text-[var(--color-text3)]';
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400';
export const smallBtn = cn(
  'inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface2)] disabled:cursor-not-allowed disabled:opacity-50',
  focusRing,
);
export const primarySmallBtn = cn(
  'inline-flex items-center gap-1 rounded bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-400 dark:text-[#050810]',
  focusRing,
);
export const warnBox = 'rounded border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200';
export const errorBox = 'rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300';

export const TIER_CHIP: Record<TriageTier, string> = {
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  straightforward: 'bg-brand-600/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-400',
  ambiguous: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  incorrect_attribution: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  insufficient: 'bg-[var(--color-surface2)] text-[var(--color-text2)]',
};

export const chip = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium';

/** Base for native <progress> bars, styled with Tailwind only (no inline widths). Add a height and value color. */
export const PROGRESS_CLS =
  'block w-full appearance-none overflow-hidden rounded border-0 bg-[var(--color-surface2)] [&::-webkit-progress-bar]:bg-[var(--color-surface2)]';

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Date unknown';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Evidence tags comparing a member with the row. Words, not just color. */
export function CandidateEvidence({ candidate }: { candidate: Candidate }) {
  const tags: Array<{ label: string; tone: 'good' | 'warn' | 'bad' }> = [];
  if (candidate.emailMatches) tags.push({ label: 'Email matches the row', tone: 'good' });
  if (candidate.emailDiffers) tags.push({ label: 'Different email', tone: 'bad' });
  if (candidate.collegeDiffers) tags.push({ label: 'College differs', tone: 'warn' });
  if (candidate.yearDiffers) tags.push({ label: 'Year differs', tone: 'warn' });
  if (candidate.sharesName) tags.push({ label: 'Identical name to another member', tone: 'warn' });
  if (candidate.attended) tags.push({ label: 'Already attended this event', tone: 'warn' });
  if (tags.length === 0) return null;
  return (
    <span className="mt-0.5 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.label}
          className={cn(chip, 'px-1.5 text-[10px]',
            tag.tone === 'good' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
            tag.tone === 'warn' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
            tag.tone === 'bad' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300')}
        >
          {tag.label}
        </span>
      ))}
    </span>
  );
}

/** One member's identity: enough to tell two people with the same name apart. */
export function MemberIdentity({ member, candidate, className }: { member: MemberSnapshot; candidate?: Candidate; className?: string }) {
  const details = [member.email, member.college, member.year].filter(Boolean).join(' · ');
  return (
    <span className={cn('block min-w-0', className)}>
      <span className="block truncate font-medium text-[var(--color-text)]">{memberName(member)}</span>
      <span className="block truncate text-xs text-[var(--color-text2)]">{details || 'No email, college or year on file'}</span>
      <span className="block text-[11px] text-[var(--color-text3)]">{member.points} pts · {member.events_attended} events</span>
      {candidate && <CandidateEvidence candidate={candidate} />}
    </span>
  );
}
