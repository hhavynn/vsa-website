import { useState } from 'react';
import { Label } from '../../../ui/Label';
import {
  FeaturedEventCard,
  PastEventMemoryCard,
  UpcomingEventRow,
} from '../../events/PublicEventCards';
import { AcademicTerm, Event } from '../../../../types';
import { PublicPreviewDialog, type PreviewPlacement } from './PublicPreviewDialog';

type EventPlacement = 'featured' | 'upcoming' | 'memory';

const PLACEMENTS: PreviewPlacement[] = [
  { key: 'featured', label: 'Next up' },
  { key: 'upcoming', label: 'Upcoming list' },
  { key: 'memory', label: 'Memory wall' },
];

// /events moves an event to the Memory Wall a day after it starts.
function defaultPlacement(event: Event): EventPlacement {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return new Date(event.date).getTime() < oneDayAgo ? 'memory' : 'featured';
}

function visibilityNotice(event: Event, isSaved: boolean) {
  if (!event.is_published) {
    return 'Draft — hidden from /events, homepage previews, and Ask VSA until you publish it.';
  }
  return isSaved
    ? 'Unsaved changes — the live page keeps the last saved version until you save.'
    : 'Publicly visible as soon as you create it.';
}

export function EventPreviewDialog({
  event,
  terms,
  isSaved,
  onClose,
}: {
  event: Event;
  terms: AcademicTerm[];
  /** True when previewing edits to an existing event. */
  isSaved: boolean;
  onClose: () => void;
}) {
  const [placement, setPlacement] = useState<EventPlacement>(() => defaultPlacement(event));

  return (
    <PublicPreviewDialog
      title={event.name}
      surface="/events"
      notice={visibilityNotice(event, isSaved)}
      placements={PLACEMENTS}
      placement={placement}
      onPlacementChange={(key) => setPlacement(key as EventPlacement)}
      onClose={onClose}
    >
      {/* Same containers and section labels as src/pages/Events.tsx. */}
      <div className="vsa-container py-8 lg:py-10">
        {placement === 'featured' && (
          <>
            <Label className="mb-5 text-brand-600 dark:text-brand-400">Next Up</Label>
            <FeaturedEventCard event={event} />
          </>
        )}
        {placement === 'upcoming' && (
          <>
            <Label className="mb-0">All Upcoming</Label>
            <div className="mt-5 mb-10 grid gap-4">
              <UpcomingEventRow event={event} />
            </div>
          </>
        )}
        {placement === 'memory' && (
          <div className="mt-7">
            <Label className="mb-5">Memory Wall</Label>
            <div className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-4 [-webkit-overflow-scrolling:touch] md:grid md:snap-none md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-3">
              <PastEventMemoryCard event={event} terms={terms} index={0} />
            </div>
          </div>
        )}
      </div>
    </PublicPreviewDialog>
  );
}
