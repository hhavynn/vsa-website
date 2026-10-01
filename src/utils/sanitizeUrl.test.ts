import { sanitizeHref, sanitizeImageSrc } from './sanitizeUrl';

describe('sanitizeHref', () => {
  it('allows https URLs', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com/');
  });

  it('allows http URLs', () => {
    expect(sanitizeHref('http://example.com')).toBe('http://example.com/');
  });

  it('preserves path and query', () => {
    expect(sanitizeHref('https://example.com/path?q=1#h')).toBe('https://example.com/path?q=1#h');
  });

  it('allows site-relative paths', () => {
    expect(sanitizeHref('/events')).toBe('/events');
  });

  it('blocks javascript: URLs', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('#');
  });

  it('blocks JAVASCRIPT: (case-insensitive)', () => {
    expect(sanitizeHref('JAVASCRIPT:alert(1)')).toBe('#');
  });

  it('blocks vbscript: URLs', () => {
    expect(sanitizeHref('vbscript:msgbox("xss")')).toBe('#');
  });

  it('blocks data: URLs', () => {
    expect(sanitizeHref('data:text/html,<script>alert(1)</script>')).toBe('#');
  });

  it('blocks data:image/ URLs (href context)', () => {
    expect(sanitizeHref('data:image/png;base64,abc')).toBe('#');
  });

  it('blocks protocol-relative URLs', () => {
    expect(sanitizeHref('//evil.com')).toBe('#');
  });

  it('returns # for empty string', () => {
    expect(sanitizeHref('')).toBe('#');
  });

  it('returns # for whitespace', () => {
    expect(sanitizeHref('   ')).toBe('#');
  });

  it('trims whitespace from valid URLs', () => {
    expect(sanitizeHref('  https://example.com  ')).toBe('https://example.com/');
  });

  it('returns # for malformed URLs', () => {
    expect(sanitizeHref('not a url at all')).toBe('#');
  });
});

describe('sanitizeImageSrc', () => {
  it('allows https image URLs', () => {
    expect(sanitizeImageSrc('https://cdn.example.com/img.png')).toBe('https://cdn.example.com/img.png');
  });

  it('allows data:image/ URIs', () => {
    const dataUri = 'data:image/png;base64,iVBOR';
    expect(sanitizeImageSrc(dataUri)).toBe(dataUri);
  });

  it('allows data:image/jpeg URIs', () => {
    const dataUri = 'data:image/jpeg;base64,/9j/4AAQ';
    expect(sanitizeImageSrc(dataUri)).toBe(dataUri);
  });

  it('allows blob: URIs', () => {
    expect(sanitizeImageSrc('blob:http://localhost:3000/abc-123')).toBe(
      'blob:http://localhost:3000/abc-123',
    );
  });

  it('allows relative paths', () => {
    expect(sanitizeImageSrc('/images/logo.png')).toBe('/images/logo.png');
  });

  it('blocks javascript: URLs', () => {
    expect(sanitizeImageSrc('javascript:alert(1)')).toBe('');
  });

  it('blocks data:text/html', () => {
    expect(sanitizeImageSrc('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeImageSrc('')).toBe('');
  });
});
