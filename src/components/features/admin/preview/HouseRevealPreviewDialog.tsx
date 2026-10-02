import { PublicPreviewDialog } from './PublicPreviewDialog';

export interface HouseRevealPreviewHouse {
  label: string;
  members: string[];
}

/**
 * What a House reveal would create, per House — the member list the admin is
 * about to make official. Read-only: it shows the draft's state and performs no
 * writes; revealing is a separate, explicit button on the editor.
 */
export function HouseRevealPreviewDialog({
  yearLabel,
  effectiveDate,
  houses,
  notRevealed,
  onClose,
}: {
  yearLabel: string;
  effectiveDate: string;
  houses: HouseRevealPreviewHouse[];
  /** Rows that would not become a membership (no House, or no confirmed member). */
  notRevealed: number;
  onClose: () => void;
}) {
  return (
    <PublicPreviewDialog
      title={`${yearLabel} House reveal`}
      surface="/house-system"
      notice={`Memberships would start ${effectiveDate}. Nothing is created until you reveal.`}
      onClose={onClose}
    >
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <h1 className="font-serif text-3xl font-bold text-text-primary">{yearLabel} Houses</h1>
        <p className="mt-1 font-sans text-sm text-text-secondary">
          {houses.reduce((sum, house) => sum + house.members.length, 0)} members would be placed.
          {notRevealed > 0 ? ` ${notRevealed} rows would not be revealed yet (no House or no confirmed member).` : ''}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {houses.map((house) => (
            <section key={house.label} aria-label={house.label} className="rounded border border-[var(--color-border)] bg-surface p-4">
              <h2 className="font-serif text-xl font-bold text-text-primary">
                {house.label} <span className="font-mono text-sm text-text-muted">{house.members.length}</span>
              </h2>
              <ul className="mt-2 space-y-0.5 font-sans text-sm text-text-secondary">
                {house.members.map((name, index) => (
                  <li key={`${name}-${index}`}>{name}</li>
                ))}
                {house.members.length === 0 && <li className="text-text-muted">No confirmed members yet.</li>}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </PublicPreviewDialog>
  );
}
