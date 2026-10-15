/**
 * Pure helpers for scripts/check-csp-inline-hashes.mjs (#222).
 *
 * Kept free of file and process access so Jest can import them
 * (src/lib/cspInlineHashes.test.ts). The CLI owns all I/O.
 *
 * A CSP `'sha256-...'` source matches an inline script when the hash of the
 * script element's exact text content equals it. Browsers hash the served
 * bytes (UTF-8), with no whitespace trimming and no entity decoding, so the
 * hash must be computed from the built `build/index.html`, not from
 * `public/index.html`: CRA's HtmlWebpackPlugin minifies the inline script.
 */
import { createHash } from 'node:crypto';

// script `type` values the browser executes as classic or module JavaScript.
// Anything else (application/json, application/ld+json, a template MIME type)
// is a data block: it is never run, so CSP script-src does not apply to it.
const EXECUTABLE_TYPES = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'text/ecmascript',
  'application/ecmascript',
  'text/jscript',
  'text/livescript',
  'text/x-javascript',
  'text/x-ecmascript',
]);

function readAttribute(attributes, name) {
  const match = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    'i'
  ).exec(attributes);
  if (match) return match[1] ?? match[2] ?? match[3] ?? '';
  // Boolean form, e.g. `<script src>` (present, empty).
  return new RegExp(`(?:^|\\s)${name}(?:\\s|$)`, 'i').test(attributes) ? '' : null;
}

/** sha256 of the exact script text, in CSP source form: sha256-<base64>. */
export function hashInlineScript(text) {
  return `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
}

/**
 * Every executable inline `<script>` (no `src`) in an HTML document, in order.
 * HTML comments are ignored (they are not scripts).
 */
export function findInlineScripts(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while ((match = pattern.exec(withoutComments)) !== null) {
    const attributes = match[1];
    if (readAttribute(attributes, 'src') !== null) continue;
    const type = (readAttribute(attributes, 'type') ?? '').trim().toLowerCase();
    if (!EXECUTABLE_TYPES.has(type)) continue;
    scripts.push({ text: match[2], hash: hashInlineScript(match[2]) });
  }
  return scripts;
}

/**
 * Compare the inline scripts in `html` with an allowlist of hashes.
 * `unexpected`: inline scripts whose hash is not allowlisted (an enforced
 * policy would block them). `stale`: allowlisted hashes with no matching script.
 */
export function checkInlineScripts(html, allowlist) {
  const allowed = new Set(allowlist);
  const found = findInlineScripts(html);
  const foundHashes = new Set(found.map(script => script.hash));
  return {
    found,
    unexpected: found.filter(script => !allowed.has(script.hash)),
    stale: Array.from(allowed).filter(hash => !foundHashes.has(hash)),
  };
}

/** `'sha256-...'` sources named in a block of text, de-duplicated. */
export function extractCspHashes(text) {
  const hashes = [];
  const pattern = /'(sha256-[A-Za-z0-9+/]{43}=)'/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (!hashes.includes(match[1])) hashes.push(match[1]);
  }
  return hashes;
}

/**
 * Hashes on the `script-src` line of the draft policy in the doc, or null if
 * there is no such directive line.
 */
export function extractDocScriptSrcHashes(markdown) {
  const line = markdown.split('\n').find(candidate => /^\s*script-src\b/.test(candidate));
  return line === undefined ? null : extractCspHashes(line);
}

export function sameHashSet(a, b) {
  return a.length === b.length && a.every(hash => b.includes(hash));
}
