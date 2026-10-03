import type { Event } from '../types';
import { NEVER_COPIED_EVENT_FIELDS, buildDuplicateEventDraft } from './adminEventDuplicate';

const source: Event = {
  id: 'evt-1',
  name: 'GBM 1',
  description: 'First general body meeting',
  date: '2026-10-08T01:00:00Z',
  start_time: '18:00',
  end_time: '20:00',
  end_date: '2026-10-09',
  location: 'Price Center',
  points: 3,
  event_type: 'gbm',
  check_in_form_url: 'https://forms.example/secret',
  image_url: 'https://img.example/a.png',
  thumbnail_url: 'https://img.example/a-t.png',
  is_published: true,
  academic_term_id: 'term-fall-26',
  interest_counts: { event_id: 'evt-1', interested_count: 40, going_count: 20, updated_at: '' },
};

describe('buildDuplicateEventDraft', () => {
  const draft = buildDuplicateEventDraft(source);

  it('copies the useful structure', () => {
    expect(draft).toMatchObject({ description: 'First general body meeting', event_type: 'gbm', points: 3, start_time: '18:00', end_time: '20:00', location: 'Price Center' });
    expect(draft.name).toBe('GBM 1 (copy)');
  });

  it('defaults the copy to Draft and requires a new date', () => {
    expect(draft.is_published).toBe(false);
    expect(draft.date).toBe('');
  });

  it('never copies attendance-adjacent or identifying data', () => {
    const copied = Object.keys(draft);
    for (const field of ['id', 'image_url', 'thumbnail_url', 'interest_counts']) {
      expect(copied).not.toContain(field);
    }
    expect(draft.check_in_form_url).toBe('');
    expect(draft.end_date).toBeNull();
    expect(draft.academic_term_id).toBeNull();
    expect(JSON.stringify(draft)).not.toContain('secret');
  });

  it('documents every field that must not travel', () => {
    for (const field of NEVER_COPIED_EVENT_FIELDS) {
      const value = (draft as unknown as Record<string, unknown>)[field];
      expect(value === undefined || value === '' || value === null || value === false).toBe(true);
    }
  });

  it('tolerates an event with no description or location', () => {
    expect(buildDuplicateEventDraft({ ...source, description: null, location: null })).toMatchObject({ description: '', location: '' });
  });
});
