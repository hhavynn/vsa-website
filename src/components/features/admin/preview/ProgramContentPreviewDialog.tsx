import { ProgramContentCallout } from '../../program/ProgramContentCallout';
import { ProgramContent } from '../../../../types';
import { PublicPreviewDialog } from './PublicPreviewDialog';

/** How a program page renders its status callout (see Internship/House pages). */
export interface ProgramCalloutSurface {
  path: string;
  defaultTitle: string;
  defaultLinkLabel: string;
}

export function ProgramContentPreviewDialog({
  content,
  label,
  surface,
  onClose,
}: {
  content: ProgramContent;
  label: string;
  surface: ProgramCalloutSurface;
  onClose: () => void;
}) {
  return (
    <PublicPreviewDialog
      title={label}
      surface={surface.path}
      notice={
        content.is_published
          ? `Unsaved changes — ${surface.path} keeps the last saved version until you save.`
          : `Draft — not shown on ${surface.path} until Published is checked and saved.`
      }
      onClose={onClose}
    >
      {/* Same section wrappers the program pages use around the callout. */}
      <div className="program-app">
        <section className="program-section">
          <div className="program-section-inner">
            <ProgramContentCallout
              content={content}
              defaultTitle={surface.defaultTitle}
              defaultLinkLabel={surface.defaultLinkLabel}
            />
          </div>
        </section>
      </div>
    </PublicPreviewDialog>
  );
}
