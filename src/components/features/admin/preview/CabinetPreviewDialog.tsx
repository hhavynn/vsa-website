import { type CabinetMemberRaw } from '../../../../hooks/useCabinet';
import { CabinetBoard } from '../../cabinet/CabinetBoard';
import { PublicPreviewDialog } from './PublicPreviewDialog';

export function CabinetPreviewDialog({
  members,
  memberName,
  yearLabel,
  isSaved,
  onClose,
}: {
  /** Full board for the year, draft included (see buildCabinetPreviewMembers). */
  members: CabinetMemberRaw[];
  memberName: string;
  yearLabel: string | null;
  /** True when previewing edits to an existing member. */
  isSaved: boolean;
  onClose: () => void;
}) {
  return (
    <PublicPreviewDialog
      title={`${memberName || 'New member'}${yearLabel ? ` · ${yearLabel} Cabinet` : ''}`}
      surface="/cabinet"
      notice={
        isSaved
          ? 'Unsaved changes — /cabinet keeps the last saved version until you save.'
          : 'Not added yet — this member appears on /cabinet as soon as you save.'
      }
      onClose={onClose}
    >
      {/* Same board container as src/pages/Cabinet.tsx. */}
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <CabinetBoard members={members} revealOnScroll={false} />
      </div>
    </PublicPreviewDialog>
  );
}
