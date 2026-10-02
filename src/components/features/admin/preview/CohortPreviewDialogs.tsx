import type { CabinetMemberRaw } from '../../../../hooks/useCabinet';
import { CabinetBoard } from '../../cabinet/CabinetBoard';
import { PublicPreviewDialog } from './PublicPreviewDialog';

function Board({ members }: { members: CabinetMemberRaw[] }) {
  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      {members.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-text-muted">Nothing to show yet. Fill in a few names first.</p>
      ) : (
        <CabinetBoard members={members} revealOnScroll={false} />
      )}
    </div>
  );
}

/** The Cabinet roster as /cabinet would draw it after publishing. Writes nothing. */
export function CabinetRosterPreviewDialog({ members, yearLabel, onClose }: { members: CabinetMemberRaw[]; yearLabel: string; onClose: () => void }) {
  return (
    <PublicPreviewDialog
      title={`${yearLabel} Cabinet roster`}
      surface="/cabinet"
      notice="Draft roster — /cabinet does not change until you publish."
      onClose={onClose}
    >
      <Board members={members} />
    </PublicPreviewDialog>
  );
}

/** The intern cohort as the Interns group of /cabinet would show it. Writes nothing. */
export function InternCohortPreviewDialog({ members, yearLabel, onClose }: { members: CabinetMemberRaw[]; yearLabel: string; onClose: () => void }) {
  return (
    <PublicPreviewDialog
      title={`${yearLabel} Intern cohort`}
      surface="/cabinet · /intern-program"
      notice="Draft cohort — mentors, captions, and notes stay private. Nothing is public until you publish."
      onClose={onClose}
    >
      <Board members={members} />
    </PublicPreviewDialog>
  );
}
