import { HOUSE_COLORS, HouseName } from '../../../constants/houses';
import { CalendarCategoryFilter } from '../../../utils/calendar';

export interface CalendarFilterOption {
  key: CalendarCategoryFilter;
  label: string;
}

interface Props {
  options: CalendarFilterOption[];
  activeFilter: CalendarCategoryFilter;
  onFilterChange: (filter: CalendarCategoryFilter) => void;
  /** Houses that actually have events in the loaded window */
  houseOptions: HouseName[];
  activeHouse: HouseName | null;
  onHouseChange: (house: HouseName | null) => void;
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
  return (
    <div>
      <div className="vsa-filter-bar" role="group" aria-label="Filter calendar by category">
        {options.map((option) => (
          <button
            type="button"
            key={option.key}
            onClick={() => {
              onFilterChange(option.key);
              if (option.key !== 'house') onHouseChange(null);
            }}
            aria-pressed={activeFilter === option.key}
            className={`vsa-filter-btn ${activeFilter === option.key ? 'active' : ''}`}
          >
            {option.label}
          </button>
        ))}

        {showPointsToggle && (
          <button
            type="button"
            onClick={() => onPointsOnlyChange(!pointsOnly)}
            aria-pressed={pointsOnly}
            className={`vsa-filter-btn ${pointsOnly ? 'active' : ''}`}
          >
            ⭐ Points eligible
          </button>
        )}
      </div>

      {activeFilter === 'house' && houseOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter by house">
          <button
            type="button"
            onClick={() => onHouseChange(null)}
            aria-pressed={activeHouse === null}
            className={`vsa-filter-btn ${activeHouse === null ? 'active' : ''}`}
          >
            All houses
          </button>
          {houseOptions.map((house) => (
            <button
              type="button"
              key={house}
              onClick={() => onHouseChange(activeHouse === house ? null : house)}
              aria-pressed={activeHouse === house}
              className={`vsa-filter-btn ${activeHouse === house ? 'active' : ''}`}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                style={{ background: HOUSE_COLORS[house] }}
                aria-hidden
              />
              {house}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
