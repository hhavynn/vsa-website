// Recovery for stale lazy-loaded chunks after a deploy.
//
// A tab that loaded an older index.html still points at the old content-hashed
// chunk filenames. Once a new deploy replaces them, `React.lazy` fails when the
// user navigates, and a single reload fetches the fresh shell.

const RELOAD_KEY = 'chunkReloadAt';

/** One automatic reload per this window; a second chunk failure inside it shows the error UI. */
export const CHUNK_RELOAD_WINDOW_MS = 60_000;

const CHUNK_MESSAGE_PATTERNS = [
  // webpack 5 / CRA: "Loading chunk 123 failed.\n(error: https://…/static/js/123.abc.chunk.js)"
  /Loading (?:CSS )?chunk [\w-]+ failed/i,
  // Native dynamic import(): Chromium, Firefox, Safari respectively.
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  // A chunk URL answered with HTML (nosniff makes the browser refuse to run it).
  /Refused to execute script .*MIME type/i,
  /disallowed MIME type/i,
];

/**
 * True only for errors that mean "a code-split file could not be loaded".
 *
 * `Unexpected token '<'` also comes from `JSON.parse` of an HTML body, so it
 * counts only when the error itself points at a built `/static/js/` file.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message, stack } = error as { name?: unknown; message?: unknown; stack?: unknown };
  if (name === 'ChunkLoadError') return true;

  const text = typeof message === 'string' ? message : '';
  if (CHUNK_MESSAGE_PATTERNS.some((pattern) => pattern.test(text))) return true;

  const origin = `${text}\n${typeof stack === 'string' ? stack : ''}`;
  return name === 'SyntaxError' && /Unexpected token '<'/.test(text) && /\/static\/js\//.test(origin);
}

/**
 * Reloads the page at most once per `CHUNK_RELOAD_WINDOW_MS`. Returns whether a
 * reload was started. If sessionStorage is unavailable the loop guard cannot
 * work, so it declines to reload rather than risk looping.
 */
export function reloadOnceForChunkError(now: number = Date.now()): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    const elapsed = now - last;
    if (elapsed >= 0 && elapsed < CHUNK_RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
