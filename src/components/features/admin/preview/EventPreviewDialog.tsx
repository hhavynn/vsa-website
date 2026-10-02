import { useState } from 'react';
import { Label } from '../../../ui/Label';
import {
  FeaturedEventCard,
  PastEventMemoryCard,
  UpcomingEventRow,
} from '../../events/PublicEventCards';
import { ExternalEventCard } from '../../uvsa/ExternalEventCard';
import { AcademicTerm, Event, ExternalEvent } from '../../../../types';
import { PublicPreviewDialog, type PreviewPlacement } from './PublicPreviewDialog';

type EventPlacement = 'featured' | 'upcoming' | 'memory' | 'network';

const EVENT_PLACEMENTS: PreviewPlacement[] = [
  { key: 'featured', label: 'Next up' },
  { key: 'upcoming', label: 'Upcoming list' },
  { key: 'memory', label: 'Memory wall' },
];
const NETWORK_PLACEMENT: PreviewPlacement = { key: 'network', label: 'UVSA Network' };

// /events moves an event to the Memory Wall a day after it starts.
function defaultPlacement(event: Event): EventPlacement {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return new Date(event.date).getTime() < oneDayAgo ? 'memory' : 'featured';
}

function visibilityNotice(event: Event, isSaved: boolean, external?: ExternalEvent | null) {
  if (!event.is_published) {
    return 'Draft — hidden from /events, homepage previews, and Ask VSA until you publish it.';
  }
  if (external && external.show_on_network === false) {
    return 'Not listed on /uvsa-network, and the host details stay hidden on /events: "Show on UVSA Network" is off.';
  }
  return isSaved
    ? 'Unsaved changes — the live page keeps the last saved version until you save.'
    : 'Publicly visible as soon as you create it.';
}

export function EventPreviewDialog({
  event,
  terms,
  isSaved,
  external: externalListing,
  onClose,
}: {
  event: Event;
  terms: AcademicTerm[];
  /** True when previewing edits to an existing event. */
  isSaved: boolean;
  /**
   * The UVSA Network listing the form would produce for an external event,
   * built from unsaved values. Display only; nothing here is persisted.
   */
  external?: ExternalEvent | null;
  onClose: () => void;
}) {
  // A listing the admin hid is not drawn by the public pages, so neither is it here.
  const external = externalListing?.show_on_network === false ? null : externalListing;
  const placements = external ? [...EVENT_PLACEMENTS, NETWORK_PLACEMENT] : EVENT_PLACEMENTS;
  const [placement, setPlacement] = useState<EventPlacement>(() => defaultPlacement(event));

  return (
    <PublicPreviewDialog
      title={event.name}
      surface="/events"
      notice={visibilityNotice(event, isSaved, externalListing)}
      placements={placements}
      placement={placement}
      onPlacementChange={(key) => setPlacement(key as EventPlacement)}
      onClose={onClose}
    >
      {/* Same containers and section labels as src/pages/Events.tsx. */}
      <div className="vsa-container py-8 lg:py-10">
        {placement === 'featured' && (
          <>
            <Label className="mb-5 text-brand-600 dark:text-brand-400">Next Up</Label>
            <FeaturedEventCard event={event} external={external} />
          </>
        )}
        {placement === 'upcoming' && (
          <>
            <Label className="mb-0">All Upcoming</Label>
            <div className="mt-5 mb-10 grid gap-4">
              <UpcomingEventRow event={event} external={external} />
            </div>
          </>
        )}
        {placement === 'memory' && (
          <div className="mt-7">
            <Label className="mb-5">Memory Wall</Label>
            <div className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-4 [-webkit-overflow-scrolling:touch] md:grid md:snap-none md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-3">
              <PastEventMemoryCard event={event} terms={terms} index={0} external={external} />
            </div>
          </div>
        )}
        {placement === 'network' && external && (
          <div className="mt-2 max-w-md">
            <Label className="mb-5">Upcoming Externals</Label>
            <ExternalEventCard event={external} />
          </div>
        )}
      </div>
    </PublicPreviewDialog>
  );
}
