import { canSave, changedFields, isDirty, isLeavingNavigation, normalizeForCompare, saveStatus, shouldWarnOnLeave } from './adminDirty';

describe('isDirty', () => {
  it('is clean when values are unchanged', () => {
    expect(isDirty({ name: 'Sweatpants', slug: 'sweatpants' }, { name: 'Sweatpants', slug: 'sweatpants' })).toBe(false);
  });

  it('is dirty when a value changes', () => {
    expect(isDirty({ name: 'Sweatpants' }, { name: 'Sweat Pants' })).toBe(true);
  });

  it('treats empty, whitespace, null and undefined as the same blank value', () => {
    expect(isDirty({ note: null }, { note: '' })).toBe(false);
    expect(isDirty({ note: undefined }, { note: '   ' })).toBe(false);
    expect(isDirty({ note: 'x' }, { note: '' })).toBe(true);
  });

  it('ignores key order and trailing whitespace', () => {
    expect(isDirty({ a: 'x ', b: 1 }, { b: 1, a: 'x' })).toBe(false);
  });

  it('detects nested and array changes', () => {
    expect(isDirty({ tags: ['a', 'b'] }, { tags: ['a', 'c'] })).toBe(true);
    expect(isDirty({ tags: ['a'] }, { tags: ['a'] })).toBe(false);
  });

  it('normalizes numbers and booleans without coercing them to blank', () => {
    expect(normalizeForCompare(0)).toBe(0);
    expect(normalizeForCompare(false)).toBe(false);
    expect(isDirty({ published: false }, { published: true })).toBe(true);
  });
});

describe('changedFields', () => {
  it('lists only the keys that differ', () => {
    expect(changedFields({ a: 1, b: 'x', c: null }, { a: 2, b: 'x', c: '' })).toEqual(['a']);
  });

  it('includes keys that exist on only one side', () => {
    expect(changedFields<Record<string, unknown>>({ a: 1 }, { a: 1, b: 'new' })).toEqual(['b']);
  });
});

describe('saveStatus / canSave', () => {
  it('disables Save when nothing changed', () => {
    const status = saveStatus({ dirty: false, saving: false, failed: false, justSaved: false });
    expect(status).toBe('clean');
    expect(canSave(status)).toBe(false);
  });

  it('enables Save when dirty', () => {
    const status = saveStatus({ dirty: true, saving: false, failed: false, justSaved: false });
    expect(status).toBe('dirty');
    expect(canSave(status)).toBe(true);
  });

  it('shows Saved after success until the next edit', () => {
    expect(saveStatus({ dirty: false, saving: false, failed: false, justSaved: true })).toBe('saved');
    expect(saveStatus({ dirty: true, saving: false, failed: false, justSaved: true })).toBe('dirty');
  });

  it('keeps the form editable and retryable after a failed save', () => {
    const status = saveStatus({ dirty: true, saving: false, failed: true, justSaved: false });
    expect(status).toBe('error');
    expect(canSave(status)).toBe(true);
  });

  it('does not allow a second save while one is running', () => {
    const status = saveStatus({ dirty: true, saving: true, failed: false, justSaved: false });
    expect(status).toBe('saving');
    expect(canSave(status)).toBe(false);
  });
});

describe('shouldWarnOnLeave', () => {
  it('warns while dirty or saving', () => {
    expect(shouldWarnOnLeave(true, false)).toBe(true);
    expect(shouldWarnOnLeave(false, true)).toBe(true);
    expect(shouldWarnOnLeave(false, false)).toBe(false);
  });
});

describe('isLeavingNavigation', () => {
  const plain = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  const here = 'https://vsa.test/admin/ace?view=assignments';

  it('prompts for an in-app link to another page', () => {
    expect(isLeavingNavigation(plain, { href: '/admin/houses' }, here)).toBe(true);
    expect(isLeavingNavigation(plain, { href: 'https://vsa.test/admin/ace?view=families' }, here)).toBe(true);
  });

  it('does not prompt for a same-page hash jump', () => {
    expect(isLeavingNavigation(plain, { href: '/admin/ace?view=assignments#row-4' }, here)).toBe(false);
  });

  it('does not prompt for new-tab, modified, non-primary, or prevented clicks', () => {
    expect(isLeavingNavigation(plain, { href: '/admin/houses', target: '_blank' }, here)).toBe(false);
    expect(isLeavingNavigation({ ...plain, metaKey: true }, { href: '/admin/houses' }, here)).toBe(false);
    expect(isLeavingNavigation({ ...plain, button: 1 }, { href: '/admin/houses' }, here)).toBe(false);
    expect(isLeavingNavigation({ ...plain, defaultPrevented: true }, { href: '/admin/houses' }, here)).toBe(false);
  });

  it('does not prompt for downloads or other origins', () => {
    expect(isLeavingNavigation(plain, { href: '/file.csv', hasAttribute: (n) => n === 'download' }, here)).toBe(false);
    expect(isLeavingNavigation(plain, { href: 'https://other.example/x' }, here)).toBe(false);
  });
});
