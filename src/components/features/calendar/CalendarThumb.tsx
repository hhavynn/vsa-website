import { CalendarItem } from '../../../utils/calendar';
import { OptimizedImage } from '../../common/OptimizedImage';
import { cn } from '../../../lib/utils';

interface Props {
  item: CalendarItem;
  className?: string;
  /** Requested image width; phone tiles are small, desktop flyers need more. */
  width?: number;
}

/**
 * Decorative calendar-grid flyer. Reuse shared image delivery, retaining a
 * transparent fallback so the calendar cell's category-color backdrop shows
 * when there is no image or the image cannot load.
 */
export function CalendarThumb({ item, className, width = 160 }: Props) {
  const src = item.thumbnailUrl || item.imageUrl;

  return (
    <OptimizedImage
      src={src}
      alt=""
      width={width}
      height={width}
      widths={[width, width * 2]}
      sizes={`${width}px`}
      resize="cover"
      className={cn('object-cover', className)}
    />
  );
}
