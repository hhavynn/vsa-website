import { classifyAssistantLink } from './assistantLinkSafety';

describe('model-generated assistant link trust boundary (#241)', () => {
  it('routes same-site paths internally and safe http(s) URLs externally', () => {
    expect(classifyAssistantLink('/events')).toEqual({ kind: 'internal', href: '/events' });
    expect(classifyAssistantLink('/house?year=2026')).toEqual({ kind: 'internal', href: '/house?year=2026' });
    expect(classifyAssistantLink('https://linktr.ee/example')).toEqual({
      kind: 'external', href: 'https://linktr.ee/example',
    });
    expect(classifyAssistantLink('http://example.org')).toEqual({
      kind: 'external', href: 'http://example.org/',
    });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'vbscript:alert(1)',
    'file:///etc/passwd',
    '//evil.example.com',
    'mailto:admin@example.org',
    '',
    '   ',
  ])('never turns hostile or unsupported %s into a clickable link', (url) => {
    expect(classifyAssistantLink(url)).toEqual({ kind: 'text', href: null });
  });

  it('preserves existing encoded escapes and neutralizes backslash host tricks', () => {
    expect(classifyAssistantLink('https://forms.gle/a%20b"x')).toEqual({
      kind: 'external', href: 'https://forms.gle/a%20b%22x',
    });
    expect(classifyAssistantLink('/\\evil.example')).toEqual({
      kind: 'internal', href: '/%5Cevil.example',
    });
  });

  it('does not allow whitespace-trimmed protocol-relative links', () => {
    expect(classifyAssistantLink(' //evil.example/path ')).toEqual({
      kind: 'text', href: null,
    });
  });
});
