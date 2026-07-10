import { generateSlug } from './generateSlug';

describe('generateSlug', () => {
  it('converts a string to lowercase', () => {
    expect(generateSlug('HELLO')).toBe('hello');
  });

  it('replaces spaces with hyphens', () => {
    expect(generateSlug('hello world')).toBe('hello-world');
  });

  it('removes non-word characters', () => {
    expect(generateSlug('hello, world! 123')).toBe('hello-world-123');
    expect(generateSlug('President (Internal)')).toBe('president-internal');
  });

  it('handles multiple spaces or special characters', () => {
    expect(generateSlug('   hello    world   ')).toBe('hello-world');
    expect(generateSlug('hello---world')).toBe('hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('-hello world-')).toBe('hello-world');
    expect(generateSlug('!hello world!')).toBe('hello-world');
  });

  it('works with cabinet role names', () => {
    expect(generateSlug('President')).toBe('president');
    expect(generateSlug('Internal Vice President')).toBe('internal-vice-president');
    expect(generateSlug('Co-Social Chair')).toBe('co-social-chair');
    expect(generateSlug('PR/Marketing')).toBe('prmarketing');
  });
});
