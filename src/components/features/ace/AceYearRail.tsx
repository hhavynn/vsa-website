import { bandRect } from '../../../lib/aceTreeLayout';
import { formatPickupAcademicYear, formatPickupAcademicYearShort } from '../../../lib/acePickupYear';
import type { BandKey, YearBand, treeMetrics } from '../../../lib/aceTreeLayout';

interface AceYearRailProps {
  bands: YearBand[];
  metrics: ReturnType<typeof treeMetrics>;
  offsetX: number;
  zoom: number;
  focusKey: BandKey | null;
  railWidth: number;
}

/**
 * The rail lives INSIDE the transformed canvas, not a viewport overlay.
 * Negative X cancels pan, inverse zoom keeps text readable, and every
 * label's vertical position uses the exact bandRect of the SVG guides.
 */
export function AceYearRail({
  bands, metrics, offsetX, zoom, focusKey, railWidth,
}: AceYearRailProps) {
  if (bands.length === 0) return null;
  return (
    <div
      className="ace-year-rail"
      aria-hidden="true"
      style={{
        width: railWidth / zoom,
        height: metrics.padY * 2 + bands.reduce((sum, band) => sum + band.rowCount, 0) * metrics.unitY,
        transform: 'translateX(' + (-offsetX / zoom) + 'px)',
      }}
    >
      {bands.map((band, index) => {
        const rect = bandRect(band, metrics);
        const unknown = band.key === 'unknown';
        return (
          <span
            className={
              'ace-year-label' + (unknown ? ' is-unknown' : '') +
              (focusKey === band.key ? ' is-focus' : '') +
              (index % 2 ? ' is-alt' : '')
            }
            key={String(band.key)}
            data-band-key={String(band.key)}
            style={{
              top: rect.top + rect.height / 2,
              left: 8 / zoom,
              transform: 'translateY(-50%) scale(' + (1 / zoom) + ')',
              transformOrigin: 'left center',
            }}
          >
            {unknown ? (
              <><span className="ace-year-full">Unknown pickup year</span><span className="ace-year-short">Unknown</span></>
            ) : (
              <>
                <span className="ace-year-full">{formatPickupAcademicYear(band.academicYearStart!)}</span>
                <span className="ace-year-short">{formatPickupAcademicYearShort(band.academicYearStart!)}</span>
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

