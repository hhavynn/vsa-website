import { buildEventPreview, DRAFT_EVENT_PREVIEW_ID } from './eventPreview';

const draft = {
  name: 'Fall GBM',
  description: 'First meeting',
  location: 'PC Ballroom',
  event_type: 'gbm' as const,
  points: 10,
  start_time: '18:30',
  end_time: '20:00',
  is_published: false,
  check_in_form_url: 'https://forms.example/secret',
};

describe('buildEventPreview', () => {
  it('converts the San Diego date/time to the same ISO the save path writes', () => {
    const result = buildEventPreview({ draft, dateOnly: '2026-10-07', startTime: '18:30', imageUrl: null, thumbnailUrl: null });
    expect(result.error).toBeUndefined();
    expect(result.event?.date).toBe('2026-10-08T01:30:00.000Z');
    expect(result.event?.id).toBe(DRAFT_EVENT_PREVIEW_ID);
    expect(result.event?.is_published).toBe(false);
  });

  it('treats a missing start time as midnight, like an all-day save', () => {
    const result = buildEventPreview({ draft: { ...draft, start_time: null }, dateOnly: '2026-12-01', startTime: '', imageUrl: null, thumbnailUrl: null });
    expect(result.event?.date).toBe('2026-12-01T08:00:00.000Z');
    expect(result.event?.start_time).toBeNull();
  });

  it('never carries admin-only fields into the public shape', () => {
    const result = buildEventPreview({ draft, dateOnly: '2026-10-07', startTime: '18:30', imageUrl: null, thumbnailUrl: null });
    expect(result.event).not.toHaveProperty('check_in_form_url');
  });

  it('uses the draft image and drops a stale thumbnail when the image is removed', () => {
    const withImage = buildEventPreview({ draft, dateOnly: '2026-10-07', startTime: '', imageUrl: 'data:image/png;base64,AAAA', thumbnailUrl: 'data:image/png;base64,AAAA' });
    expect(withImage.event?.thumbnail_url).toBe('data:image/png;base64,AAAA');
    const removed = buildEventPreview({ draft, dateOnly: '2026-10-07', startTime: '', imageUrl: null, thumbnailUrl: 'https://cdn.example/thumb.webp' });
    expect(removed.event?.image_url).toBeNull();
    expect(removed.event?.thumbnail_url).toBeNull();
  });

  it('keeps the saved id when previewing edits', () => {
    const result = buildEventPreview({ draft: { ...draft, id: 'evt-1' }, dateOnly: '2026-10-07', startTime: '', imageUrl: null, thumbnailUrl: null });
    expect(result.event?.id).toBe('evt-1');
  });

  it('explains why a preview is unavailable instead of guessing a date', () => {
    expect(buildEventPreview({ draft, dateOnly: '', startTime: '', imageUrl: null, thumbnailUrl: null }).error).toMatch(/start date/);
    // 2:30am on the spring-forward day does not exist in San Diego.
    expect(buildEventPreview({ draft, dateOnly: '2027-03-14', startTime: '02:30', imageUrl: null, thumbnailUrl: null }).error).toMatch(/doesn't exist/);
  });
});
