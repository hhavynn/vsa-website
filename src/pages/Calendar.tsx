import { useCallback, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';
import { ContentUnavailableState } from '../components/common/ContentUnavailableState';
import { CalendarFilters, CalendarFilterOption } from '../components/features/calendar/CalendarFilters';
import { CalendarItemCard } from '../components/features/calendar/CalendarItemCard';
import {
  CalendarDetailModal,
  CalendarOverlayState,
} from '../components/features/calendar/CalendarDetailModal';
import { MonthGrid } from '../components/features/calendar/MonthGrid';
import { ThisWeekStrip } from '../components/features/calendar/ThisWeekStrip';
import { eventsRepository } from '../data/repos/events';
import { houseEventsRepository } from '../data/repos/houseEvents';
import { applicationLinksRepository } from '../data/repos/applicationLinks';
import { HouseName } from '../constants/houses';
import {
  CalendarCategoryFilter,
  CalendarItem,
  CalendarScope,
  addDaysToDateOnly,
  applicationToCalendarItems,
  compareCalendarItems,
  formatDayGroupLabel,
  getCalendarWindow,
  getMonthTitle,
  groupItemsByDate,
  houseEventToCalendarItem,
  isPointsEligible,
  itemOccursOn,
  matchesCategoryFilter,
  matchesScope,
  vsaEventToCalendarItem,
} from '../utils/calendar';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';
import { getSummerBreakMessage, shouldUseSummerEmptyState } from '../utils/seasonalState';
import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';

const QUERY_OPTIONS = { staleTime: 5 * 60 * 1000, retry: 1 } as const;

type CalendarView = 'board' | 'list';

const SCOPES: { key: CalendarScope; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

function SummerEmptyCard({ message }: { message: ReturnType<typeof getSummerBreakMessage> }) {
  return (
    <div className="scrapbook-empty mx-auto max-w-lg py-10 text-center">
      <span className="scrapbook-sticker scrapbook-sticker-gold mb-3 inline-flex">
        {message.badge}
      </span>
      <h2 className="font-sans text-lg font-bold" style={{ color: 'var(--text)' }}>
        {message.title}
      </h2>
      <p className="mt-2 font-sans text-[14px] leading-relaxed" style={{ color: 'var(--text2)' }}>
        {message.body}
      </p>
    </div>
  );
}

function LoadingBoard() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="scrapbook-paper h-28 animate-pulse p-4" />
      <div className="scrapbook-paper h-72 animate-pulse p-4" />
      <div className="scrapbook-paper h-24 animate-pulse p-4" />
    </div>
  );
}

export function Calendar() {
  const shouldReduceMotion = useReducedMotion();
  const todayStr = useMemo(() => getLosAngelesDateOnly(), []);
  const dataWindow = useMemo(() => getCalendarWindow(todayStr), [todayStr]);

  // ── Data (public-safe sources only) ────────────────────────────────────────
  const vsaQuery = useQuery(
    ['calendar-vsa-events', dataWindow.start, dataWindow.end],
    () =>
      eventsRepository.getEvents({
        date_from: dataWindow.start,
        // +1 day: the events.date column is a timestamp, keep the last window
        // day inclusive.
        date_to: addDaysToDateOnly(dataWindow.end, 1),
        limit: 400,
      }),
    QUERY_OPTIONS
  );
  const houseQuery = useQuery(
    ['calendar-house-events', dataWindow.start, dataWindow.end],
    () => houseEventsRepository.getPublicEventsInRange(dataWindow.start, dataWindow.end),
    QUERY_OPTIONS
  );
  const applicationsQuery = useQuery(
    ['calendar-application-links'],
    () => applicationLinksRepository.getPublicApplicationLinks(),
    QUERY_OPTIONS
  );

  const items = useMemo<CalendarItem[]>(() => {
    const collected: CalendarItem[] = [];
    for (const event of vsaQuery.data ?? []) collected.push(vsaEventToCalendarItem(event));
    for (const event of houseQuery.data ?? []) collected.push(houseEventToCalendarItem(event));
    for (const link of applicationsQuery.data ?? []) {
      for (const item of applicationToCalendarItems(link)) {
        // Keep application markers inside the visible window.
        if (item.date >= dataWindow.start && item.date <= dataWindow.end) collected.push(item);
      }
    }
    return collected.sort(compareCalendarItems);
  }, [vsaQuery.data, houseQuery.data, applicationsQuery.data, dataWindow.start, dataWindow.end]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [view, setView] = useState<CalendarView>('board');
  const [scope, setScope] = useState<CalendarScope>('upcoming');
  const [activeFilter, setActiveFilter] = useState<CalendarCategoryFilter>('all');
  const [activeHouse, setActiveHouse] = useState<HouseName | null>(null);
  const [pointsOnly, setPointsOnly] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const [year, month] = todayStr.split('-').map(Number);
    return { year, monthIndex: month - 1 };
  });
  const [overlay, setOverlay] = useState<CalendarOverlayState | null>(null);

  // Only offer filters that have real data behind them in the loaded window.
  const filterOptions = useMemo<CalendarFilterOption[]>(() => {
    const options: CalendarFilterOption[] = [{ key: 'all', label: 'All' }];
    if (items.some((i) => i.source === 'vsa')) options.push({ key: 'vsa', label: 'VSA Events' });
    if (items.some((i) => i.source === 'house')) options.push({ key: 'house', label: 'House Events' });
    if (items.some((i) => i.category === 'vcn')) options.push({ key: 'vcn', label: 'VCN' });
    if (items.some((i) => i.category === 'wildn_culture'))
      options.push({ key: 'wildn_culture', label: "Wild n' Culture" });
    if (items.some((i) => i.source === 'application'))
      options.push({ key: 'applications', label: 'Apps & Deadlines' });
    return options;
  }, [items]);

  const houseOptions = useMemo<HouseName[]>(() => {
    const names = new Set<HouseName>();
    for (const item of items) for (const house of item.houses) names.add(house.name);
    return Array.from(names);
  }, [items]);

  const showPointsToggle = useMemo(() => items.some(isPointsEligible), [items]);

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesCategoryFilter(item, activeFilter, activeHouse) &&
          (!pointsOnly || isPointsEligible(item))
      ),
    [items, activeFilter, activeHouse, pointsOnly]
  );

  const listGroups = useMemo(
    () => groupItemsByDate(filteredItems.filter((item) => matchesScope(item, scope, todayStr))),
    [filteredItems, scope, todayStr]
  );

  const weekItems = useMemo(
    () => items.filter((item) => matchesScope(item, 'week', todayStr)).sort(compareCalendarItems),
    [items, todayStr]
  );

  const upcomingThisMonth = useMemo(
    () => items.filter((item) => matchesScope(item, 'month', todayStr)).length,
    [items, todayStr]
  );

  // ── Month navigation, clamped to the loaded window ─────────────────────────
  const cursorMonthStr = `${monthCursor.year}-${String(monthCursor.monthIndex + 1).padStart(2, '0')}`;
  const canGoPrev = cursorMonthStr > dataWindow.start.slice(0, 7);
  const canGoNext = cursorMonthStr < dataWindow.end.slice(0, 7);
  const shiftMonth = (delta: number) =>
    setMonthCursor(({ year, monthIndex }) => {
      const next = new Date(year, monthIndex + delta, 1);
      return { year: next.getFullYear(), monthIndex: next.getMonth() };
    });

  const openItem = useCallback((item: CalendarItem) => setOverlay({ mode: 'item', item }), []);
  const openDay = useCallback(
    (dateStr: string) =>
      setOverlay({
        mode: 'day',
        dateStr,
        items: filteredItems.filter((item) => itemOccursOn(item, dateStr)),
      }),
    [filteredItems]
  );

  // ── Availability states ────────────────────────────────────────────────────
  const isLoading = vsaQuery.isLoading || houseQuery.isLoading || applicationsQuery.isLoading;
  const errors = [vsaQuery.error, houseQuery.error, applicationsQuery.error].filter(Boolean);
  const allFailed = errors.length === 3;
  const supabaseDown = allFailed && errors.some((e) => isSupabaseUnavailable(e));
  const summerMessage = getSummerBreakMessage('events');
  const showSummerEmpty = shouldUseSummerEmptyState(
    items.some((item) => matchesScope(item, 'upcoming', todayStr))
  );

  const resetFilters = () => {
    setActiveFilter('all');
    setActiveHouse(null);
    setPointsOnly(false);
  };

  return (
    <>
      <PageTitle title="Calendar" />

      {/* Hero */}
      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <span className="scrapbook-sticker scrapbook-sticker-teal mb-4">Planner Wall</span>
          <h1 className="vsa-page-title">Calendar</h1>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            Everything VSA in one place — GBMs, mixers, House events, VCN, Wild n&apos; Culture,
            and application deadlines. Tap anything to save it to your Google Calendar.
          </p>
          {upcomingThisMonth > 0 && (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
              {upcomingThisMonth} {upcomingThisMonth === 1 ? 'thing' : 'things'} left this month
            </p>
          )}

          {items.length > 0 && (
            <div className="mt-4">
              <CalendarFilters
                options={filterOptions}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                houseOptions={houseOptions}
                activeHouse={activeHouse}
                onHouseChange={setActiveHouse}
                pointsOnly={pointsOnly}
                onPointsOnlyChange={setPointsOnly}
                showPointsToggle={showPointsToggle}
              />
            </div>
          )}
        </div>
      </div>

      <div className="vsa-container py-8 lg:py-10">
        {allFailed ? (
          <>
            {supabaseDown && <DegradedModeBanner sourceName="calendar" className="mb-6" />}
            <ContentUnavailableState
              title="Calendar temporarily unavailable"
              message="Our live calendar is having trouble loading. Check VSA's Instagram or Linktree for the latest updates, and come back soon."
            />
          </>
        ) : isLoading ? (
          <LoadingBoard />
        ) : (
          <>
            {errors.length > 0 && (
              <DegradedModeBanner variant="inline" sourceName="some calendar" className="mb-6" />
            )}

            <ThisWeekStrip items={weekItems} todayStr={todayStr} onSelectItem={openItem} />

            {/* View toggle + month navigation */}
            <div className="mb-5 mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2" role="group" aria-label="Calendar view">
                {(
                  [
                    { key: 'board', label: '🗓 Board' },
                    { key: 'list', label: '📋 List' },
                  ] as { key: CalendarView; label: string }[]
                ).map((option) => (
                  <button
                    type="button"
                    key={option.key}
                    onClick={() => setView(option.key)}
                    aria-pressed={view === option.key}
                    className={`vsa-filter-btn ${view === option.key ? 'active' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {view === 'board' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    disabled={!canGoPrev}
                    aria-label="Previous month"
                    className="vsa-filter-btn disabled:opacity-40"
                  >
                    ←
                  </button>
                  <span className="min-w-[150px] text-center font-mono text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--text)' }}>
                    {getMonthTitle(monthCursor.year, monthCursor.monthIndex)}
                  </span>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    disabled={!canGoNext}
                    aria-label="Next month"
                    className="vsa-filter-btn disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              ) : (
                <div className="flex gap-2" role="group" aria-label="Time range">
                  {SCOPES.map((option) => (
                    <button
                      type="button"
                      key={option.key}
                      onClick={() => setScope(option.key)}
                      aria-pressed={scope === option.key}
                      className={`vsa-filter-btn ${scope === option.key ? 'active' : ''}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Empty states */}
            {items.length === 0 ? (
              showSummerEmpty ? (
                <SummerEmptyCard message={summerMessage} />
              ) : (
                <ContentUnavailableState
                  title="Nothing on the calendar yet"
                  message="New events are added throughout the year — check back soon or follow VSA on Instagram."
                />
              )
            ) : view === 'board' ? (
              <motion.div
                key={`${monthCursor.year}-${monthCursor.monthIndex}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <MonthGrid
                  year={monthCursor.year}
                  monthIndex={monthCursor.monthIndex}
                  todayStr={todayStr}
                  items={filteredItems}
                  onSelectItem={openItem}
                  onSelectDay={openDay}
                />
                <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                  Tap a day or event for details
                </p>
              </motion.div>
            ) : listGroups.length === 0 ? (
              showSummerEmpty ? (
                <SummerEmptyCard message={summerMessage} />
              ) : (
                <div className="scrapbook-empty mx-auto max-w-lg py-10 text-center">
                  <p className="font-sans text-[14px]" style={{ color: 'var(--text2)' }}>
                    Nothing matches these filters right now.
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-wider"
                    style={{ color: 'var(--brand)' }}
                  >
                    Reset filters
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-8">
                {listGroups.map((group) => (
                  <motion.section
                    key={group.dateStr}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    aria-label={formatDayGroupLabel(group.dateStr, todayStr)}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <Label className="text-brand-600 dark:text-brand-400">
                        {formatDayGroupLabel(group.dateStr, todayStr)}
                      </Label>
                      <div className="scrapbook-rule flex-1" aria-hidden />
                    </div>
                    <div className="space-y-4">
                      {group.items.map((item, index) => (
                        <CalendarItemCard key={item.key} item={item} index={index} onSelect={openItem} />
                      ))}
                    </div>
                  </motion.section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <CalendarDetailModal
        overlay={overlay}
        todayStr={todayStr}
        onClose={() => setOverlay(null)}
        onSelectItem={openItem}
      />
    </>
  );
}
