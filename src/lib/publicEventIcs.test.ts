import type { Event } from '../types';
import { buildPublicEventIcs } from './publicEventIcs';

const fixture = (changes: Partial<Event> = {}): Event => ({
  id: 'synthetic-vsa-event',
  name: 'VSA Community Night',
  description: 'Public event description',
  date: '2026-03-07T00:00:00Z',
  end_date: null,
  start_time: '19:00:00',
  end_time: '21:00:00',
  location: 'UC San Diego',
  is_published: true,
  ...changes,
} as Event);

function unfold(content: string): string {
  return content.replace(/\r\n[ \t]/g, '');
}

describe('published VSA calendar snapshot (#278)', () => {
  const now = new Date('2026-10-27T12:00:00Z');

  it('serializes only published rows, ignores duplicates, and never adds private fields', () => {
    const event = { ...fixture(), check_in_code: 'NEVER_EXPORT', attendance_notes: 'PRIVATE_NOTE' };
    const content = unfold(buildPublicEventIcs([
      event, event, fixture({ id: 'hidden', name: 'PRIVATE_EVENT', is_published: false }),
    ], now));
    expect(content).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2.0\r\n/);
    expect(content).toContain('DTSTAMP:20261027T120000Z');
    expect(content).toContain('UID:synthetic-vsa-event@vsaatucsd.com');
    expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(content).not.toMatch(/NEVER_EXPORT|PRIVATE_NOTE|PRIVATE_EVENT/);
    expect(content).toMatch(/END:VCALENDAR\r\n$/);
  });

  it('converts Pacific winter and summer wall times to UTC using the correct DST offset', () => {
    const text = unfold(buildPublicEventIcs([
      fixture({ id: 'winter', date: '2026-03-07T00:00:00Z' }),
      fixture({ id: 'summer', date: '2026-07-07T00:00:00Z' }),
    ], now));
    expect(text).toContain('DTSTART:20260308T030000Z\r\nDTEND:20260308T050000Z');
    expect(text).toContain('DTSTART:20260708T020000Z\r\nDTEND:20260708T040000Z');
  });

  it('exports overnight events with a next-day DTEND even without end_date', () => {
    const text = unfold(buildPublicEventIcs([
      fixture({ id: 'overnight', date: '2026-11-05', start_time: '23:00:00', end_time: '01:00:00', end_date: null }),
    ], now));
    // Pacific Standard Time: 11 PM Nov 5 to 1 AM Nov 6.
    expect(text).toContain('DTSTART:20261106T070000Z\\r\\nDTEND:20261106T090000Z'.replace(/\\r/g, '\r').replace(/\\n/g, '\n'));
  });

  it('handles all-day and multi-day events with exclusive DATE end boundaries', () => {
    const text = unfold(buildPublicEventIcs([
      fixture({ start_time: null, end_time: null, date: '2026-11-05', end_date: '2026-11-07' }),
    ], now));
    expect(text).toContain('DTSTART;VALUE=DATE:20261105\r\nDTEND;VALUE=DATE:20261108');
    expect(text).not.toContain('20261105T000000Z');
  });

  it('never injects unescaped ICS properties from names, descriptions or locations', () => {
    const text = unfold(buildPublicEventIcs([
      fixture({
        name: 'VSA, hello; world',
        description: 'Info\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:Unsafe',
        location: 'La Jolla; CA',
      }),
    ], now));
    expect(text).toContain('SUMMARY:VSA\\, hello\\; world');
    expect(text).toContain('LOCATION:La Jolla\\; CA');
    expect(text).toContain('Info\\nEND:VEVENT\\nBEGIN:VEVENT\\nSUMMARY:Unsafe');
    expect(text.match(/BEGIN:VEVENT\r\n/g)).toHaveLength(1);
  });

  it('folds UTF-8 text to at most 75 octets per physical line', () => {
    const content = buildPublicEventIcs([fixture({ name: 'Tết '.repeat(45) })], now);
    for (const line of content.trimEnd().split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(content).toContain('\r\n ');
  });

  it('does not fabricate an end time if the event has only a valid start time', () => {
    const text = unfold(buildPublicEventIcs([fixture({ end_time: null })], now));
    expect(text).toContain('DTSTART:20260308T030000Z');
    expect(text).not.toContain('DTEND:');
  });
});
