import type { Event } from '../../../types';

export type EventFilterKey = 'all' | 'house' | Event['event_type'];

export const PUBLIC_EVENT_FILTERS: ReadonlyArray<{ key: EventFilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'house', label: 'House Events' },
  { key: 'gbm', label: 'GBM' },
  { key: 'mixer', label: 'Mixer' },
  { key: 'vcn', label: 'VCN' },
  { key: 'winter_retreat', label: 'Retreat' },
  { key: 'wildn_culture', label: "Wild n' Culture" },
  { key: 'external_event', label: 'External' },
  { key: 'other', label: 'Other' },
];

interface PublicEventTypeFilterProps {
  value: EventFilterKey;
  onChange: (filter: EventFilterKey) => void;
}

/**
 * Keep the full set of filters one tap away on phones without forcing nine
 * small chips into the Events hero. Desktop keeps its existing filter pills.
 * URL/search state is still owned by Events.tsx.
 */
export function PublicEventTypeFilter({ value, onChange }: PublicEventTypeFilterProps) {
  return (
    <>
      <div className="mt-4 sm:hidden">
        <label
          htmlFor="public-event-type-filter"
          className="mb-1 block font-sans text-xs font-semibold text-[var(--color-text2)]"
        >
          Show events
        </label>
        <select
          id="public-event-type-filter"
          value={value}
          onChange={(event) => onChange(event.target.value as EventFilterKey)}
          className="scrapbook-select min-h-11 w-full max-w-full bg-[var(--color-surface)] font-sans text-sm"
        >
          {PUBLIC_EVENT_FILTERS.map((filter) => (
            <option key={filter.key} value={filter.key}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>
      <div
        className="vsa-filter-bar hidden sm:flex"
        role="group"
        aria-label="Filter events by type"
      >
        {PUBLIC_EVENT_FILTERS.map((filter) => (
          <button
            type="button"
            key={filter.key}
            onClick={() => onChange(filter.key)}
            aria-pressed={value === filter.key}
            className={`vsa-filter-btn ${value === filter.key ? 'active' : ''}`}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </>
  );
}
