import type { ReactNode } from 'react';
import type { AceRowApplication } from '../../../hooks/useAceApplicationProfiles';
import type { ApplicationProfile } from '../../../lib/aceApplicationProfiles';

const chipCls = 'rounded border border-[var(--color-border)] px-1.5 py-px font-sans text-[10px] text-[var(--color-text2)]';
const warnChipCls =
  'rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-px font-sans text-[10px] font-medium text-amber-700 dark:text-amber-400';

/** Compact signals under the Little's name: year, profile status, and advisory warnings. */
export function AceProfileChips({ application }: { application: AceRowApplication }) {
  const { little, warnings } = application;
  return (
    <ul className="mt-1 flex flex-wrap gap-1 px-1.5" aria-label="Application summary">
      {little ? (
        little.year && <li className={chipCls}>{little.year.text}</li>
      ) : (
        <li className={chipCls}>No application matched</li>
      )}
      {warnings.length > 0 && (
        <li className={warnChipCls}>
          <span aria-hidden>⚠️ </span>
          {warnings.length} {warnings.length === 1 ? 'check' : 'checks'} to review
        </li>
      )}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text3)]">{label}</dt>
      <dd className="whitespace-pre-line break-words text-[var(--color-text)]">{children}</dd>
    </div>
  );
}

function scale(value: number | null, max: number): string | null {
  return value == null ? null : `${value} / ${max}`;
}

function ProfileCard({ profile }: { profile: ApplicationProfile }) {
  const isBig = profile.role === 'big';
  const other = isBig ? 'Little' : 'Big';
  return (
    <section aria-label={`${isBig ? 'Big' : 'Little'} application: ${profile.displayName}`} className="min-w-0 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <h4 className="font-sans text-xs font-semibold text-[var(--color-text)]">
        {profile.displayName}
        <span className="ml-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.08em] text-[var(--color-text3)]">{isBig ? 'Big' : 'Little'}</span>
      </h4>
      <dl className="mt-2 grid gap-2 font-sans text-[11px] sm:grid-cols-2">
        <Field label="Year">{profile.year?.text}</Field>
        <Field label="College">{profile.college}</Field>
        <Field label="Pronouns">{profile.pronouns}</Field>
        <Field label="Gender identity">{profile.genderIdentity}</Field>
        <Field label="VSA activity">{profile.activity}</Field>
        <Field label="Introvert (1) – extrovert (10)">{scale(profile.scales.introExtro, 10)}</Field>
        <Field label="Routine (1) – spontaneous (10)">{scale(profile.scales.routine, 10)}</Field>
        <Field label="Work ethic">{scale(profile.scales.workEthic, 10)}</Field>
        <Field label="Indoors – outdoors">{scale(profile.scales.indoorOutdoor, 5)}</Field>
        <Field label="Morning or night">{profile.morningNight}</Field>
        <Field label="Friday night">{profile.fridayNight}</Field>
        {isBig && <Field label="Little capacity">{profile.capacityText}</Field>}
        {isBig && <Field label="Family / line">{profile.family}</Field>}
        <Field label={`Looking for in a ${other}`}>{profile.lookingFor}</Field>
        <Field label="Gender preference">{profile.genderPreference}</Field>
        <Field label={isBig ? 'Little same year or older?' : 'Big same year or younger?'}>{profile.yearPreference}</Field>
        {!isBig && <Field label="Sibs / twin">{profile.sibling}</Field>}
        <Field label="Hours">{profile.hours}</Field>
        <Field label={`Okay with ${other} partaking`}>
          {[profile.okWithPartaking, profile.partakingDetails].filter(Boolean).join('\n') || null}
        </Field>
        <Field label="Intends to partake">{profile.intendsToPartake}</Field>
        <Field label={`Wants their ${other} in VSA`}>{profile.wantedActivity}</Field>
        <Field label={`Other preferences for ${other}s`}>{profile.otherPreferences}</Field>
        {[...profile.favorites, ...profile.personality].map((answer) => (
          <Field key={answer.label} label={answer.label}>
            {answer.value}
          </Field>
        ))}
        <Field label="Do not pair with">{profile.doNotPair}</Field>
      </dl>
    </section>
  );
}

interface AceProfileDetailsProps {
  application: AceRowApplication;
  littleName: string;
  editable: boolean;
  busy: boolean;
  /** Picks a suggested Big through the row's normal assignment control. */
  onPickBig: (bigId: string) => void;
}

/** The expandable profile section of one assignment row. */
export function AceProfileDetails({ application, littleName, editable, busy, onPickBig }: AceProfileDetailsProps) {
  const { little, big, bigName, warnings, suggestions } = application;
  return (
    <div className="space-y-3 font-sans text-xs">
      {warnings.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">
            Advisory checks · never block Lock or Publish
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[var(--color-text)]">
            {warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]">
            Suggested Bigs · review the reasons and full applications before choosing
          </p>
          <ul className="mt-1 space-y-1" aria-label={`Suggested Bigs for ${littleName}`}>
            {suggestions.map((suggestion) => (
              <li key={suggestion.nodeId} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-[var(--color-text)]">{suggestion.name}</span>
                {suggestion.reasons.length > 0 && <span className="text-[11px] text-[var(--color-text2)]">{suggestion.reasons.join(' · ')}</span>}
                {editable && (
                  <button
                    type="button"
                    onClick={() => onPickBig(suggestion.nodeId)}
                    disabled={busy}
                    aria-label={`Assign ${suggestion.name} as Big for ${littleName}`}
                    className="bg-transparent p-0 text-[11px] font-semibold text-brand-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-brand-300"
                  >
                    Pick
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {little ? (
          <ProfileCard profile={little} />
        ) : (
          <p className="text-[var(--color-text3)]">No application matched {littleName}. Check the spelling against the unmatched list.</p>
        )}
        {big ? (
          <ProfileCard profile={big} />
        ) : (
          bigName && <p className="text-[var(--color-text3)]">No application matched {bigName}.</p>
        )}
      </div>
    </div>
  );
}
