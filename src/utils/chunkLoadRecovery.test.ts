import { CHUNK_RELOAD_WINDOW_MS, isChunkLoadError, reloadOnceForChunkError } from './chunkLoadRecovery';

function errorWith(name: string, message: string, stack?: string): Error {
  const error = new Error(message);
  error.name = name;
  if (stack !== undefined) error.stack = stack;
  return error;
}

describe('isChunkLoadError', () => {
  it.each([
    ['webpack ChunkLoadError name', errorWith('ChunkLoadError', 'anything')],
    ['webpack message', errorWith('Error', 'Loading chunk 123 failed.\n(error: https://x.test/static/js/123.abc.chunk.js)')],
    ['webpack CSS chunk', errorWith('Error', 'Loading CSS chunk 45 failed.')],
    ['Chromium dynamic import', new TypeError('Failed to fetch dynamically imported module: https://x.test/a.js')],
    ['Firefox dynamic import', new TypeError('error loading dynamically imported module: https://x.test/a.js')],
    ['Safari dynamic import', new TypeError('Importing a module script failed.')],
    ['chunk answered with HTML', errorWith('Error', "Refused to execute script from 'https://x.test/static/js/9.js' because its MIME type ('text/html') is not executable")],
    ['HTML parsed as the built bundle', errorWith('SyntaxError', "Unexpected token '<'", "SyntaxError: Unexpected token '<'\n    at https://x.test/static/js/9.abc.chunk.js:1:1")],
  ])('detects %s', (_label, error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  it.each([
    ['a plain runtime error', new TypeError("Cannot read properties of undefined (reading 'map')")],
    ['an unrelated network error', new TypeError('Failed to fetch')],
    ['JSON.parse of an HTML API body', errorWith('SyntaxError', "Unexpected token '<'", "SyntaxError: Unexpected token '<'\n    at JSON.parse (<anonymous>)")],
    ['a thrown string', 'Loading chunk 1 failed'],
    ['null', null],
    ['undefined', undefined],
  ])('does not treat %s as a chunk error', (_label, error) => {
    expect(isChunkLoadError(error)).toBe(false);
  });
});

describe('reloadOnceForChunkError', () => {
  const reload = jest.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    reload.mockClear();
    window.sessionStorage.clear();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    jest.restoreAllMocks();
  });

  it('reloads on the first failure and refuses a second inside the window', () => {
    expect(reloadOnceForChunkError(1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    expect(reloadOnceForChunkError(1_000_000 + CHUNK_RELOAD_WINDOW_MS - 1)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('allows another reload once the window has passed, so recovery is never permanently suppressed', () => {
    expect(reloadOnceForChunkError(1_000_000)).toBe(true);
    expect(reloadOnceForChunkError(1_000_000 + CHUNK_RELOAD_WINDOW_MS)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('recovers from a timestamp in the future (clock change) instead of blocking', () => {
    window.sessionStorage.setItem('chunkReloadAt', String(9_000_000));
    expect(reloadOnceForChunkError(1_000_000)).toBe(true);
  });

  it('does not reload when sessionStorage is unavailable, since it could not guard against a loop', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(reloadOnceForChunkError(1_000_000)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
