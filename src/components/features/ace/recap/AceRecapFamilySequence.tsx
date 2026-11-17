import React from 'react';
import type { AceRecapPresentation } from '../../../../lib/aceRecap/recapSnapshot';
import { displayFamilyName } from './RecapStage';

/** Text companion to the recap: every family's growth, readable without motion. */
export function AceRecapFamilySequence({ presentation, showNames = true }: { presentation: AceRecapPresentation; showNames?: boolean }) {
  const families = presentation.families.filter((f) => !f.archived);
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {families.map((fam) => {
        const byId = new Map(fam.nodes.map((n) => [n.id, n.label]));
        return (
          <li key={fam.id} className="rounded-xl border border-[var(--color-border)] bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-serif text-2xl text-text-primary">{displayFamilyName(fam.name)}</h3>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-300">+{fam.added}</span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {fam.before.people} → {fam.after.people} members · {fam.before.generations} → {fam.after.generations} generations
            </p>
            {showNames && fam.growth.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-text-primary">
                {fam.growth.map((g) => (
                  <li key={g.bigNodeId}>
                    <span className="font-medium">{g.bigLabel}</span>
                    <span className="text-text-muted"> → </span>
                    {g.littleIds.map((id) => byId.get(id)).join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
