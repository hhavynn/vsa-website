import { useState } from 'react';
import { CalendarItem } from '../../../utils/calendar';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';
import { cn } from '../../../lib/utils';

interface Props {
  item: CalendarItem;
  className?: string;
}

/**
 * Decorative event thumbnail for calendar tiles and agenda rows. Renders
 * nothing when the item has no image or the image fails to load, so the
 * caller's colored backdrop shows through instead of a broken-image icon.
 */
export function CalendarThumb({ item, className }: Props) {
  const [failed, setFailed] = useState(false);
  const src = item.thumbnailUrl || item.imageUrl;
  if (!src || failed) return null;

  return (
    <img
      src={getSupabaseImageUrl(src, { width: 160 }) || src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}
