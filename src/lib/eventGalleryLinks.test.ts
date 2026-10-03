import { buildEventAlbumMap, eventAnchorId, getAlbumEventLink, parseEventAnchor } from './eventGalleryLinks';

describe('event <-> gallery links are explicit only', () => {
  describe('buildEventAlbumMap (past event -> album)', () => {
    it('maps an event to its explicitly linked album, first album winning', () => {
      expect(
        buildEventAlbumMap([
          { event_id: 'e1', google_photos_url: 'https://photos/first' },
          { event_id: 'e1', google_photos_url: 'https://photos/second' },
          { event_id: 'e2', google_photos_url: 'https://photos/other' },
        ]),
      ).toEqual({ e1: 'https://photos/first', e2: 'https://photos/other' });
    });

    it('skips albums with no event or no URL; never guesses from anything else', () => {
      expect(
        buildEventAlbumMap([
          { event_id: null, google_photos_url: 'https://photos/orphan-album' },
          { event_id: 'e3', google_photos_url: null },
          { event_id: '', google_photos_url: 'https://photos/empty-id' },
        ]),
      ).toEqual({});
    });
  });

  describe('getAlbumEventLink (album -> event)', () => {
    const event = { id: 'e1', name: 'Fall GBM', date: '2025-10-01', academic_term_id: 'term-1', is_published: true };

    it('links to the event archive for its term, anchored on the event card', () => {
      expect(getAlbumEventLink({ event_id: 'e1', event })).toEqual({
        to: `/events?term=term-1#${eventAnchorId('e1')}`,
        label: 'Fall GBM',
      });
    });

    it('uses the unassigned archive for an event with no term', () => {
      expect(getAlbumEventLink({ event_id: 'e1', event: { ...event, academic_term_id: null } })?.to).toBe(
        '/events?term=unassigned#event-e1',
      );
    });

    it('returns null without an explicit foreign key', () => {
      expect(getAlbumEventLink({ event_id: null, event: null })).toBeNull();
      // Even a joined-looking event is ignored when the album's own FK is empty.
      expect(getAlbumEventLink({ event_id: null, event })).toBeNull();
    });

    it('returns null for a draft event an admin can read through the join', () => {
      expect(getAlbumEventLink({ event_id: 'e1', event: { ...event, is_published: false } })).toBeNull();
    });

    it('treats a missing publication status as unpublished', () => {
      const { is_published: _omitted, ...withoutStatus } = event;
      expect(getAlbumEventLink({ event_id: 'e1', event: withoutStatus })).toBeNull();
    });

    it('returns null when the event row is not publicly readable', () => {
      expect(getAlbumEventLink({ event_id: 'e1', event: null })).toBeNull();
    });

    it('returns null when the joined event disagrees with the foreign key', () => {
      expect(getAlbumEventLink({ event_id: 'e2', event })).toBeNull();
    });
  });

  describe('parseEventAnchor', () => {
    it('round-trips the anchor id', () => {
      expect(parseEventAnchor(`#${eventAnchorId('abc-123')}`)).toBe('abc-123');
    });

    it('ignores other hashes', () => {
      expect(parseEventAnchor('')).toBeNull();
      expect(parseEventAnchor('#how-points-work')).toBeNull();
      expect(parseEventAnchor('#event-')).toBeNull();
    });
  });
});
