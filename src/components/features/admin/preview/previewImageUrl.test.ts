import { safePreviewImageUrl } from './previewImageUrl';

describe('safePreviewImageUrl', () => {
  it('keeps http(s) URLs, same-site paths, and local image data', () => {
    expect(safePreviewImageUrl(' https://cdn.example/a%20b.jpg ')).toBe('https://cdn.example/a%20b.jpg');
    expect(safePreviewImageUrl('/images/presidents.jpg')).toBe('/images/presidents.jpg');
    expect(safePreviewImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('renders no image for script, protocol-relative, or non-image data URLs', () => {
    expect(safePreviewImageUrl('javascript:alert(1)')).toBe('');
    expect(safePreviewImageUrl('//evil.example/x.png')).toBe('');
    expect(safePreviewImageUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('');
    expect(safePreviewImageUrl('not a url')).toBe('');
    expect(safePreviewImageUrl(null)).toBe('');
  });

  it('escapes markup characters instead of passing them through', () => {
    expect(safePreviewImageUrl('https://cdn.example/x.jpg"><script>')).toBe('https://cdn.example/x.jpg%22%3E%3Cscript%3E');
  });
});
