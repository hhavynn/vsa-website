import {
  getEventLifecycleBounds,
  getEventLifecycleStatus,
  isEventUpcomingOrOngoing,
  isEventPast,
  getNextEventLifecycleTransition,
} from './eventLifecycle';
import { losAngelesDateTimeToIso } from '../utils/losAngelesDate';

describe('eventLifecycle', () => {
  // Regression examples from spec
  const eatWithVsa = {
    date: '2026-10-19',
    start_time: '17:00:00',
    end_time: '20:00:00',
    end_date: null,
  };

  const urbanMatcha = {
    date: '2026-10-20',
    start_time: '10:00:00',
    end_time: '22:00:00',
    end_date: null,
  };

  describe('Eat with VSA regression scenarios (Single-day evening event)', () => {
    it('is ongoing at Oct 19 at 7:59 PM Pacific', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-19', '19:59'));
      expect(getEventLifecycleStatus(eatWithVsa, now)).toBe('ongoing');
      expect(isEventUpcomingOrOngoing(eatWithVsa, now)).toBe(true);
      expect(isEventPast(eatWithVsa, now)).toBe(false);
    });

    it('is past at Oct 19 at 8:00 PM Pacific (exact end instant boundary)', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-19', '20:00'));
      expect(getEventLifecycleStatus(eatWithVsa, now)).toBe('past');
      expect(isEventUpcomingOrOngoing(eatWithVsa, now)).toBe(false);
      expect(isEventPast(eatWithVsa, now)).toBe(true);
    });

    it('is past on Oct 20 Pacific', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-20', '12:00'));
      expect(getEventLifecycleStatus(eatWithVsa, now)).toBe('past');
    });

    it('is upcoming before start time (Oct 19 at 4:59 PM)', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-19', '16:59'));
      expect(getEventLifecycleStatus(eatWithVsa, now)).toBe('upcoming');
    });

    it('becomes ongoing at the start instant (Oct 19 at 5:00 PM)', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-19', '17:00'));
      expect(getEventLifecycleStatus(eatWithVsa, now)).toBe('ongoing');
    });
  });

  describe('Urban Matcha Study Jams regression scenarios (Full-day event)', () => {
    it('is upcoming at Oct 20 at 9:59 AM Pacific', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-20', '09:59'));
      expect(getEventLifecycleStatus(urbanMatcha, now)).toBe('upcoming');
      expect(isEventUpcomingOrOngoing(urbanMatcha, now)).toBe(true);
    });

    it('is ongoing at Oct 20 at 10:00 AM Pacific', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-20', '10:00'));
      expect(getEventLifecycleStatus(urbanMatcha, now)).toBe('ongoing');
    });

    it('is ongoing at Oct 20 at 8:30 PM Pacific', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-20', '20:30'));
      expect(getEventLifecycleStatus(urbanMatcha, now)).toBe('ongoing');
    });

    it('is past at Oct 20 at 10:00 PM Pacific (exact end instant boundary)', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-20', '22:00'));
      expect(getEventLifecycleStatus(urbanMatcha, now)).toBe('past');
      expect(isEventPast(urbanMatcha, now)).toBe(true);
    });
  });

  describe('Next-day event', () => {
    it('is classified as upcoming', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-19', '14:00'));
      expect(getEventLifecycleStatus(urbanMatcha, now)).toBe('upcoming');
    });
  });

  describe('Multi-day events', () => {
    const retreat = {
      date: '2026-10-20',
      end_date: '2026-10-22',
      start_time: '18:00:00',
      end_time: '14:00:00',
    };

    it('is upcoming before start instant on first day', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-20', '17:59'));
      expect(getEventLifecycleStatus(retreat, now)).toBe('upcoming');
    });

    it('is ongoing during middle day', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-21', '12:00'));
      expect(getEventLifecycleStatus(retreat, now)).toBe('ongoing');
    });

    it('is ongoing on final day before end instant', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-22', '13:59'));
      expect(getEventLifecycleStatus(retreat, now)).toBe('ongoing');
    });

    it('is past on final day at and after end instant', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-22', '14:00'));
      expect(getEventLifecycleStatus(retreat, now)).toBe('past');
    });
  });

  describe('Overnight events', () => {
    const overnightParty = {
      date: '2026-10-20',
      start_time: '22:00:00',
      end_time: '02:00:00',
      end_date: null,
    };

    it('is upcoming before start time', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-20', '21:59'));
      expect(getEventLifecycleStatus(overnightParty, now)).toBe('upcoming');
    });

    it('is ongoing at 1:30 AM on the following day', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-21', '01:30'));
      expect(getEventLifecycleStatus(overnightParty, now)).toBe('ongoing');
    });

    it('becomes past at 2:00 AM on the following day', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-21', '02:00'));
      expect(getEventLifecycleStatus(overnightParty, now)).toBe('past');
    });
  });

  describe('Events with missing times', () => {
    it('keeps an event with start_time but no end_time eligible through the end of its final San Diego day', () => {
      const noEndTime = {
        date: '2026-10-20',
        start_time: '14:00:00',
        end_time: null,
        end_date: null,
      };

      // Before start
      expect(
        getEventLifecycleStatus(noEndTime, new Date(losAngelesDateTimeToIso('2026-10-20', '13:59')))
      ).toBe('upcoming');

      // Ongoing in the afternoon
      expect(
        getEventLifecycleStatus(noEndTime, new Date(losAngelesDateTimeToIso('2026-10-20', '14:00')))
      ).toBe('ongoing');

      // Ongoing late at night on the same San Diego day
      expect(
        getEventLifecycleStatus(noEndTime, new Date(losAngelesDateTimeToIso('2026-10-20', '23:59')))
      ).toBe('ongoing');

      // Past at midnight rolling into the next day
      expect(
        getEventLifecycleStatus(noEndTime, new Date(losAngelesDateTimeToIso('2026-10-21', '00:00')))
      ).toBe('past');
    });

    it('uses calendar-day classification when both start and end times are missing', () => {
      const allDayEvent = {
        date: '2026-10-20',
        start_time: null,
        end_time: null,
        end_date: null,
      };

      // Before start day
      expect(
        getEventLifecycleStatus(allDayEvent, new Date(losAngelesDateTimeToIso('2026-10-19', '23:59')))
      ).toBe('upcoming');

      // Throughout the day
      expect(
        getEventLifecycleStatus(allDayEvent, new Date(losAngelesDateTimeToIso('2026-10-20', '00:00')))
      ).toBe('ongoing');
      expect(
        getEventLifecycleStatus(allDayEvent, new Date(losAngelesDateTimeToIso('2026-10-20', '23:59')))
      ).toBe('ongoing');

      // Next day
      expect(
        getEventLifecycleStatus(allDayEvent, new Date(losAngelesDateTimeToIso('2026-10-21', '00:00')))
      ).toBe('past');
    });
  });

  describe('Legacy UTC-midnight timestamp handling', () => {
    it('correctly maps legacy UTC-midnight record to San Diego calendar date', () => {
      // Legacy record stored with UTC midnight: "2026-10-19T00:00:00Z"
      const legacyEvent = {
        date: '2026-10-19T00:00:00Z',
        start_time: '19:00:00',
        end_time: '21:00:00',
        end_date: null,
      };

      const bounds = getEventLifecycleBounds(legacyEvent);
      expect(bounds.startDate).toBe('2026-10-19');

      const ongoingNow = new Date(losAngelesDateTimeToIso('2026-10-19', '19:30'));
      expect(getEventLifecycleStatus(legacyEvent, ongoingNow)).toBe('ongoing');

      const pastNow = new Date(losAngelesDateTimeToIso('2026-10-19', '21:01'));
      expect(getEventLifecycleStatus(legacyEvent, pastNow)).toBe('past');
    });
  });

  describe('Timezone invariance', () => {
    it('classifies consistently regardless of simulated UTC or New York client instant', () => {
      // 8:30 PM PDT on Oct 20 is 03:30 UTC on Oct 21.
      const instantUtcString = '2026-10-21T03:30:00.000Z';
      const now = new Date(instantUtcString);

      // Urban Matcha (10 AM - 10 PM PDT on Oct 20) should be ongoing
      expect(getEventLifecycleStatus(urbanMatcha, now)).toBe('ongoing');

      // Eat with VSA (5 PM - 8 PM PDT on Oct 19) should be past
      expect(getEventLifecycleStatus(eatWithVsa, now)).toBe('past');
    });
  });

  describe('Daylight saving transitions', () => {
    it('handles the fall back DST change in November correctly', () => {
      const dstFallEvent = {
        date: '2026-11-01',
        start_time: '12:00:00',
        end_time: '16:00:00',
        end_date: null,
      };

      const nowOngoing = new Date(losAngelesDateTimeToIso('2026-11-01', '13:00'));
      expect(getEventLifecycleStatus(dstFallEvent, nowOngoing)).toBe('ongoing');

      const nowPast = new Date(losAngelesDateTimeToIso('2026-11-01', '16:00'));
      expect(getEventLifecycleStatus(dstFallEvent, nowPast)).toBe('past');
    });

    it('handles the spring forward DST change in March correctly', () => {
      const dstSpringEvent = {
        date: '2026-03-08',
        start_time: '10:00:00',
        end_time: '14:00:00',
        end_date: null,
      };

      const nowOngoing = new Date(losAngelesDateTimeToIso('2026-03-08', '11:00'));
      expect(getEventLifecycleStatus(dstSpringEvent, nowOngoing)).toBe('ongoing');

      const nowPast = new Date(losAngelesDateTimeToIso('2026-03-08', '14:00'));
      expect(getEventLifecycleStatus(dstSpringEvent, nowPast)).toBe('past');
    });
  });

  describe('getNextEventLifecycleTransition', () => {
    it('returns the next boundary when an event is about to end', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-19', '19:55'));
      const nextTransition = getNextEventLifecycleTransition([eatWithVsa], now);
      expect(nextTransition).not.toBeNull();

      // Next transition should be 8:00 PM Pacific (2026-10-20T03:00:00.000Z)
      expect(nextTransition?.toISOString()).toBe(losAngelesDateTimeToIso('2026-10-19', '20:00'));
    });

    it('returns midnight rollover if no event transition occurs before midnight', () => {
      const now = new Date(losAngelesDateTimeToIso('2026-10-19', '21:00'));
      const nextTransition = getNextEventLifecycleTransition([eatWithVsa], now);
      expect(nextTransition).not.toBeNull();

      // Next transition should be San Diego midnight (start of Oct 20)
      expect(nextTransition?.toISOString()).toBe(losAngelesDateTimeToIso('2026-10-20', '00:00'));
    });
  });
});
