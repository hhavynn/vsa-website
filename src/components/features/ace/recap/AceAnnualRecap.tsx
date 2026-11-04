import React, { useMemo, useState } from 'react';
import type { AceRecapSnapshot } from '../../../../lib/aceRecap/recapSnapshot';
import { AceRecapPlayer } from './AceRecapPlayer';
import { AceRecapFamilySequence } from './AceRecapFamilySequence';

interface AceAnnualRecapProps {
  /** One reviewed snapshot per academic year; newest is shown first. */
  snapshots: readonly AceRecapSnapshot[];
  /** Optional rendered MP4 per cycle label, for visitors who prefer a video file. */
  videoUrlByCycle?: Readonly<Record<string, string>>;
}

/**
 * The ACE annual recap section. NOT routed anywhere yet: it ships only after
 * the ACE Chair approves the pairings, the official tree is published, and an
 * admin decides to release the recap (see docs/ace-annual-recap.md).
 * It refuses to render a private-preview snapshot outside development.
 */
export function AceAnnualRecap({ snapshots, videoUrlByCycle }: AceAnnualRecapProps) {
  const ordered = useMemo(
    () => [...snapshots].sort((a, b) => b.cycle.academicYearStart - a.cycle.academicYearStart),
    [snapshots],
  );
  const [selected, setSelected] = useState(0);
  const snapshot = ordered[selected];
  if (!snapshot) return null;
  if (snapshot.visibility === 'private-preview' && process.env.NODE_ENV === 'production') return null;
  const video = videoUrlByCycle?.[snapshot.cycle.label];
  return (
    <section aria-labelledby="ace-recap-heading" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-text-muted">ACE annual recap</p>
          <h2 id="ace-recap-heading" className="font-serif text-4xl text-text-primary">{snapshot.cycle.label}: a new generation</h2>
        </div>
        {ordered.length > 1 && (
          <div role="tablist" aria-label="Academic year" className="flex flex-wrap gap-2">
            {ordered.map((s, i) => (
              <button key={s.cycle.label} role="tab" type="button" aria-selected={i === selected} onClick={() => setSelected(i)}
                className={`rounded-full px-3 py-1 text-sm ${i === selected ? 'bg-brand-600 text-white' : 'border border-[var(--color-border)] text-text-secondary'}`}>
                {s.cycle.label}
              </button>
            ))}
          </div>
        )}
      </header>
      <AceRecapPlayer key={snapshot.cycle.label} snapshot={snapshot} />
      {video && (
        <p className="text-sm text-text-secondary">
          <a className="underline" href={video} download>Download the recap video</a>
        </p>
      )}
      <AceRecapFamilySequence snapshot={snapshot} />
    </section>
  );
}
