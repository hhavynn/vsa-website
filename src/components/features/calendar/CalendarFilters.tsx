import type { CalendarHouseTag } from '../../../utils/calendar';
import { CalendarCategoryFilter } from '../../../utils/calendar';
import { cn } from '../../../lib/utils';

export interface CalendarFilterOption {
  key: CalendarCategoryFilter;
  label: string;
}

interface Props {
  options: CalendarFilterOption[];
  activeFilter: CalendarCategoryFilter;
  onFilterChange: (filter: CalendarCategoryFilter) => void;
  /** Houses that actually have events in the loaded window */
  houseOptions: Pick<CalendarHouseTag, 'name' | 'color'>[];
  activeHouse: string | null;
  onHouseChange: (house: string | null) => void;
  pointsOnly: boolean;
  onPointsOnlyChange: (value: boolean) => void;
  /** Hide the points toggle when nothing in the window is points-eligible */
  showPointsToggle: boolean;
}

export function CalendarFilters({
  options,
  activeFilter,
  onFilterChange,
  houseOptions,
  activeHouse,
  onHouseChange,
  pointsOnly,
  onPointsOnlyChange,
  showPointsToggle,
}: Props) {
  const changeCategory = (category: CalendarCategoryFilter) => {
    onFilterChange(category);
    // A House-host selection cannot silently keep excluding other categories.
    if (category !== 'house') onHouseChange(null);
  };

  return (
    <div>
      {/* The native selector fits one-handed phones without wrapping a dozen chips.
          The desktop buttons remain unchanged; both drive exactly the same state. */}
      <div className="sm:hidden">
        <label htmlFor="calendar-mobile-category" className="mb-1 block font-sans text-xs font-semibold text-text-secondary">
          Show calendar
        </label>
        <select
          id="calendar-mobile-category"
          value={activeFilter}
          onChange={(event) => changeCategory(event.target.value as CalendarCategoryFilter)}
          className="scrapbook-select min-h-11 w-full max-w-full"
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
        {showPointsToggle && (
          <button
            type="button"
            onClick={() => onPointsOnlyChange(!pointsOnly)}
            aria-pressed={pointsOnly}
            className={cn('vsa-filter-btn mt-2 min-h-11 w-full', pointsOnly && 'active')}
          >
            ⭐ Points eligible
          </button>
        )}
      </div>

      <div className="vsa-filter-bar mt-0 hidden gap-1.5 sm:flex sm:gap-2" role="group" aria-label="Filter calendar by category">
        {options.map((option) => (
          <button
            type="button"
            key={option.key}
            onClick={() => changeCategory(option.key)}
            aria-pressed={activeFilter === option.key}
            className={cn('vsa-filter-btn px-3 py-1.5', activeFilter === option.key && 'active')}
          >
            {option.label}
          </button>
        ))}
        {showPointsToggle && (
          <button
            type="button"
            onClick={() => onPointsOnlyChange(!pointsOnly)}
            aria-pressed={pointsOnly}
            className={cn('vsa-filter-btn px-3 py-1.5', pointsOnly && 'active')}
          >
            ⭐ Points eligible
          </button>
        )}
      </div>

      {activeFilter === 'house' && houseOptions.length > 0 && (
        <>
          <div className="mt-3 sm:hidden">
            <label htmlFor="calendar-mobile-house" className="mb-1 block font-sans text-xs font-semibold text-text-secondary">
              House host
            </label>
            <select
              id="calendar-mobile-house"
              value={activeHouse ?? ''}
              onChange={(event) => onHouseChange(event.target.value || null)}
              className="scrapbook-select min-h-11 w-full max-w-full"
            >
              <option value="">All houses</option>
              {houseOptions.map((house) => (
                <option key={house.name} value={house.name}>{house.name}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 hidden flex-wrap gap-2 sm:flex" role="group" aria-label="Filter by house">
            <button
              type="button"
              onClick={() => onHouseChange(null)}
              aria-pressed={activeHouse === null}
              className={cn('vsa-filter-btn px-3 py-1.5', activeHouse === null && 'active')}
            >
              All houses
            </button>
            {houseOptions.map((house) => (
              <button
                type="button"
                key={house.name}
                onClick={() => onHouseChange(activeHouse === house.name ? null : house.name)}
                aria-pressed={activeHouse === house.name}
                className={cn('vsa-filter-btn px-3 py-1.5', activeHouse === house.name && 'active')}
              >
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: house.color }}
                  aria-hidden
                />
                {house.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
